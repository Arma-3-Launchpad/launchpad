import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchManagedScenarios,
  launchManagedScenario,
  type ManagedScenario,
  type MissionLaunchMod,
} from '../api/launchpad'
import { pathForImportedHtmlMod } from '../mission/workshopModPath'
import { extractGameTypeFromDescriptionExt, missionDescriptionExtPath } from '../mission/descriptionExt'
import { MissionEditModal } from '../components/MissionEditModal'
import { ScriptEditorModal } from '../components/Editor/IntegratedScriptEditor'
import { MissionGitHubModal } from '../components/MissionGitHubModal'
import Util from '../Util'
import {
  DeleteMissionModal,
  ModsProfileModal,
  PboBuildModal,
  CreateMissionModal,
  MissionSearchBar,
  MissionListStats,
  MissionListTable,
  fullMissionName,
  hasSymlinkPaths,
  useMissionListPreferences,
  type MissionTableColumnId,
} from '../components/MissionList'
import '../components/MissionList/MissionList.less' // this is one of the best ways to keep styles sep

type SortDir = 'asc' | 'desc'

type MissionListPageProps = {
  onOpenSettings?: () => void
}

export function MissionListPage({ onOpenSettings }: MissionListPageProps) {
  const [scenarios, setScenarios] = useState<ManagedScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editMission, setEditMission] = useState<ManagedScenario | null>(null)
  const [githubMission, setGithubMission] = useState<ManagedScenario | null>(null)
  const [saveInfo, setSaveInfo] = useState<string | null>(null)

  const [pboMission, setPboMission] = useState<ManagedScenario | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedScenario | null>(null)
  const [modsMission, setModsMission] = useState<ManagedScenario | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [scriptEditor, setScriptEditor] = useState<{ root: string; title: string } | null>(null)
  const [scenarioGameTypes, setScenarioGameTypes] = useState<Record<string, string>>({})
  const [sortField, setSortField] = useState<MissionTableColumnId>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const {
    favoriteIds,
    toggleFavorite,
    columnWidths,
    setColumnWidth,
  } = useMissionListPreferences()

  useEffect(() => {
    let cancelled = false
    async function loadGameTypes() {
      const next: Record<string, string> = {}
      await Promise.all(
        scenarios.map(async (s) => {
          const root = s.project_path?.trim()
          if (!root) {
            next[s.id] = ''
            return
          }
          try {
            const text = await Util.getFileContents(missionDescriptionExtPath(root))
            if (!cancelled) next[s.id] = extractGameTypeFromDescriptionExt(text)
          } catch {
            if (!cancelled) next[s.id] = ''
          }
        }),
      )
      if (!cancelled) setScenarioGameTypes(next)
    }
    void loadGameTypes()
    return () => {
      cancelled = true
    }
  }, [scenarios])

  const filteredScenarios = useMemo(() => {
    if (!searchQuery.trim()) return scenarios
    const q = searchQuery.toLowerCase().trim()
    return scenarios.filter((s) => {
      const name = (s.name ?? '').toLowerCase()
      const author = (s.author ?? '').toLowerCase()
      const map = (s.map_suffix ?? '').toLowerCase()
      const type = (s.mission_type ?? '').toLowerCase()
      const gameType = (scenarioGameTypes[s.id] ?? '').toLowerCase()
      const desc = (s.description ?? '').toLowerCase()
      return (
        name.includes(q) ||
        author.includes(q) ||
        map.includes(q) ||
        type.includes(q) ||
        gameType.includes(q) ||
        desc.includes(q)
      )
    })
  }, [scenarios, searchQuery, scenarioGameTypes])

  const sortedScenarios = useMemo(() => {
    const copy = [...filteredScenarios]
    copy.sort((a, b) => {
      const fa = favoriteIds.has(a.id)
      const fb = favoriteIds.has(b.id)
      if (fa !== fb) return fa ? -1 : 1
      let aVal = ''
      let bVal = ''
      switch (sortField) {
        case 'name':
          aVal = (a.name ?? '').toLowerCase()
          bVal = (b.name ?? '').toLowerCase()
          break
        case 'author':
          aVal = (a.author ?? '').toLowerCase()
          bVal = (b.author ?? '').toLowerCase()
          break
        case 'map':
          aVal = (a.map_suffix ?? '').toLowerCase()
          bVal = (b.map_suffix ?? '').toLowerCase()
          break
        case 'type':
          aVal = (a.mission_type ?? '').toLowerCase()
          bVal = (b.mission_type ?? '').toLowerCase()
          break
        case 'gameType':
          aVal = (scenarioGameTypes[a.id] ?? '').toLowerCase()
          bVal = (scenarioGameTypes[b.id] ?? '').toLowerCase()
          break
        case 'status':
          aVal = hasSymlinkPaths(a) ? '1' : '0'
          bVal = hasSymlinkPaths(b) ? '1' : '0'
          break
      }
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filteredScenarios, sortField, sortDir, scenarioGameTypes, favoriteIds])

  function handleSort(field: MissionTableColumnId) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  async function runMission(scenario: ManagedScenario) {
    setSaveInfo(null)
    const res = await launchManagedScenario(scenario.id)
    if ('error' in res) {
      setLoadError(res.error)
      return
    }
    setLoadError(null)
    setSaveInfo(
      res.message ??
        `Started Arma 3 for ${fullMissionName(scenario)}${res.modsApplied ? ` with ${res.modsApplied} mod(s)` : ''}.`,
    )
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchManagedScenarios()
      setScenarios(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load missions')
      setScenarios([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function handleModsUpdated(missionId: string, mods: MissionLaunchMod[]) {
    setScenarios((prev) => prev.map((x) => (x.id === missionId ? { ...x, launch_mods: mods } : x)))
  }

  function handleDeleteComplete() {
    if (editMission?.id === deleteTarget?.id) setEditMission(null)
    if (githubMission?.id === deleteTarget?.id) setGithubMission(null)
    setDeleteTarget(null)
    void load()
  }

  return (
    <div className="mission-page">
      <ScriptEditorModal
        open={scriptEditor !== null}
        projectRoot={scriptEditor?.root ?? ''}
        contextTitle={scriptEditor?.title ?? ''}
        environment="mission"
        onClose={() => setScriptEditor(null)}
      />

      {createOpen && (
        <CreateMissionModal
          onClose={() => setCreateOpen(false)}
          onOpenSettings={onOpenSettings}
          onCreated={(res) => {
            setSaveInfo(`Mission created at ${res.mission_path ?? 'project folder'} (${res.mission_id ?? 'managed'}).`)
            void load()
          }}
        />
      )}

      {editMission && (
        <MissionEditModal
          key={editMission.id}
          mission={editMission}
          onClose={() => setEditMission(null)}
          onMissionUpdated={(m) => setEditMission(m)}
          onSaved={() => {
            void load()
            setSaveInfo('Mission updated.')
          }}
        />
      )}

      {githubMission && (
        <MissionGitHubModal
          key={githubMission.id}
          mission={githubMission}
          onClose={() => setGithubMission(null)}
          onAfterCommit={() => void load()}
          onOpenSettings={
            onOpenSettings
              ? () => {
                  setGithubMission(null)
                  onOpenSettings()
                }
              : undefined
          }
        />
      )}

      {modsMission && (
        <ModsProfileModal
          mission={modsMission}
          onClose={() => setModsMission(null)}
          onModsUpdated={(mods) => handleModsUpdated(modsMission.id, mods)}
        />
      )}

      {deleteTarget && (
        <DeleteMissionModal
          mission={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleteComplete}
        />
      )}

      {pboMission && (
        <PboBuildModal
          mission={pboMission}
          onClose={() => setPboMission(null)}
        />
      )}

      <header className="mission-page-header">
        <div className="mission-page-title-row">
          <h1 className="mission-page-title">Missions</h1>
          <MissionSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            disabled={loading}
          />
          <MissionListStats
            total={scenarios.length}
            visible={sortedScenarios.length}
            hasFilter={Boolean(searchQuery.trim())}
          />
        </div>
        <div className="mission-page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            + New Mission
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>

      {loadError && (
        <p className="form-banner form-banner-error mission-page-banner" role="alert">
          {loadError}
        </p>
      )}
      {saveInfo && !editMission && (
        <p className="form-banner form-banner-success mission-page-banner" role="status">
          {saveInfo}
        </p>
      )}

      {loading && <p className="mission-page-empty">Loading…</p>}

      {!loading && scenarios.length === 0 && !loadError && (
        <p className="mission-page-empty">No managed missions yet.</p>
      )}

      {!loading && scenarios.length > 0 && sortedScenarios.length === 0 && (
        <p className="mission-page-empty">No missions match "{searchQuery}"</p>
      )}

      {!loading && sortedScenarios.length > 0 && (
        <MissionListTable
          scenarios={sortedScenarios}
          scenarioGameTypes={scenarioGameTypes}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          columnWidths={columnWidths}
          onResizeColumn={setColumnWidth}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          loading={loading}
          onRunMission={(s) => void runMission(s)}
          onEdit={setEditMission}
          onDelete={setDeleteTarget}
          onMods={setModsMission}
          onPbo={setPboMission}
          onGithub={setGithubMission}
          onScriptEditor={(root, title) => setScriptEditor({ root, title })}
        />
      )}
    </div>
  )
}
