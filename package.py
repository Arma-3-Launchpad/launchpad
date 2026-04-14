#!/usr/bin/env python3
"""
Build and desktop-install helpers for A3 Mission Launchpad.

Prefer this entrypoint over the deprecated *.bat / *.sh wrappers.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

def _repo_root() -> Path:
    return Path(__file__).resolve().parent


def _die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def _which_pyinstaller() -> str | None:
    return shutil.which("pyinstaller")


def _preflight_build(root: Path) -> None:
    dist_index = root / "launchpad_client" / "dist" / "index.html"
    if not dist_index.is_file():
        _die(
            "Missing launchpad_client/dist. Run: cd launchpad_client && npm run build"
        )
    hero = root / "launchpad_client" / "src" / "assets" / "hero.png"
    if not hero.is_file():
        _die("Missing launchpad_client/src/assets/hero.png (PNG splash for PyInstaller)")
    icon = root / "icon.png"
    if not icon.is_file():
        _die("Missing icon.png (EXE icon; converted to .ico during PyInstaller on Windows)")
    try:
        import PIL  # noqa: F401
    except ImportError:
        _die("Pillow is required (icon conversion / packaging). Run: pip install Pillow")


def _stop_running_app() -> None:
    """PyInstaller clears ``bin``; stop the app so COLLECT does not hit locked files."""
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/IM", "A3MissionLaunchpad.exe", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)
        return
    for args in (
        ["pkill", "-x", "A3MissionLaunchpad"],
        ["pkill", "-f", "/bin/A3MissionLaunchpad"],
    ):
        subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)


def cmd_package(root: Path) -> None:
    _preflight_build(root)
    exe = _which_pyinstaller()
    if not exe:
        _die("PyInstaller not found on PATH. Run: pip install pyinstaller")
    spec = root / "launchpad.spec"
    if not spec.is_file():
        _die(f"Missing {spec.name} at repository root")
    print("Stopping A3MissionLaunchpad if it is running...")
    _stop_running_app()
    subprocess.run(
        [exe, "--noconfirm", "--distpath", "bin", "--workpath", "build", str(spec)],
        cwd=root,
        check=True,
    )


def _ps_single_quoted(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def _install_desktop_windows(root: Path) -> None:
    exe = root / "bin" / "A3MissionLaunchpad.exe"
    work = root / "bin"
    if not exe.is_file():
        _die(f"Missing packaged app at {exe}. Build first: python package.py build")
    tp = _ps_single_quoted(str(exe))
    wd = _ps_single_quoted(str(work))
    script = (
        f"$ws = New-Object -ComObject WScript.Shell; "
        f"$path = Join-Path ([Environment]::GetFolderPath('Desktop')) 'A3 Mission Launchpad.lnk'; "
        f"$s = $ws.CreateShortcut($path); "
        f"$s.TargetPath = {tp}; "
        f"$s.WorkingDirectory = {wd}; "
        f"$s.Description = 'A3 Mission Launchpad'; "
        f"$s.Save(); "
        f"Write-Host ('Shortcut: ' + $path)"
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        cwd=root,
        check=True,
    )


def _desktop_escape_spaces(path: str) -> str:
    return path.replace(" ", "\\s")


def _desktop_dir() -> Path:
    env = os.environ.get("XDG_DESKTOP_DIR", "").strip()
    if env:
        p = Path(env)
        if p.is_dir():
            return p
    if sys.platform != "win32" and shutil.which("xdg-user-dir"):
        try:
            out = subprocess.run(
                ["xdg-user-dir", "DESKTOP"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            if out:
                p = Path(out)
                if p.is_dir():
                    return p
        except (subprocess.CalledProcessError, OSError):
            pass
    fallback = Path.home() / "Desktop"
    if fallback.is_dir():
        return fallback
    _die(
        "Desktop folder not found (tried XDG_DESKTOP_DIR, xdg-user-dir, ~/Desktop)."
    )


def _install_desktop_unix(root: Path) -> None:
    bin_path = root / "bin" / "A3MissionLaunchpad"
    workdir = root / "bin"
    if not bin_path.is_file():
        _die(f"Missing packaged app at {bin_path}. Build first: python package.py build")
    try:
        bin_path.chmod(bin_path.stat().st_mode | 0o111)
    except OSError:
        pass
    desktop = _desktop_dir()
    out = desktop / "a3-mission-launchpad.desktop"
    exec_esc = _desktop_escape_spaces(str(bin_path))
    path_esc = _desktop_escape_spaces(str(workdir))
    lines = [
        "[Desktop Entry]",
        "Version=1.0",
        "Type=Application",
        "Name=A3 Mission Launchpad",
        "Comment=Arma 3 mission launchpad",
        f"Exec={exec_esc}",
        f"Path={path_esc}",
        "Terminal=true",
        "Categories=Game;",
    ]
    icon = root / "icon.png"
    if icon.is_file():
        lines.append(f"Icon={_desktop_escape_spaces(str(icon))}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        out.chmod(out.stat().st_mode | 0o111)
    except OSError:
        pass
    print(f"Wrote: {out}")


def cmd_install_desktop(root: Path) -> None:
    if sys.platform == "win32":
        _install_desktop_windows(root)
    else:
        _install_desktop_unix(root)

def cmd_build_all(root: Path) -> None:

    # build the js client
    subprocess.run(["npm", "run", "build"], cwd=root / "launchpad_client", check=True)
    # build the extension
    subprocess.run(["cmake", "--build", "extension", "--config", "Release"], cwd=root, check=True)
    # build the mod
    subprocess.run(["hemtt", "build"], cwd=root / "mod", check=True)

    # package the app
    cmd_package(root)

def main(argv: list[str] | None = None) -> None:
    root = _repo_root()
    parser = argparse.ArgumentParser(
        description="A3 Mission Launchpad: build packaged app and desktop shortcuts."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_build_all = sub.add_parser("build-all", help="Build all deliverables - supplements where it can't, IE Windows build is done on my pc, linux build is done on the runner, and mod is built via HEMTT.");
    p_build_all.set_defaults(func=lambda _: cmd_build_all(root))

    p_build = sub.add_parser("package", help="Run PyInstaller (onedir under bin/)")
    p_build.set_defaults(func=lambda _: cmd_package(root))

    p_desk = sub.add_parser(
        "install-desktop",
        help="Create a desktop shortcut (.lnk on Windows, .desktop on Linux/macOS)",
    )
    p_desk.set_defaults(func=lambda _: cmd_install_desktop(root))

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
