import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type Launchpad from '../../Launchpad';

const PROFILE_MISSION_SYMLINK_SUBDIR = 'A3Launchpad_missions';

function readProfilePath(settingsFile: string): string {
    try {
        const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Record<string, unknown>;
        return typeof raw.arma3_profile_path === 'string' ? raw.arma3_profile_path.trim() : '';
    } catch {
        return '';
    }
}

function realKey(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

function parseMissionFolderName(basename: string): { name: string; mapSuffix: string } {
    const i = basename.lastIndexOf('.');
    if (i <= 0 || i === basename.length - 1) {
        return { name: basename, mapSuffix: '' };
    }
    return { name: basename.slice(0, i), mapSuffix: basename.slice(i + 1) };
}

function isMissionContentDir(dir: string): boolean {
    const checks = ['description.ext', 'Description.ext', 'mission.sqm', 'MISSION.SQM', 'mission.biedi'];
    for (const c of checks) {
        if (fs.existsSync(path.join(dir, c))) return true;
    }
    return false;
}

export function syncManagedMissionsFromProfileHub(ctx: Launchpad): void {
    const profileRaw = readProfilePath(ctx.settingsFile);
    if (!profileRaw) return;
    const profilePath = path.resolve(profileRaw);
    if (!fs.existsSync(profilePath) || !fs.statSync(profilePath).isDirectory()) return;

    let all: Record<string, Record<string, unknown>>;
    try {
        const raw = JSON.parse(fs.readFileSync(ctx.managedMissionsFile, 'utf8'));
        all = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Record<string, unknown>>) : {};
    } catch {
        all = {};
    }

    const claimed = new Set<string>();
    for (const row of Object.values(all)) {
        if (!row || typeof row !== 'object') continue;
        const pp = typeof row.project_path === 'string' ? row.project_path.trim() : '';
        if (pp) claimed.add(realKey(pp));
    }

    let added = 0;
    const hubs: Array<{ missionType: 'mp' | 'sp'; absHub: string }> = [
        { missionType: 'mp', absHub: path.join(profilePath, 'mpmissions', PROFILE_MISSION_SYMLINK_SUBDIR) },
        { missionType: 'sp', absHub: path.join(profilePath, 'missions', PROFILE_MISSION_SYMLINK_SUBDIR) },
    ];

    for (const { missionType, absHub } of hubs) {
        if (!fs.existsSync(absHub) || !fs.statSync(absHub).isDirectory()) continue;
        let entries: string[] = [];
        try {
            entries = fs.readdirSync(absHub);
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry || entry === '.' || entry === '..') continue;
            if (entry.startsWith('.')) continue;
            const childAbs = path.join(absHub, entry);
            let st: fs.Stats;
            try {
                st = fs.statSync(childAbs);
            } catch {
                continue;
            }
            if (!st.isDirectory()) continue;
            if (!isMissionContentDir(childAbs)) continue;
            const rk = realKey(childAbs);
            if (claimed.has(rk)) continue;
            claimed.add(rk);
            const { name, mapSuffix } = parseMissionFolderName(entry);
            const missionFullname = entry;
            const id = randomUUID();
            all[id] = {
                name,
                map_suffix: mapSuffix,
                description: `Mission ${missionFullname}`,
                author: '',
                mission_type: missionType,
                generate_scripting_environment: false,
                project_path: path.resolve(childAbs),
                profile_path: profilePath,
                github_integration: false,
                launch_mods: [],
            };
            added += 1;
        }
    }

    if (added > 0) {
        fs.mkdirSync(path.dirname(ctx.managedMissionsFile), { recursive: true });
        const tmp = `${ctx.managedMissionsFile}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
        fs.renameSync(tmp, ctx.managedMissionsFile);
    }
}
