## Goal

Keep building and updating end-user deliverables quick and predictable, with a clear split between what a **Linux CI runner** can do and what needs a **Windows (or your) machine** for the native Arma extension.

---

## What ships where (this repo)

| Deliverable | Source | Ends up in | How today |
|-------------|--------|--------------|-----------|
| **Desktop app (PyInstaller)** | `launchpad/`, bundled data | `bin/A3MissionLaunchpad.exe` (+ `bin/_internal/…`) | `python package.py build` (see `launchpad.spec`) |
| **Web UI (static)** | `launchpad_client/dist` | **`bin/_internal/web_dist/`** inside the PyInstaller bundle | Declared in `launchpad.spec` as `datas=[(…/dist, "web_dist"), …]` — not a separate manual copy step |
| **Mod + extension layout** | `mod/`, `extension/` | **`bin/mod/`** (target layout for players / packaging) | CMake post-build is moving toward copying the extension binary + deps under `bin/mod/`; HEMTT (or your mod build) should emit PBOs/addons into the same tree you ship |

**Web dist detail:** `npm run build` in `launchpad_client` must run **before** `package.py build`. PyInstaller packs `launchpad_client/dist` as the `web_dist` tree; at runtime `launchpad/__main__.py` loads from `_bundle_root()/web_dist` (frozen) or dev `launchpad_client/dist`.

---

## Suggested release order (local “full” drop)

1. **Client:** `cd launchpad_client && npm ci && npm run build`
2. **Extension:** Windows MSVC build → ensure `A3_LAUNCHPAD_EXT_x64.dll` (+ runtime deps) land under **`bin/mod/`** per your packaging rules.
3. **Mod:** HEMTT (or equivalent) from `mod/` → copy built addons/PBOs into **`bin/mod/addons/`** (or whatever layout you standardize).
4. **Installer folder:** `python package.py build` at repo root (PyInstaller `onedir` into `bin/`).

`package.py` today only runs PyInstaller; it does **not** invoke CMake or HEMTT — add a thin `package.py release` (or a `justfile` / `Makefile` target) if you want one command.

---

## Linux runner vs Windows extension

- **Linux CI is fine for:** version bumps, GitHub releases, **Linux `.so` extension`** (your CMake `UNIX` branch), static checks, **maybe** a Linux desktop PyInstaller build for developers (not the same as the Windows player build).
- **Windows `.dll` extension** realistically needs **MSVC on Windows** (self-hosted runner, or build on your PC and **upload release artifacts**). Cross-compiling that DLL from Linux is usually more pain than value unless you already maintain a MinGW/cross toolchain that matches Arma’s expectations.
- **Wine:** possible for *some* native builds, rarely worth it for a MSVC + WinSSL + Arma-linked extension unless you enjoy yak shaving.

**Practical split:** CI on Linux produces **Linux extension + mod PBOs** (if HEMTT runs there); a **Windows job** (or manual step) produces **`A3_LAUNCHPAD_EXT_x64.dll`** and drops it into `bin/mod/`. Release archives can combine artifacts from both jobs.

---

## GitHub Actions note

`/.github/workflows/main-release.yml` currently handles **versioning + draft release**, not full binary builds. Add separate workflow jobs (or attach artifacts from your Windows build) when you are ready to automate mod/exe assembly.
