import type { ManagedScenario, MissionLaunchMod } from '../../api/launchpad'

export function fullMissionName(s: ManagedScenario) {
  const base = (s.name ?? '').trim()
  const suf = (s.map_suffix ?? '').trim()
  if (!base && !suf) return '—'
  return `${base || '—'}.${suf || '—'}`
}

export function hasSymlinkPaths(s: ManagedScenario) {
  return Boolean(
    typeof s.project_path === 'string' &&
      s.project_path.trim() &&
      typeof s.profile_path === 'string' &&
      s.profile_path.trim(),
  )
}

export function parentDir(projectPath: string) {
  const x = projectPath.replace(/[/\\]+$/, '')
  const i = Math.max(x.lastIndexOf('/'), x.lastIndexOf('\\'))
  return i === -1 ? '' : x.slice(0, i)
}

export function defaultPboOutputFolder(projectPath: string | undefined): string {
  const p = (projectPath ?? '').trim()
  if (!p) return ''
  const root = parentDir(p)
  if (!root) return ''
  const sep = /\\/.test(p) && !/\//.test(p) ? '\\' : '/'
  return `${root.replace(/[/\\]+$/, '')}${sep}output`
}

export function missionModRowKey(m: MissionLaunchMod): string {
  const id = typeof m.id === 'string' ? m.id.trim() : ''
  return id || m.path
}
