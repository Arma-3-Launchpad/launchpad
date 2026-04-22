/**
 * This file is used to detect the paths to the Arma 3 game and tools.
 * It is used to populate the settings page with the paths to the game and tools.
 * 04-20-2026 - wade
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export type DetectedArmaPaths = {
  arma3_path: string;
  arma3_tools_path: string;
  arma3_profile_path: string;
  arma3_appdata_path: string;
};

function isDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isArma3GameRoot(dir: string): boolean {
  if (!isDir(dir)) return false;
  const exes = ['arma3_x64.exe', 'arma3.exe'];
  return exes.some((n) => {
    try {
      const f = path.join(dir, n);
      return fs.existsSync(f) && fs.statSync(f).isFile();
    } catch {
      return false;
    }
  });
}

function unescapeVdfPath(raw: string): string {
  return raw.replace(/\\\\/g, '\\').replace(/\/+$/, '');
}

function pathsFromLibraryFoldersVdf(content: string): string[] {
  const out: string[] = [];
  const re = /"path"\s+"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const p = unescapeVdfPath(m[1]).trim();
    if (p.length > 0) out.push(p);
  }
  return out;
}

function readLibraryRootsFromVdfFile(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return pathsFromLibraryFoldersVdf(content);
  } catch {
    return [];
  }
}

function windowsSteamInstallFromRegistry(): string | null {
  if (os.platform() !== 'win32') return null;
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { encoding: 'utf8', windowsHide: true },
    );
    const line = out.split(/\r?\n/).find((l) => l.includes('SteamPath'));
    if (!line) return null;
    const parts = line.trim().split(/\s{2,}/);
    const value = parts[parts.length - 1]?.trim();
    if (!value) return null;
    return path.normalize(value.replace(/[/\\]+$/, ''));
  } catch {
    return null;
  }
}

function defaultSteamRootCandidates(): string[] {
  const roots: string[] = [];
  if (os.platform() === 'win32') {
    const pf = process.env['ProgramFiles'];
    const pf86 = process.env['ProgramFiles(x86)'];
    if (pf86) roots.push(path.join(pf86, 'Steam'));
    if (pf) roots.push(path.join(pf, 'Steam'));
    const reg = windowsSteamInstallFromRegistry();
    if (reg) roots.push(reg);
  } else if (os.platform() === 'darwin') {
    roots.push(path.join(os.homedir(), 'Library', 'Application Support', 'Steam'));
  } else {
    roots.push(path.join(os.homedir(), '.local', 'share', 'Steam'));
    roots.push(path.join(os.homedir(), '.steam', 'steam'));
    roots.push(path.join(os.homedir(), '.steam', 'root'));
  }
  return roots;
}

function collectSteamLibraryRoots(): string[] {
  const seen = new Set<string>();
  const add = (p: string) => {
    const n = path.normalize(p);
    if (n.length > 0 && !seen.has(n)) seen.add(n);
  };

  for (const steamRoot of defaultSteamRootCandidates()) {
    if (!isDir(steamRoot)) continue;
    add(steamRoot);
    for (const rel of [
      path.join('config', 'libraryfolders.vdf'),
      path.join('steamapps', 'libraryfolders.vdf'),
    ]) {
      for (const lib of readLibraryRootsFromVdfFile(path.join(steamRoot, rel))) {
        add(lib);
      }
    }
  }

  return [...seen];
}

function arma3GameFromLibraryRoot(libRoot: string): string {
  return path.join(libRoot, 'steamapps', 'common', 'Arma 3');
}

function findArma3Install(): string {
  for (const lib of collectSteamLibraryRoots()) {
    const candidate = arma3GameFromLibraryRoot(lib);
    if (isArma3GameRoot(candidate)) return candidate;
  }
  return '';
}

function toolsFromGameRoot(gameRoot: string): string {
  const common = path.dirname(gameRoot);
  return path.join(common, 'Arma 3 Tools');
}

function findArma3Tools(gameRoot: string): string {
  if (!gameRoot) return '';
  const t = toolsFromGameRoot(gameRoot);
  return isDir(t) ? t : '';
}

function hasArma3ProfileMarker(profileDir: string): boolean {
  try {
    return fs.readdirSync(profileDir).some((n) => n.endsWith('.Arma3Profile'));
  } catch {
    return false;
  }
}

function profileFolderScore(full: string): number {
  const hasM = isDir(path.join(full, 'missions'));
  const hasMp = isDir(path.join(full, 'mpmissions'));
  if (hasM && hasMp) return 3;
  if (hasM || hasMp) return 2;
  if (hasArma3ProfileMarker(full)) return 1;
  return 0;
}

type ScoredProfile = { full: string; score: number; mtime: number; name: string };

function bestUnderOtherProfiles(otherProfilesDir: string): ScoredProfile | null {
  if (!isDir(otherProfilesDir)) return null;
  let best: ScoredProfile | null = null;
  try {
    for (const name of fs.readdirSync(otherProfilesDir)) {
      if (name === '.' || name === '..') continue;
      const full = path.join(otherProfilesDir, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const score = profileFolderScore(full);
      if (score === 0) continue;
      const row: ScoredProfile = { full, score, mtime: st.mtimeMs, name };
      if (
        !best ||
        row.score > best.score ||
        (row.score === best.score && row.mtime > best.mtime) ||
        (row.score === best.score && row.mtime === best.mtime && row.name.localeCompare(best.name) < 0)
      ) {
        best = row;
      }
    }
  } catch {
    return null;
  }
  return best;
}

function bestDefaultArma3Docs(arma3DocsDir: string): ScoredProfile | null {
  if (!isDir(arma3DocsDir)) return null;
  const score = profileFolderScore(arma3DocsDir);
  if (score === 0) return null;
  let st: fs.Stats;
  try {
    st = fs.statSync(arma3DocsDir);
  } catch {
    return null;
  }
  return { full: arma3DocsDir, score, mtime: st.mtimeMs, name: '' };
}

function collectDocumentsRoots(preferredDocuments?: string): string[] {
  const seen = new Set<string>();
  const add = (p: string) => {
    const n = path.normalize(p.trim());
    if (n.length > 0 && !seen.has(n)) seen.add(n);
  };
  if (preferredDocuments) add(preferredDocuments);
  add(path.join(os.homedir(), 'Documents'));
  if (os.platform() === 'win32') {
    add(path.join(os.homedir(), 'OneDrive', 'Documents'));
  }
  return [...seen];
}

function pickBetter(a: ScoredProfile | null, b: ScoredProfile | null): ScoredProfile | null {
  if (!a) return b;
  if (!b) return a;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  if (b.mtime !== a.mtime) return b.mtime > a.mtime ? b : a;
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName <= 0 ? a : b;
  return a.full.localeCompare(b.full) <= 0 ? a : b;
}

function findBestProfileFolderWinMac(documentsRoots: string[]): string {
  let best: ScoredProfile | null = null;
  for (const docs of documentsRoots) {
    const other = path.join(docs, 'Arma 3 - Other Profiles');
    best = pickBetter(best, bestUnderOtherProfiles(other));
    best = pickBetter(best, bestDefaultArma3Docs(path.join(docs, 'Arma 3')));
  }
  return best?.full ?? '';
}

function findBestProfileFolder(documentsRoots: string[]): string {
  if (os.platform() === 'win32' || os.platform() === 'darwin') {
    return findBestProfileFolderWinMac(documentsRoots);
  }

  if (os.platform() === 'linux') {
    const prefix = path.join(os.homedir(), '.local', 'share', 'bohemiainteractive', 'Arma 3');
    let best: ScoredProfile | null = null;
    if (isDir(prefix)) {
      try {
        for (const name of fs.readdirSync(prefix)) {
          const full = path.join(prefix, name);
          let st: fs.Stats;
          try {
            st = fs.statSync(full);
          } catch {
            continue;
          }
          if (!st.isDirectory()) continue;
          const score = profileFolderScore(full);
          if (score === 0) continue;
          const row: ScoredProfile = { full, score, mtime: st.mtimeMs, name };
          best = pickBetter(best, row);
        }
      } catch {
        return '';
      }
    }
    if (best) return best.full;
  }

  return '';
}

function defaultAppDataFolder(): string {
  if (os.platform() === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Arma 3');
  }
  if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Arma 3');
  }
  return path.join(os.homedir(), '.local', 'share', 'Arma 3');
}

export function detectArmaPaths(documentsPath?: string): DetectedArmaPaths {
  const arma3_path = findArma3Install();
  const arma3_tools_path = findArma3Tools(arma3_path);
  const docsRoots = collectDocumentsRoots(
    typeof documentsPath === 'string' && documentsPath.trim() ? documentsPath : undefined,
  );
  const arma3_profile_path = findBestProfileFolder(docsRoots);
  const arma3_appdata_path = defaultAppDataFolder();
  return {
    arma3_path,
    arma3_tools_path,
    arma3_profile_path,
    arma3_appdata_path,
  };
}
