import os
import subprocess
import sys


def _run_cmd(argv: list[str], *, cwd: str) -> None:
    """Run a CLI. On Windows, ``npm`` / ``hemtt`` are often ``.cmd`` shims; use the shell so they resolve like in an interactive prompt."""
    if sys.platform == "win32":
        # Quote args that may contain spaces (e.g. repo path).
        line = subprocess.list2cmdline(argv)
        subprocess.run(line, cwd=cwd, shell=True, check=True)
    else:
        subprocess.run(argv, cwd=cwd, check=True)


def main():
    repo_root = os.path.dirname(os.path.abspath(__file__))
    renderer = os.path.join(repo_root, "launchpad_client", "renderer")
    mod_root = os.path.join(repo_root, "launchpad_mod")

    # build the renderer (static files consumed by launchpad_server / PyInstaller)
    _run_cmd(["npm", "run", "build"], cwd=renderer)

    # build the native extension (CMake)
    ext_dir = os.path.join(repo_root, "launchpad_mod", "extension")
    ext_build = os.path.join(ext_dir, "build")
    configure = ["cmake", "-B", ext_build, "-S", ext_dir]
    if sys.platform != "win32":
        configure += ["-DCMAKE_BUILD_TYPE=Release"]
    subprocess.run(configure, cwd=repo_root, check=True)
    build_cmd = ["cmake", "--build", ext_build, "--parallel"]
    if sys.platform == "win32":
        build_cmd += ["--config", "Release"]
    subprocess.run(build_cmd, cwd=repo_root, check=True)

    # build the mod (HEMTT)
    _run_cmd(["hemtt", "build"], cwd=mod_root)

    # package the app (same interpreter as this script)
    subprocess.run([sys.executable, "package.py", "package"], cwd=repo_root, check=True)

if __name__ == "__main__":
    main()