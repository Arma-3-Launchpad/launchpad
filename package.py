#!/usr/bin/env python3
"""
Build deliverables under ``A3LaunchPad/``:

- ``web_dist/`` — Vite static UI (not inside PyInstaller ``_internal``)
- ``bin/`` — PyInstaller onedir for ``launchpad_server``
- ``mod/`` — extension + addon PBO
- ``app/`` — Electron Forge ``package`` output (desktop shell; embeds ``bin`` + ``web_dist``)

Frozen server reads ``web_dist`` and writes ``launchpad_data`` next to ``bin`` (A3LaunchPad root).

``python package.py --install`` (Windows) performs a full package, runs Electron Forge ``make``
to produce the Squirrel installer, then launches that Setup.exe.

``python package.py --uninstall`` (Windows) runs Squirrel's ``Update.exe --uninstall`` for the
installed app (no build). Does not remove ``A3LaunchPad/`` staged output in the repo.

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
import uuid
from pathlib import Path


REPO = Path(__file__).resolve().parent
SPEC = REPO / "launchpad.spec"
A3 = REPO / "A3LaunchPad"
CLIENT_DIST = REPO / "launchpad_client" / "renderer" / "dist"
EXT_ROOT = REPO / "launchpad_mod" / "extension"
ADDON_PBO_NAME = "a3_launchpad_ext_core.pbo"
HEMTT_BUILD_ADDONS = REPO / "launchpad_mod" / ".hemttout" / "build" / "addons"
# Squirrel per-user install dir under ``%LOCALAPPDATA%``; must match ``name`` in ``launchpad_client/app/package.json``.
ELECTRON_SQUIRREL_APP_FOLDER = "a3-mission-launchpad"


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
    fatal: bool = True,
) -> bool:
    """
    Windows often leaves ``app.asar`` locked after a dev Electron run or Explorer preview.
    Removing ``out/`` before ``electron-forge package`` avoids EBUSY unlink errors.
    """
    if not path.exists():
        return True
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
    msg = (
        f"Could not remove {path} ({last_err}).\n"
        "Close any running Launchpad/Electron windows, exit debug sessions that attach to npm, "
        "and close Explorer windows previewing that folder—then run packaging again."
    )
    if fatal:
        _die(msg)
    print(f"Warning: {msg}", file=sys.stderr)
    return False


def _run_npm(
    args: list[str],
    cwd: Path,
    *,
    extra_env: dict[str, str] | None = None,
) -> None:
    env = {**os.environ, **(extra_env or {})}
    if sys.platform == "win32":
        subprocess.run(
            subprocess.list2cmdline(["npm", *args]),
            cwd=str(cwd),
            shell=True,
            check=True,
            env=env,
        )
    else:
        subprocess.run(["npm", *args], cwd=str(cwd), check=True, env=env)


def stage_web_dist() -> None:
    """Copy Vite output to ``A3LaunchPad/web_dist`` (served by the frozen server, bundled next to ``bin`` in Electron)."""
    dst = A3 / "web_dist"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(CLIENT_DIST, dst)
    print(f"Staged web UI: {CLIENT_DIST} -> {dst}")


def stage_electron_app() -> None:
    """Run ``electron-forge package`` and copy the packager output into ``A3LaunchPad/app``."""
    app_dir = REPO / "launchpad_client" / "app"
    if not (app_dir / "node_modules").is_dir():
        print("Installing Electron app dependencies (npm ci)...")
        _run_npm(["ci"], app_dir)
    # Fresh directory each run — avoids WinError 32 when ``app/out/.../app.asar`` stays locked
    # (Explorer, indexer, AV, IDE) and cannot be deleted.
    electron_out = REPO / "build" / f"electron-forge-{uuid.uuid4().hex[:12]}"
    electron_out.mkdir(parents=True, exist_ok=True)
    out_abs = str(electron_out.resolve())
    print(f"Electron Forge output directory: {out_abs}")
    _run_npm(
        ["run", "package"],
        app_dir,
        extra_env={"LAUNCHPAD_ELECTRON_OUT": out_abs},
    )
    if not electron_out.is_dir() or not any(electron_out.iterdir()):
        print(
            f"Warning: Electron package produced no output under {electron_out}",
            file=sys.stderr,
        )
        return
    dest = A3 / "app"
    if _rmtree_retry(dest, fatal=False):
        shutil.copytree(electron_out, dest)
        print(f"Staged Electron app: {electron_out} -> {dest}")
    else:
        # Keep build successful even if the previous app folder is locked by Windows.
        fallback = A3 / f"app-{uuid.uuid4().hex[:8]}"
        _rmtree_retry(fallback, fatal=False)
        shutil.copytree(electron_out, fallback)
        print(
            f"Staged Electron app to fallback location (default app folder locked): {fallback}",
            file=sys.stderr,
        )
    try:
        shutil.rmtree(electron_out)
    except OSError:
        print(
            f"Note: could not remove temporary {electron_out} (still in use). "
            "You can delete it later; it is under build/ and gitignored.",
            file=sys.stderr,
        )


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


def _package_core() -> Path:
    """Stage web UI, PyInstaller onedir into ``A3LaunchPad/bin``, and mod deliverables. Returns ``bin_out``."""
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
    return bin_out


def cmd_package() -> None:
    bin_out = _package_core()
    stage_electron_app()
    print(
        f"Package complete: server in {bin_out}, web UI in {A3 / 'web_dist'}, "
        f"mod under {A3 / 'mod'}, Electron under {A3 / 'app'}, data dir {A3 / 'launchpad_data'}"
    )


def _sync_packaged_dir_to_a3_app(forge_out: Path) -> None:
    """After ``make``, copy ``*-win32-x64`` (or ``*-darwin-*`` / ``*-linux-*``) into ``A3LaunchPad/app``."""
    if sys.platform == "win32":
        globs = ("*-win32-x64",)
    elif sys.platform == "darwin":
        globs = ("*-darwin-*",)
    else:
        globs = ("*-linux-*",)
    candidates: list[Path] = []
    for pat in globs:
        candidates.extend(p for p in forge_out.glob(pat) if p.is_dir())
    if not candidates:
        return
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    src = candidates[0]
    dest = A3 / "app"
    if _rmtree_retry(dest, fatal=False):
        shutil.copytree(src, dest)
        print(f"Staged Electron app: {src} -> {dest}")


def _find_squirrel_setup_exe(forge_out: Path) -> Path | None:
    make_dir = forge_out / "make"
    if not make_dir.is_dir():
        return None
    candidates = [
        p
        for p in make_dir.rglob("*.exe")
        if "setup" in p.name.lower() and p.is_file()
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def _run_electron_make_and_launch_setup() -> None:
    if sys.platform != "win32":
        _die(
            "python package.py --install is only implemented on Windows (Squirrel installer).\n"
            "  On other platforms run: cd launchpad_client/app && npm run make"
        )
    app_dir = REPO / "launchpad_client" / "app"
    if not (app_dir / "node_modules").is_dir():
        print("Installing Electron app dependencies (npm ci)...")
        _run_npm(["ci"], app_dir)
    electron_out = REPO / "build" / f"electron-forge-make-{uuid.uuid4().hex[:12]}"
    electron_out.mkdir(parents=True, exist_ok=True)
    out_abs = str(electron_out.resolve())
    print(f"Electron Forge make output directory: {out_abs}")
    _run_npm(
        ["run", "make"],
        app_dir,
        extra_env={"LAUNCHPAD_ELECTRON_OUT": out_abs},
    )
    _sync_packaged_dir_to_a3_app(electron_out)
    setup = _find_squirrel_setup_exe(electron_out)
    if setup is None or not setup.is_file():
        _die(
            f"No Squirrel Setup.exe found under {electron_out / 'make'}.\n"
            "  Check Electron Forge output and maker-squirrel configuration."
        )
    print(f"Launching installer: {setup}")
    rc = subprocess.run([str(setup)]).returncode
    if rc != 0:
        print(f"Installer exited with code {rc}.", file=sys.stderr)
    try:
        shutil.rmtree(electron_out)
    except OSError:
        print(
            f"Note: could not remove temporary {electron_out} (still in use). "
            "You can delete it later; it is under build/ and gitignored.",
            file=sys.stderr,
        )


def cmd_install_electron() -> None:
    """Full package plus ``electron-forge make`` and run the Windows Setup.exe."""
    _package_core()
    _run_electron_make_and_launch_setup()
    print(
        f"Install step finished. Packaged layout remains under {A3} "
        f"(installer output may have been removed from build/)."
    )


def _squirrel_update_exe_windows() -> Path | None:
    local = os.environ.get("LOCALAPPDATA", "")
    if not local:
        return None
    base = Path(local)
    direct = base / ELECTRON_SQUIRREL_APP_FOLDER / "Update.exe"
    if direct.is_file():
        return direct
    for child in base.iterdir():
        if not child.is_dir():
            continue
        if child.name == ELECTRON_SQUIRREL_APP_FOLDER or child.name.startswith(
            f"{ELECTRON_SQUIRREL_APP_FOLDER}."
        ):
            candidate = child / "Update.exe"
            if candidate.is_file():
                return candidate
    return None


def cmd_uninstall_electron() -> None:
    if sys.platform != "win32":
        _die(
            "python package.py --uninstall is only implemented on Windows (Squirrel).\n"
            "  Remove the app from your system using the platform uninstaller."
        )
    update_exe = _squirrel_update_exe_windows()
    if update_exe is None:
        _die(
            "No Squirrel install found (Update.exe missing).\n"
            f"  Look under %LOCALAPPDATA%\\{ELECTRON_SQUIRREL_APP_FOLDER}\\\n"
            "  If the app was never installed with the Setup.exe, there is nothing to remove."
        )
    print(f"Running uninstaller: {update_exe} --uninstall")
    subprocess.run([str(update_exe), "--uninstall"], check=False)


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
    parser.add_argument(
        "--install",
        action="store_true",
        help="Windows: full package, build Squirrel installer (npm run make), and run Setup.exe",
    )
    parser.add_argument(
        "--uninstall",
        action="store_true",
        help="Windows: run Squirrel Update.exe --uninstall (no build)",
    )
    sub = parser.add_subparsers(dest="cmd", required=False)

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
    if args.install and args.uninstall:
        parser.error("use at most one of --install and --uninstall")
    if args.install:
        if args.cmd is not None:
            parser.error("--install cannot be combined with a subcommand")
        cmd_install_electron()
        return
    if args.uninstall:
        if args.cmd is not None:
            parser.error("--uninstall cannot be combined with a subcommand")
        cmd_uninstall_electron()
        return
    if not args.cmd:
        parser.error(
            "specify a command (package, build, install-desktop) "
            "or use --install / --uninstall alone"
        )
    args.func()


if __name__ == "__main__":
    main()
