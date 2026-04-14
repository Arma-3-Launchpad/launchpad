from __future__ import annotations

import os
import re
import subprocess
from typing import Any, Literal

MissionRepoKind = Literal["none", "parent", "mission"]


def has_github_integration(config: dict) -> bool:
    return bool(config.get("github_integration", False))


def system_has_git() -> bool:
    try:
        return (
            subprocess.run(
                ["git", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            ).returncode
            == 0
        )
    except (OSError, subprocess.TimeoutExpired):
        return False


def system_has_github() -> bool:
    try:
        return (
            subprocess.run(
                ["gh", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            ).returncode
            == 0
        )
    except (OSError, subprocess.TimeoutExpired):
        return False


def system_has_github_cli() -> bool:
    return system_has_git() and system_has_github()


def gh_cli_is_authenticated() -> bool:
    if not system_has_github():
        return False
    try:
        r = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
        return r.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def handle_github_status_request() -> dict[str, Any]:
    return {
        "has_git": system_has_git(),
        "has_github": system_has_github(),
        "has_github_cli": system_has_github_cli(),
    }


def _real_norm(path: str) -> str:
    return os.path.realpath(os.path.normpath(path))


def _git_run(repo: str, *args: str, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )


def mission_git_root_kind(project_root: str) -> tuple[MissionRepoKind, str | None, str | None]:
    """
    Classify git layout for ``project_root``.

    Returns ``(kind, detected_toplevel_or_none, hint_message_or_none)``.
    ``parent`` means ``git`` would use an enclosing repository (not the mission folder).
    """
    if not system_has_git():
        return "none", None, None
    root = _real_norm(project_root)
    if not os.path.isdir(root):
        return "none", None, None
    probe = _git_run(root, "rev-parse", "--is-inside-work-tree")
    if probe.returncode != 0:
        return "none", None, (probe.stderr or probe.stdout or "").strip() or None
    if (probe.stdout or "").strip().lower() != "true":
        return "none", None, None
    top_p = _git_run(root, "rev-parse", "--show-toplevel")
    if top_p.returncode != 0:
        return "none", None, (top_p.stderr or top_p.stdout or "").strip() or None
    raw_top = (top_p.stdout or "").strip()
    if not raw_top:
        return "none", None, None
    top = _real_norm(raw_top)
    if top == root:
        return "mission", top, None
    return "parent", top, (
        f"This folder is inside another Git repository ({top!r}). "
        "Use “Create repository here” so the mission folder is its own repo."
    )


def git_get_origin_url(project_root: str) -> str | None:
    r = _git_run(project_root, "remote", "get-url", "origin")
    if r.returncode != 0:
        return None
    u = (r.stdout or "").strip()
    return u or None


def git_repo_status(project_root: str) -> dict[str, Any]:
    """Status for the mission folder only (ignores parent repositories)."""
    if not system_has_git():
        return {
            "ok": False,
            "error": "Git is not installed or not on PATH.",
            "missionGitRoot": "none",
            "files": [],
            "hasGhCli": False,
            "ghAuthenticated": False,
        }

    root = _real_norm(project_root)
    kind, toplevel, hint = mission_git_root_kind(project_root)

    base: dict[str, Any] = {
        "ok": True,
        "missionGitRoot": kind,
        "missionProjectPath": root,
        "detectedGitToplevel": toplevel,
        "hasMissionRepo": kind == "mission",
        "hasGit": kind == "mission",
        "hasGhCli": system_has_github_cli(),
        "ghAuthenticated": gh_cli_is_authenticated(),
    }

    if kind != "mission":
        base["files"] = []
        base["branch"] = ""
        base["upstream"] = None
        base["branchLine"] = ""
        base["originUrl"] = None
        base["message"] = hint or (
            "No Git repository in this mission folder yet."
            if kind == "none"
            else "A parent folder is the Git root; this mission is not its own repository."
        )
        return base

    origin_url = git_get_origin_url(root)
    base["originUrl"] = origin_url

    branch_p = _git_run(root, "rev-parse", "--abbrev-ref", "HEAD")
    branch = (branch_p.stdout or "").strip() or "(detached)"

    upstream_p = _git_run(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    upstream: str | None = None
    if upstream_p.returncode == 0:
        u = (upstream_p.stdout or "").strip()
        upstream = u or None

    st = _git_run(root, "status", "--porcelain=v1", "-b")
    if st.returncode != 0:
        return {
            **base,
            "ok": False,
            "error": (st.stderr or st.stdout or "").strip(),
            "branch": branch,
            "files": [],
        }
    lines = (st.stdout or "").splitlines()
    branch_line = lines[0] if lines else ""
    files: list[dict[str, str]] = []
    for line in lines[1:]:
        if len(line) < 4:
            continue
        code = line[:2]
        path_part = line[3:].strip()
        if " -> " in path_part:
            path_part = path_part.split(" -> ", 1)[1]
        files.append({"code": code.strip(), "path": path_part})
    base["branch"] = branch
    base["upstream"] = upstream
    base["branchLine"] = branch_line
    base["files"] = files
    return base


def git_init_mission_repo(project_root: str) -> dict[str, Any]:
    """Run ``git init`` in the mission folder so it becomes its own repository."""
    if not system_has_git():
        return {"ok": False, "error": "Git is not installed or not on PATH."}
    root = _real_norm(project_root)
    if not os.path.isdir(root):
        return {"ok": False, "error": "Mission project folder does not exist."}
    kind, _, _ = mission_git_root_kind(root)
    if kind == "mission":
        return {"ok": True, "message": "This folder is already the root of a Git repository.", "already": True}
    init = subprocess.run(
        ["git", "init"],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )
    if init.returncode != 0:
        err = (init.stderr or init.stdout or "").strip()
        return {"ok": False, "error": err or "git init failed."}
    kind2, _, _ = mission_git_root_kind(root)
    if kind2 != "mission":
        return {
            "ok": False,
            "error": "git init ran but this folder is still not the Git root. Check for a broken .git directory.",
        }
    return {"ok": True, "message": (init.stdout or init.stderr or "").strip() or "Repository initialized."}


def git_recent_log(project_root: str, limit: int = 25) -> dict[str, Any]:
    """Recent commits at the mission repo root only."""
    if not system_has_git():
        return {"ok": False, "error": "Git is not installed or not on PATH.", "commits": []}
    kind, _, _ = mission_git_root_kind(project_root)
    if kind != "mission":
        return {"ok": True, "commits": [], "skipped": True, "missionGitRoot": kind}
    root = _real_norm(project_root)
    lim = max(1, min(int(limit), 100))
    sep = "\x1f"
    rec_sep = "\x1e"
    fmt = f"%H{sep}%s{sep}%an{sep}%ai{rec_sep}"
    lg = _git_run(root, "-c", "core.quotepath=false", "log", f"-n{lim}", f"--pretty=format:{fmt}")
    if lg.returncode != 0:
        err_t = (lg.stderr or lg.stdout or "").strip()
        el = err_t.lower()
        if (
            "does not have any commits yet" in el
            or "bad revision" in el
            or "unknown revision" in el
            or "does not have any commits" in el
        ):
            return {"ok": True, "commits": []}
        return {"ok": False, "error": err_t, "commits": []}
    raw = lg.stdout or ""
    commits: list[dict[str, str]] = []
    for chunk in raw.split(rec_sep):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = chunk.split(sep, 3)
        if len(parts) < 4:
            continue
        commits.append({"hash": parts[0], "subject": parts[1], "author": parts[2], "date": parts[3]})
    return {"ok": True, "commits": commits}


def git_commit_all(project_root: str, message: str) -> dict[str, Any]:
    """Stage all changes and create one commit (mission repo root only)."""
    if not system_has_git():
        return {"ok": False, "error": "Git is not installed or not on PATH."}
    kind, _, hint = mission_git_root_kind(project_root)
    if kind != "mission":
        return {
            "ok": False,
            "error": hint
            or (
                "This mission folder is not its own Git repository. "
                "Use “Create repository here” in the GitHub panel first."
            ),
        }
    root = _real_norm(project_root)
    msg = message.strip()
    if not msg:
        return {"ok": False, "error": "Commit message is required."}
    add = _git_run(root, "add", "-A")
    if add.returncode != 0:
        return {"ok": False, "error": (add.stderr or add.stdout or "").strip() or "git add failed."}
    commit = _git_run(root, "commit", "-m", msg)
    out = ((commit.stdout or "") + "\n" + (commit.stderr or "")).strip()
    if commit.returncode != 0:
        low = out.lower()
        if "nothing to commit" in low or "nothing added to commit" in low:
            return {"ok": False, "error": "Nothing to commit — working tree clean."}
        return {"ok": False, "error": out or "git commit failed."}
    return {"ok": True, "summary": (commit.stdout or "").strip()}


_GH_REPO_NAME_RE = re.compile(r"^[a-zA-Z0-9._-]{1,100}$")


def suggest_github_repo_slug(mission_name: str, map_suffix: str) -> str:
    def _part(x: str) -> str:
        t = x.strip()
        seg = re.sub(r"[^a-zA-Z0-9._-]+", "-", t).strip("-")
        seg = re.sub(r"-{2,}", "-", seg).strip(".")
        return seg

    a, b = _part(mission_name), _part(map_suffix)
    if not a:
        a = "arma3-mission"
    if not b:
        b = "map"
    slug = f"{a}.{b}"
    if not _GH_REPO_NAME_RE.match(slug):
        slug = "arma3-mission"
    return slug[:100]


def gh_publish_mission_repo(
    project_root: str,
    repo_name: str,
    visibility: str,
    description: str,
) -> dict[str, Any]:
    """
    Create a GitHub repository from the mission folder using ``gh repo create`` and push.
    Requires ``gh`` logged in (``gh auth login``).
    """
    if not system_has_github_cli():
        return {"ok": False, "error": "Git and GitHub CLI (gh) are required. Install gh and run: gh auth login"}
    if not gh_cli_is_authenticated():
        return {"ok": False, "error": "Not logged in to GitHub. In a terminal run: gh auth login"}
    kind, _, hint = mission_git_root_kind(project_root)
    if kind != "mission":
        return {"ok": False, "error": hint or "Initialize a repository in this mission folder first."}
    root = _real_norm(project_root)
    if git_get_origin_url(root):
        return {"ok": False, "error": "Remote origin already exists. This project may already be published."}

    rname = repo_name.strip()
    if not rname or not _GH_REPO_NAME_RE.match(rname):
        return {
            "ok": False,
            "error": "Invalid repository name. Use 1–100 characters: letters, numbers, dots, hyphens, underscores.",
        }
    vis = (visibility or "private").strip().lower()
    if vis not in ("public", "private"):
        vis = "private"

    head = _git_run(root, "rev-parse", "--verify", "HEAD")
    if head.returncode != 0:
        empty = _git_run(root, "commit", "--allow-empty", "-m", "chore: initial commit (Launchpad)")
        if empty.returncode != 0:
            return {
                "ok": False,
                "error": (empty.stderr or empty.stdout or "").strip()
                or "Could not create an initial commit. Add files or commit locally first.",
            }

    desc = (description or "").strip() or "Arma 3 mission (managed with Launchpad)"
    desc = desc[:500]

    cmd = [
        "gh",
        "repo",
        "create",
        rname,
        "-y",
        "--source",
        ".",
        "--remote",
        "origin",
        "--push",
        "--description",
        desc,
    ]
    if vis == "public":
        cmd.append("--public")
    else:
        cmd.append("--private")

    proc = subprocess.run(
        cmd,
        cwd=root,
        capture_output=True,
        text=True,
        timeout=300,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )
    out = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
    if proc.returncode != 0:
        return {"ok": False, "error": out or "gh repo create failed."}

    origin = git_get_origin_url(root)
    return {"ok": True, "summary": out or "Repository created.", "originUrl": origin}
