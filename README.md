# A3 Mission Launchpad

[![Extension CI (main)](https://github.com/a3r0id/a3-mission-launchpad/actions/workflows/extension-ci.yml/badge.svg?branch=main)](https://github.com/a3r0id/a3-mission-launchpad/actions/workflows/extension-ci.yml?query=branch%3Amain)

The badge reflects the latest **main** run. For another branch, open [Actions → Extension CI](https://github.com/a3r0id/a3-mission-launchpad/actions/workflows/extension-ci.yml) and select the branch filter.

![Launchpad](launchpad.png)

**Launchpad** is a robust suite of tools to aid Arma 3 mission makers and eventually modders. Launchpad features project organization/resource tracking, scripting, and soft-profiling - both in-game and out. There is a lot of tooling out there for mod makers; This project focuses on **mission makers**, at least to begin with. The main purpose of Launchpad is to fill the gap that Arma 3 Tools and 3Den lack, that Enfusion showed us. 

If you are new here: you do **not** need to be a programmer to use the packaged app. If you want to change the app itself or run from source, the [installation guide](docs/INSTALLATION.md) walks through Python, a virtual environment, and running the app from the `launchpad_server` package (for example `python -m launchpad_server` from the repo root).

---

## Get set up first

Before the steps below, install Launchpad using whichever path fits you:

- **Download a release** — easiest if you just want the app: see [releases](https://github.com/a3r0id/a3-mission-launchpad/releases) and the “portable binary” section in [Installation](docs/INSTALLATION.md).
- **Run from this repo** — clone the project, create a venv, `pip install -r launchpad_server/requirements.txt`, then run `python -m launchpad_server` from the project root (details in [Installation](docs/INSTALLATION.md)). The **packaged desktop app** for releases is built with **PyInstaller** (`python package.py package` or `python package.py build` after building the web client; see `launchpad.spec` and [Installation](docs/INSTALLATION.md)).

---

## Quick start (after Launchpad is running)

### Create a new mission

1. Start Launchpad (double-click the packaged executable, or `python -m launchpad_server` from the repo if you are developing).
2. In the main menu, choose **Create New Scenario**.
3. Fill in the form and confirm.
4. Your mission shows up under **Managed Missions**.

### Open and edit a mission

1. Start Launchpad if it is not already open.
2. Open **Managed Missions** and pick your scenario.
3. Adjust settings and macros in the main view.
4. Use the resource browser to open files in your own editor (VS Code, Notepad++, etc.).

### Put the mission on GitHub

1. Open **Managed Missions** and select your scenario.
2. Click **Add Project to GitHub** and follow the prompts.
3. When it succeeds, the version control area updates with your repo.

### Run tests

1. Open **Managed Missions** and select your scenario.
2. Open the **Testing** tab and run the checks for your project.

---

## What you get

- A **build workflow** aimed at Arma 3 scenarios, not generic “some folder of files.”
- **Consistent project layout** so missions stay easier to navigate and hand off.
- A **testing** tab so you can catch issues without only relying on in-game trial and error.
- **GitHub integration** when you are ready for backups and collaboration.
- A **graphical interface** so common tasks do not depend on memorizing commands.

---

## Electron + Vite (optional dev shell)

From `launchpad_client/app`, `npm run dev` starts the API and opens the Electron window with the Vite renderer. The dev helper prefers a **PyInstaller** build under `A3LaunchPad/bin/` when it exists (same layout as releases); otherwise it runs `python -m launchpad_server`. Set `LAUNCHPAD_USE_PYTHON=1` to always use the interpreter, or `LAUNCHPAD_BACKEND_EXE` to point at a specific binary.

`python package.py package` (and `python build.py`) stages **`A3LaunchPad/web_dist`**, **`A3LaunchPad/bin`**, **`A3LaunchPad/mod`**, and runs Electron Forge **`package`** into a fresh **`build/electron-forge-*`** folder (avoids Windows file locks on **`launchpad_client/app/out`**), then copies that output to **`A3LaunchPad/app`**. The frozen Python server loads the UI from `web_dist` beside `bin`, and stores **`launchpad_data`** at **`A3LaunchPad/launchpad_data`**. For installers, run `npm run make` in `launchpad_client/app` after a full package; use **`npm run publish`** with a GitHub token to push to Releases (see [Installation](docs/INSTALLATION.md)). In the desktop app, **Settings → Check for updates** compares your version to **`version.json`** on `main` and can open the latest release download page.

---

## Need help?

Open an issue on [GitHub](https://github.com/a3r0id/a3-mission-launchpad/issues) for bugs, questions, or ideas. Include what you tried and what you expected to happen—that makes it much easier to help.
