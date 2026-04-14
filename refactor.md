# Ive refactored a ton of things regarding structure and naming

- launchpad_client
The electron app and renderer - the deliverable app will live in `A3LaunchPad\bin` or `A3LaunchPad\app`

- launchpad_mod
The companion mod and extension
The final deliverables will live in `A3LaunchPad\mod`, specifically
`A3LaunchPad/mod/addons/a3_launchpad_ext_core.pbo` (HEMTT-built PBO, not a loose folder)
`A3LaunchPad/mod/A3_LAUNCHPAD_EXT_x64.dll`
`A3LaunchPad/mod/A3_LAUNCHPAD_EXT_x64.so`

- launchpad_server
The headless python app that runs the main server and socket things - packaged using pyinstaller.
While this is a good solution, we need to start migrating backend functions over to Node via IPC calls instead.
this is automatically started when the electron app starts as well as stopped when the electron app exits.

- A3LaunchPad - The absolute source of truth for the current deliverables.
We need to implement installation and updates https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging