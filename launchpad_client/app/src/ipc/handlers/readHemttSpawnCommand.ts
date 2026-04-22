import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function readHemttPathFromSettings(settingsFile: string): string {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Record<string, unknown>;
    const p = typeof raw.hemtt_path === 'string' ? raw.hemtt_path.trim() : '';
    return p;
  } catch {
    return '';
  }
}

function findHemttExeUnder(dir: string, maxDepth: number): string | null {
  if (maxDepth <= 0) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === 'hemtt.exe') {
      return full;
    }
    if (e.isDirectory()) {
      const hit = findHemttExeUnder(full, maxDepth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

function findHemttInWinGetPackages(): string | null {
  const packagesRoot = path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'WinGet',
    'Packages',
  );
  if (!fs.existsSync(packagesRoot)) return null;
  let names: string[];
  try {
    names = fs.readdirSync(packagesRoot);
  } catch {
    return null;
  }
  for (const name of names) {
    if (!/hemtt/i.test(name)) continue;
    const pkgDir = path.join(packagesRoot, name);
    try {
      if (!fs.statSync(pkgDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const found = findHemttExeUnder(pkgDir, 8);
    if (found) return found;
  }
  return null;
}

function resolveHemttOnWindows(): string | null {
  const links = path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'WinGet',
    'Links',
    'hemtt.exe',
  );
  if (links.length > 20 && fs.existsSync(links)) return links;

  const fromPackages = findHemttInWinGetPackages();
  if (fromPackages) return fromPackages;

  try {
    const out = execFileSync(
      'where.exe',
      ['hemtt'],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 },
    );
    const first = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.length > 0 && s.toLowerCase().endsWith('.exe'));
    if (first && fs.existsSync(first)) return first;
  } catch {
    /* PATH may not list hemtt yet */
  }

  return null;
}

export function readHemttSpawnCommand(settingsFile: string): string {
  const fromSettings = readHemttPathFromSettings(settingsFile);
  if (fromSettings) return fromSettings;

  if (process.platform === 'win32') {
    const resolved = resolveHemttOnWindows();
    if (resolved) return resolved;
  }

  return 'hemtt';
}
