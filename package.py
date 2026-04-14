#!/usr/bin/env python3
"""
Build deliverables under ``A3LaunchPad/``:

- ``web_dist/`` — Vite static UI (not inside PyInstaller ``_internal``)
- ``bin/`` — PyInstaller onedir for ``launchpad_server``
- ``mod/`` — extension + addon PBO
- ``app/`` — Electron Forge ``package`` output (desktop shell; embeds ``bin`` + ``web_dist``)

Frozen server reads ``web_dist`` and writes ``launchpad_data`` next to ``bin`` (A3LaunchPad root).

Prerequisites: ``npm run build`` in ``launchpad_client/renderer``, PyInstaller on PATH,
Pillow on Windows for ``launchpad.spec``, and Node/npm for the Electron step.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


REPO = Path(__file__).resolve().parent
SPEC = REPO / "launchpad.spec"
A3 = REPO / "A3LaunchPad"
CLIENT_DIST = REPO / "launchpad_client" / "renderer" / "dist"
EXT_ROOT = REPO / "launchpad_mod" / "extension"
ADDON_PBO_NAME = "a3_launchpad_ext_core.pbo"
HEMTT_BUILD_ADDONS = REPO / "launchpad_mod" / ".hemttout" / "build" / "addons"


def _die(msg: str) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(1)


def preflight_package() -> None:
    if not CLIENT_DIST.is_dir() or not any(CLIENT_DIST.iterdir()):
        _die(
            f"Missing web client build at {CLIENT_DIST}.\n"
            "  cd launchpad_client/renderer && npm ci && npm run build"
        )
    if not SPEC.is_file():
        _die(f"Missing PyInstaller spec: {SPEC}")


def _rmtree_retry(
    path: Path,
    *,
    attempts: int = 8,
    delay_sec: float = 0.75,
) -> None:
    """
    Windows often leaves ``app.asar`` locked after a dev Electron run or Explorer preview.
    Removing ``out/`` before ``electron-forge package`` avoids EBUSY unlink errors.
    """
    if not path.exists():
        return
    last_err: OSError | None = None
    for i in range(attempts):
        try:
            shutil.rmtree(path)
            return
        except OSError as e:
            last_err = e
            if i + 1 == attempts:
                break
            time.sleep(delay_sec)
    assert last_err is not None
    _die(
        f"Could not remove {path} ({last_err}).\n"
        "Close any running Launchpad/Electron windows, exit debug sessions that attach to npm, "
        "and close Explorer windows previewing that folder—then run packaging again."
    )


def _run_npm(args: list[str], cwd: Path) -> None:
    if sys.platform == "win32":
        subprocess.run(
            subprocess.list2cmdline(["npm", *args]),
            cwd=str(cwd),
            shell=True,
            check=True,
        )
    else:
        subprocess.run(["npm", *args], cwd=str(cwd), check=True)


def stage_web_dist() -> None:
    """Copy Vite output to ``A3LaunchPad/web_dist`` (served by the frozen server, bundled next to ``bin`` in Electron)."""
    dst = A3 / "web_dist"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(CLIENT_DIST, dst)
    print(f"Staged web UI: {CLIENT_DIST} -> {dst}")


def stage_electron_app() -> None:
    """Run ``electron-forge package`` and copy ``out/`` into ``A3LaunchPad/app``."""
    app_dir = REPO / "launchpad_client" / "app"
    if not (app_dir / "node_modules").is_dir():
        print("Installing Electron app dependencies (npm ci)...")
        _run_npm(["ci"], app_dir)
    out_dir = app_dir / "out"
    print("Clearing Electron Forge output (avoids locked app.asar on Windows)...")
    _rmtree_retry(out_dir)
    _run_npm(["run", "package"], app_dir)
    if not out_dir.is_dir() or not any(out_dir.iterdir()):
        print(f"Warning: Electron package produced no output under {out_dir}", file=sys.stderr)
        return
    dest = A3 / "app"
    _rmtree_retry(dest)
    shutil.copytree(out_dir, dest)
    print(f"Staged Electron app: {out_dir} -> {dest}")


def _find_extension_binary() -> Path | None:
    if os.name == "nt":
        names = ("A3_LAUNCHPAD_EXT_x64.dll",)
    else:
        names = ("A3_LAUNCHPAD_EXT_x64.so",)
    search_roots = (
        EXT_ROOT / "build" / "Release",
        EXT_ROOT / "build" / "RelWithDebInfo",
        EXT_ROOT / "build" / "Debug",
        EXT_ROOT / "build",
        EXT_ROOT / "ci-build",
        REPO / "launchpad_mod" / "bin" / "mod",
        A3 / "mod",
    )
    for root in search_roots:
        if not root.is_dir():
            continue
        for name in names:
            p = root / name
            if p.is_file():
                return p
    return None


def _find_addon_pbo() -> Path | None:
    """Locate the HEMTT-built addon PBO (dev build or release layout)."""
    candidates: list[Path] = []

    if HEMTT_BUILD_ADDONS.is_dir():
        for p in HEMTT_BUILD_ADDONS.glob("*.pbo"):
            if "a3_launchpad_ext_core" in p.name.lower():
                candidates.append(p)

    releases = REPO / "launchpad_mod" / "releases"
    if releases.is_dir():
        for p in releases.rglob("*.pbo"):
            rel = str(p).replace("\\", "/").lower()
            if "/addons/" in rel and "a3_launchpad_ext_core" in p.name.lower():
                candidates.append(p)

    if not candidates:
        return None

    candidates.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return candidates[0]


def stage_mod_deliverables() -> None:
    """Populate ``A3LaunchPad/mod`` (extension binary + addon)."""
    mod_root = A3 / "mod"
    addons_dir = mod_root / "addons"
    addons_dir.mkdir(parents=True, exist_ok=True)

    ext = _find_extension_binary()
    if ext is not None:
        if os.name == "nt":
            dest_name = "A3_LAUNCHPAD_EXT_x64.dll"
        else:
            dest_name = "A3_LAUNCHPAD_EXT_x64.so"
        shutil.copy2(ext, mod_root / dest_name)
        print(f"Staged extension: {ext.name} -> {mod_root / dest_name}")
    else:
        print(
            "Warning: native extension binary not found "
            f"(searched under {EXT_ROOT / 'build'}). Build the CMake target first.",
            file=sys.stderr,
        )

    pbo_src = _find_addon_pbo()
    dest_pbo = addons_dir / ADDON_PBO_NAME
    loose_dir = addons_dir / "a3_launchpad_ext_core"

    if loose_dir.is_dir():
        shutil.rmtree(loose_dir)

    if pbo_src is None:
        print(
            "Warning: addon PBO not found. From launchpad_mod run: hemtt build\n"
            f"  (expected under {HEMTT_BUILD_ADDONS} or launchpad_mod/releases/).",
            file=sys.stderr,
        )
        return

    if dest_pbo.exists():
        dest_pbo.unlink()
    shutil.copy2(pbo_src, dest_pbo)
    print(f"Staged addon PBO: {pbo_src.name} -> {dest_pbo}")


def cmd_package() -> None:
    preflight_package()
    A3.mkdir(parents=True, exist_ok=True)
    stage_web_dist()
    bin_out = A3 / "bin"
    bin_out.mkdir(parents=True, exist_ok=True)
    work = REPO / "build" / "pyinstaller"
    work.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(SPEC),
            "--noconfirm",
            "--clean",
            "--distpath",
            str(bin_out),
            "--workpath",
            str(work),
        ],
        cwd=str(REPO),
        check=True,
    )
    stage_mod_deliverables()
    stage_electron_app()
    print(
        f"Package complete: server in {bin_out}, web UI in {A3 / 'web_dist'}, "
        f"mod under {A3 / 'mod'}, Electron under {A3 / 'app'}, data dir {A3 / 'launchpad_data'}"
    )


def _desktop_dir() -> Path:
    home = Path.home()
    if os.name == "nt":
        for candidate in (
            home / "Desktop",
            home / "OneDrive" / "Desktop",
            Path(os.environ.get("USERPROFILE", str(home))) / "Desktop",
        ):
            if candidate.is_dir():
                return candidate
        public = os.environ.get("PUBLIC", "")
        if public:
            desk = Path(public) / "Desktop"
            if desk.is_dir():
                return desk
        return home / "Desktop"
    return home / "Desktop"


def cmd_install_desktop() -> None:
    """Create a desktop shortcut (Windows) or symlink (Unix) to the packaged server exe."""
    if os.name == "nt":
        exe = A3 / "bin" / "A3MissionLaunchpadPython.exe"
    else:
        exe = A3 / "bin" / "A3MissionLaunchpadPython"
    if not exe.is_file():
        _die(f"Missing packaged executable: {exe}\n  Run: python package.py package")

    desktop = _desktop_dir()
    desktop.mkdir(parents=True, exist_ok=True)

    if os.name == "nt":
        lnk = desktop / "A3 Mission Launchpad.lnk"
        ps = (
            "$s = New-Object -ComObject WScript.Shell; "
            f"$l = $s.CreateShortcut({str(lnk)!r}); "
            f"$l.TargetPath = {str(exe)!r}; "
            f"$l.WorkingDirectory = {str(exe.parent)!r}; "
            "$l.Save()"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            check=True,
        )
        print(f"Created shortcut: {lnk}")
    else:
        link = desktop / "A3 Mission Launchpad"
        if link.exists() or link.is_symlink():
            link.unlink()
        link.symlink_to(exe)
        print(f"Created symlink: {link} -> {exe}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Package Launchpad into A3LaunchPad/")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_pkg = sub.add_parser("package", help="PyInstaller onedir into A3LaunchPad/bin + stage mod")
    p_pkg.set_defaults(func=cmd_package)

    p_build = sub.add_parser("build", help="Alias for package")
    p_build.set_defaults(func=cmd_package)

    p_desk = sub.add_parser(
        "install-desktop",
        help="Desktop shortcut or symlink to A3MissionLaunchpadPython under A3LaunchPad/bin",
    )
    p_desk.set_defaults(func=cmd_install_desktop)

    args = parser.parse_args()
    args.func()


if __name__ == "__main__":
    main()
