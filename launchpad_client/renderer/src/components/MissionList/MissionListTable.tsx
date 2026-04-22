import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons'
import type { ManagedScenario } from '../../api/launchpad'
import { hasSymlinkPaths, fullMissionName } from './missionUtils'
import type { MissionTableColumnId } from './missionListPreferences'
import { DEFAULT_COLUMN_ORDER, DEFAULT_COLUMN_WIDTHS } from './missionListPreferences'
import { MissionContextMenu } from './MissionContextMenu'

export type MissionListSortField = MissionTableColumnId
export type MissionListSortDir = 'asc' | 'desc'

type ContextMenuState = {
  mission: ManagedScenario
  position: { x: number; y: number }
} | null

type MissionListTableProps = {
  scenarios: ManagedScenario[]
  scenarioGameTypes: Record<string, string>
  favoriteIds: Set<string>
  onToggleFavorite: (missionId: string) => void
  columnWidths: Record<MissionTableColumnId, number>
  onResizeColumn: (id: MissionTableColumnId, widthPx: number) => void
  sortField: MissionListSortField
  sortDir: MissionListSortDir
  onSort: (field: MissionListSortField) => void
  loading: boolean
  onRunMission: (s: ManagedScenario) => void
  onEdit: (s: ManagedScenario) => void
  onDelete: (s: ManagedScenario) => void
  onMods: (s: ManagedScenario) => void
  onPbo: (s: ManagedScenario) => void
  onGithub: (s: ManagedScenario) => void
  onScriptEditor: (root: string, title: string) => void
}

const COL_LABEL: Record<MissionTableColumnId, string> = {
  name: 'Name',
  author: 'Author',
  map: 'Map',
  type: 'Type',
  gameType: 'Game',
  status: 'Status',
}

export function MissionListTable({
  scenarios,
  scenarioGameTypes,
  favoriteIds,
  onToggleFavorite,
  columnWidths,
  onResizeColumn,
  sortField,
  sortDir,
  onSort,
  loading,
  onRunMission,
  onEdit,
  onDelete,
  onMods,
  onPbo,
  onGithub,
  onScriptEditor,
}: MissionListTableProps) {
  const resizeState = useRef<{ id: MissionTableColumnId; startX: number; startW: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  function handleRowContextMenu(e: React.MouseEvent, scenario: ManagedScenario) {
    e.preventDefault()
    setContextMenu({ mission: scenario, position: { x: e.clientX, y: e.clientY } })
  }

  function handleRowDoubleClick(scenario: ManagedScenario) {
    onEdit(scenario)
  }

  const getSortIcon = useCallback(
    (field: MissionListSortField) => {
      if (sortField !== field) return faSort
      return sortDir === 'asc' ? faSortUp : faSortDown
    },
    [sortField, sortDir],
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const st = resizeState.current
      if (!st) return
      const dx = e.clientX - st.startX
      onResizeColumn(st.id, st.startW + dx)
    }
    function onUp() {
      resizeState.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [onResizeColumn])

  function startResize(e: React.MouseEvent, id: MissionTableColumnId) {
    e.preventDefault()
    e.stopPropagation()
    const w = columnWidths[id] ?? DEFAULT_COLUMN_WIDTHS[id]
    resizeState.current = { id, startX: e.clientX, startW: w }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function renderCell(col: MissionTableColumnId, scenario: ManagedScenario) {
    const w = columnWidths[col] ?? DEFAULT_COLUMN_WIDTHS[col]
    switch (col) {
      case 'name':
        return (
          <td className="mission-table-name" style={{ width: w }}>
            <span className="mission-table-name-text">{scenario.name || '—'}</span>
          </td>
        )
      case 'author':
        return <td style={{ width: w }}>{scenario.author || '—'}</td>
      case 'map':
        return <td style={{ width: w }}>{scenario.map_suffix || '—'}</td>
      case 'type':
        return (
          <td style={{ width: w }}>
            <span className="mission-table-pill">{scenario.mission_type?.toUpperCase() || '—'}</span>
          </td>
        )
      case 'gameType':
        return (
          <td style={{ width: w }}>
            <span className="mission-table-pill mission-table-pill-accent">
              {(scenarioGameTypes[scenario.id] ?? '').toUpperCase() || '—'}
            </span>
          </td>
        )
      case 'status':
        return (
          <td style={{ width: w }}>
            <div className="mission-table-status">
              {hasSymlinkPaths(scenario) ? (
                <span className="mission-table-badge mission-table-badge-ok">Ready</span>
              ) : (
                <span className="mission-table-badge mission-table-badge-warn">No symlink</span>
              )}
              {scenario.github_integration && (
                <span className="mission-table-badge mission-table-badge-ok">Git</span>
              )}
            </div>
          </td>
        )
    }
  }

  return (
    <>
      <div className="mission-table-wrap">
        <table className="mission-table mission-table-layout">
          <colgroup>
            {DEFAULT_COLUMN_ORDER.map((id) => (
              <col key={id} style={{ width: columnWidths[id] ?? DEFAULT_COLUMN_WIDTHS[id] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {DEFAULT_COLUMN_ORDER.map((id) => (
                <th
                  key={id}
                  scope="col"
                  className="mission-table-th-resizable"
                  style={{ width: columnWidths[id] ?? DEFAULT_COLUMN_WIDTHS[id] }}
                >
                  <button type="button" className="mission-table-sort" onClick={() => onSort(id)}>
                    {COL_LABEL[id]}{' '}
                    <FontAwesomeIcon icon={getSortIcon(id)} className="mission-table-sort-icon" />
                  </button>
                  <button
                    type="button"
                    className="mission-table-resize-handle"
                    aria-label={`Resize ${COL_LABEL[id]} column`}
                    onMouseDown={(e) => startResize(e, id)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr
                key={scenario.id}
                className={`mission-table-row ${favoriteIds.has(scenario.id) ? 'mission-table-row-pinned' : ''}`}
                onContextMenu={(e) => handleRowContextMenu(e, scenario)}
                onDoubleClick={() => handleRowDoubleClick(scenario)}
              >
                {DEFAULT_COLUMN_ORDER.map((col) => (
                  <Fragment key={col}>{renderCell(col, scenario)}</Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <MissionContextMenu
          mission={contextMenu.mission}
          position={contextMenu.position}
          isPinned={favoriteIds.has(contextMenu.mission.id)}
          loading={loading}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={() => onToggleFavorite(contextMenu.mission.id)}
          onRun={() => onRunMission(contextMenu.mission)}
          onEdit={() => onEdit(contextMenu.mission)}
          onDelete={() => onDelete(contextMenu.mission)}
          onMods={() => onMods(contextMenu.mission)}
          onPbo={() => onPbo(contextMenu.mission)}
          onGithub={() => onGithub(contextMenu.mission)}
          onScriptEditor={() => {
            const root = contextMenu.mission.project_path?.trim()
            if (root) onScriptEditor(root, fullMissionName(contextMenu.mission))
          }}
        />
      )}
    </>
  )
}
