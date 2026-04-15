# Installation Instructions

This document will guide you through setting up the development environment for Python and how to use the portable binary of the application.

## Python Development Setup

1. **Prerequisites**: Ensure you have Python 3.8+ installed on your machine. You can download it from [python.org](https://www.python.org/downloads/).
2. **Clone the Repository**: Run the following command to clone the repo to your local machine.
   ```bash
   git clone https://github.com/a3r0id/a3-mission-launchpad.git
   cd a3-mission-launchpad
   ```
3. **Create a Virtual Environment**: It’s recommended to use a virtual environment. You can create one using:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
4. **Install Dependencies**: Once the virtual environment is activated, install the server dependencies:
   ```bash
   pip install -r launchpad_server/requirements.txt
   ```
   To run **PyInstaller** packaging locally, also install `pip install pyinstaller Pillow` (Pillow converts `icon.png` to `.ico` on Windows; see `util.py` preflight).
5. **Run the Application**: You can start the application with:
   ```bash
   python -m launchpad_server
   ```

## Portable Binary Usage

For users who prefer not to set up a development environment, a portable binary is available.

> [!IMPORTANT]
> The packaged binary simply uses [PyInstaller](https://pyinstaller.org/en/stable/) to build a portable, Python-based executable. The executable is not signed and WILL cause the program to be flagged by your antivirus as unsafe. If you prefer to build your own portable executable then you can follow the steps to package your own executable.

**Install from GitHub**

1. Clone the repo or download it as an archive via the github website.

2. Jump into the repo directory and build the packaged output.

   Windows
   ```bash
   cd a3-mission-launchpad
   python util.py --build
   ```

   Linux/MacOS
   ```bash
   cd a3-mission-launchpad
   python3 util.py --build
   ```

**Build your own executable**

1. Clone the repo or download it as an archive via the github website.

2. Run the unified build CLI (includes web client, extension/mod, and packaging into `A3LaunchPad/`).

   Windows
   ```bash
   cd a3-mission-launchpad
   python util.py --build
   ```

   Linux/macOS
   ```bash
   cd a3-mission-launchpad
   python3 util.py --build
   ```

   Requirements: PyInstaller on `PATH`, Pillow for the Windows `.ico`, Node/npm, and build toolchain dependencies used by `util.py`.

## Publishing desktop builds to GitHub Releases

1. Bump `version.json` at the repo root and `launchpad_client/app/package.json` so they match (the in-app “Check for updates” compares your installed app version to `version.json` on the `main` branch).
2. Set a GitHub token with `repo` scope (`GITHUB_TOKEN`, `GH_TOKEN`, or `ELECTRON_FORGE_GITHUB_TOKEN`).
3. From the repo root, run `python util.py --publish` (this runs the full build pipeline first, then publishes via Electron Forge).

---

Feel free to reach out if you encounter any issues or have questions!
