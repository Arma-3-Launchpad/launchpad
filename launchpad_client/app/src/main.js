import { app, BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

/** PyInstaller backend started when running a packaged app (dev uses ``run-launchpad-backend.mjs``). */
let pythonBackendChild = null;

function startPackagedPythonBackend() {
  if (!app.isPackaged) {
    return;
  }
  const binDir = path.join(process.resourcesPath, 'bin');
  const exeName =
    process.platform === 'win32'
      ? 'A3MissionLaunchpadPython.exe'
      : 'A3MissionLaunchpadPython';
  const exePath = path.join(binDir, exeName);
  if (!fs.existsSync(exePath)) {
    console.error(`[Launchpad] Backend not found. From the repo root run: python package.py package`);
    return;
  }
  pythonBackendChild = spawn(exePath, [], {
    cwd: binDir,
    stdio: 'inherit',
    env: { ...process.env, LAUNCHPAD_HEADLESS: '1' },
    shell: false,
  });
  pythonBackendChild.on('error', (err) => {
    console.error('[Launchpad] Failed to start Python backend:', err);
  });
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  startPackagedPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (pythonBackendChild && !pythonBackendChild.killed) {
    pythonBackendChild.kill();
    pythonBackendChild = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
