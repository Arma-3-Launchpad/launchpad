import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { IpcMainInvokeEvent } from 'electron';
import Launchpad from '../../Launchpad';

export type InstallHemttWingetResult =
  | { ok: true; exitCode: number; log: string }
  | { ok: false; error: string; log?: string; unsupported?: boolean };

function appendChunk(chunk: Buffer, carry: string, lines: string[]): string {
  let buf = carry + chunk.toString('utf8');
  const parts = buf.split(/\r?\n/);
  const rest = parts.pop() ?? '';
  for (const line of parts) {
    if (line.length) lines.push(line);
  }
  return rest;
}

function resolveWingetExe(): string {
  if (process.platform !== 'win32') return 'winget';
  const candidate = path.join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft',
    'WindowsApps',
    'winget.exe',
  );
  if (candidate.length > 20 && fs.existsSync(candidate)) return candidate;
  return 'winget';
}

export async function handleInstallHemttWinget(
  _ctx: Launchpad,
  _event: IpcMainInvokeEvent,
  _args: unknown,
): Promise<InstallHemttWingetResult> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'windowss only for now, but  should change later on.', unsupported: true }; 
  }

  const exe = resolveWingetExe();
  const logLines: string[] = [];

  return new Promise((resolve) => {
    const child = spawn(
      exe,
      [
        'install',
        'hemtt',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
      ],
      {
        windowsHide: true,
      },
    );

    let outCarry = '';
    let errCarry = '';
    child.stdout?.on('data', (ch: Buffer) => {
      outCarry = appendChunk(ch, outCarry, logLines);
    });
    child.stderr?.on('data', (ch: Buffer) => {
      errCarry = appendChunk(ch, errCarry, logLines);
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err?.code === 'ENOENT') {
        resolve({
          ok: false,
          error:
            'winget was not found. check install guide or ask ai',
          log: logLines.join('\n'),
        });
        return;
      }
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        log: logLines.join('\n'),
      });
    });
    child.on('close', (code) => {
      if (outCarry.trim()) logLines.push(outCarry.trim());
      if (errCarry.trim()) logLines.push(errCarry.trim());
      const exitCode = typeof code === 'number' ? code : 1;
      const log = logLines.join('\n');
      const lower = log.toLowerCase();
      const alreadyOk =
        exitCode !== 0 &&
        (lower.includes('no applicable upgrade') ||
          lower.includes('already installed') ||
          lower.includes('no newer package versions') ||
          lower.includes('a newer version was not found'));

      if (exitCode === 0 || alreadyOk) {
        resolve({ ok: true, exitCode: exitCode === 0 ? 0 : exitCode, log });
        return;
      }
      resolve({
        ok: false,
        error: 'ah shit here we go again, something went wrong. try again. ',
        log,
      });
    });
  });
}
