import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faPlay,
  faEdit,
  faArchive,
  faTrash,
  faList,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import type { ManagedScenario } from '../../api/launchpad'
import Util from '../../Util'
import { VSCodeIcon } from '../CustomIcons/VSCodeIcon'
import { fullMissionName } from './missionUtils'
import './MissionContextMenu.less'

type MissionContextMenuProps = {
  mission: ManagedScenario
  position: { x: number; y: number }
  isPinned: boolean
  loading: boolean
  onClose: () => void
  onToggleFavorite: () => void
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onMods: () => void
  onPbo: () => void
  onGithub: () => void
  onScriptEditor: () => void
}

export function MissionContextMenu({
  mission,
  position,
  isPinned,
  loading,
  onClose,
  onToggleFavorite,
  onRun,
  onEdit,
  onDelete,
  onMods,
  onPbo,
  onGithub,
  onScriptEditor,
}: MissionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    if (!menuRef.current) return
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let x = position.x
    let y = position.y

    if (x + rect.width > viewportW - 8) {
      x = viewportW - rect.width - 8
    }
    if (y + rect.height > viewportH - 8) {
      y = viewportH - rect.height - 8
    }
    if (x < 8) x = 8
    if (y < 8) y = 8

    menu.style.left = `${x}px`
    menu.style.top = `${y}px`
  }, [position])

  const hasProjectPath = Boolean(mission.project_path?.trim())

  return (
    <div className="mission-context-menu-backdrop">
      <div
        ref={menuRef}
        className="mission-context-menu"
        role="menu"
        style={{ left: position.x, top: position.y }}
      >
        <div className="mission-context-menu-header">
          {fullMissionName(mission)}
        </div>

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={loading}
          onClick={() => {
            onRun()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faPlay} className="mission-context-menu-icon" />
          Run Mission
        </button>

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={loading}
          onClick={() => {
            onEdit()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faEdit} className="mission-context-menu-icon" />
          Edit
        </button>

        <button
          type="button"
          className={`mission-context-menu-item ${isPinned ? 'mission-context-menu-item-active' : ''}`}
          role="menuitem"
          onClick={() => {
            onToggleFavorite()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faStar} className="mission-context-menu-icon" />
          {isPinned ? 'Unpin from top' : 'Pin to top'}
        </button>

        <div className="mission-context-menu-sep" role="separator" />

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={!hasProjectPath}
          onClick={() => {
            onScriptEditor()
            onClose()
          }}
        >
          Open in Script Editor
        </button>

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={!hasProjectPath || loading}
          onClick={() => {
            void Util.runCommand(`code ${JSON.stringify(mission.project_path ?? '')}`)
            onClose()
          }}
        >
          <span className="mission-context-menu-icon mission-context-menu-icon-custom">
            <VSCodeIcon />
          </span>
          Open in VS Code
        </button>

        <div className="mission-context-menu-sep" role="separator" />

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={loading}
          onClick={() => {
            onMods()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faList} className="mission-context-menu-icon" />
          Manage Mods
        </button>

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={!hasProjectPath || loading}
          onClick={() => {
            onPbo()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faArchive} className="mission-context-menu-icon" />
          Build PBO
        </button>

        <button
          type="button"
          className="mission-context-menu-item"
          role="menuitem"
          disabled={!hasProjectPath || loading || !mission.github_integration}
          onClick={() => {
            onGithub()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faGithub} className="mission-context-menu-icon" />
          Git History
        </button>

        <div className="mission-context-menu-sep" role="separator" />

        <button
          type="button"
          className="mission-context-menu-item mission-context-menu-item-danger"
          role="menuitem"
          disabled={loading}
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          <FontAwesomeIcon icon={faTrash} className="mission-context-menu-icon" />
          Delete
        </button>
      </div>
    </div>
  )
}
