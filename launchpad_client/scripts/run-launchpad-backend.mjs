/**
 * Starts the Launchpad HTTP API for Electron/Vite dev.
 *
 * Order of preference:
 * 1. ``LAUNCHPAD_BACKEND_EXE`` — full path to the PyInstaller binary (or any server exe).
 * 2. PyInstaller onedir under the repo: ``A3LaunchPad/bin/A3MissionLaunchpadPython``
 *    / ``A3LaunchPad/bin/A3MissionLaunchpadPython.exe`` (run ``python package.py package`` after client build).
 * 3. Interpreter: ``LAUNCHPAD_PYTHON`` (or ``python`` / ``python3``) with ``python -m launchpad_server``
 *    from the repo root. Set ``LAUNCHPAD_USE_PYTHON=1`` to force this even if a frozen exe exists.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

function defaultFrozenBackend() {
  const base = path.join(repoRoot, 'A3LaunchPad', 'bin')
  if (process.platform === 'win32') {
    return path.join(base, 'A3MissionLaunchpadPython.exe')
  }
  return path.join(base, 'A3MissionLaunchpadPython')
}

const forcePython = ['1', 'true', 'yes'].includes(
  (process.env.LAUNCHPAD_USE_PYTHON ?? '').trim().toLowerCase(),
)

const fromEnv = process.env.LAUNCHPAD_BACKEND_EXE?.trim()
const frozenCandidate = fromEnv || defaultFrozenBackend()

if (!forcePython && existsSync(frozenCandidate)) {
  const cwd = path.dirname(frozenCandidate)
  const child = spawn(frozenCandidate, [], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      LAUNCHPAD_HEADLESS: '1',
    },
    shell: false,
  })
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
} else {
  const custom = process.env.LAUNCHPAD_PYTHON?.trim()
  const exe =
    custom ||
    (process.platform === 'win32' ? 'python' : 'python3')

  const child = spawn(exe, ['-m', 'launchpad_server'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      LAUNCHPAD_HEADLESS: '1',
    },
    shell: process.platform === 'win32',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}
