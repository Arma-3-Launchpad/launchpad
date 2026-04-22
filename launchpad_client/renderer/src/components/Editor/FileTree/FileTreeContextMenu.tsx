import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFileCirclePlus,
  faFolderPlus,
  faPen,
  faTrash,
  faCopy,
  faFolderOpen,
  faClone,
} from '@fortawesome/free-solid-svg-icons'

export type ContextMenuAction = 
  | 'new-file'
  | 'new-folder'
  | 'rename'
  | 'delete'
  | 'copy-path'
  | 'reveal'
  | 'duplicate'

export type ContextMenuTarget = {
  rel: string
  kind: 'file' | 'dir'
  x: number
  y: number
}

export type FileTreeContextMenuProps = {
  target: ContextMenuTarget | null
  onAction: (action: ContextMenuAction, rel: string, kind: 'file' | 'dir') => void
  onClose: () => void
  disabled?: boolean
}

type MenuItem = {
  action: ContextMenuAction
  label: string
  icon: typeof faFileCirclePlus
  showFor: ('file' | 'dir')[]
  dividerAfter?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { action: 'new-file', label: 'New File', icon: faFileCirclePlus, showFor: ['dir'] },
  { action: 'new-folder', label: 'New Folder', icon: faFolderPlus, showFor: ['dir'], dividerAfter: true },
  { action: 'rename', label: 'Rename', icon: faPen, showFor: ['file', 'dir'] },
  { action: 'duplicate', label: 'Duplicate', icon: faClone, showFor: ['file'] },
  { action: 'delete', label: 'Delete', icon: faTrash, showFor: ['file', 'dir'], dividerAfter: true },
  { action: 'copy-path', label: 'Copy Path', icon: faCopy, showFor: ['file', 'dir'] },
  { action: 'reveal', label: 'Reveal in Explorer', icon: faFolderOpen, showFor: ['file', 'dir'] },
]

export function FileTreeContextMenu({
  target,
  onAction,
  onClose,
  disabled,
}: FileTreeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!target) return

    const menu = menuRef.current
    if (!menu) {
      setPosition({ x: target.x, y: target.y })
      return
    }

    const rect = menu.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let x = target.x
    let y = target.y

    if (x + rect.width > viewportW - 8) {
      x = viewportW - rect.width - 8
    }
    if (y + rect.height > viewportH - 8) {
      y = viewportH - rect.height - 8
    }

    setPosition({ x: Math.max(8, x), y: Math.max(8, y) })
  }, [target])

  useEffect(() => {
    if (!target) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleScroll = () => {
      onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [target, onClose])

  const handleAction = useCallback(
    (action: ContextMenuAction) => {
      if (!target || disabled) return
      onAction(action, target.rel, target.kind)
      onClose()
    },
    [target, disabled, onAction, onClose],
  )

  if (!target) return null

  const visibleItems = MENU_ITEMS.filter((item) => item.showFor.includes(target.kind))

  return (
    <div
      ref={menuRef}
      className="file-tree-context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      {visibleItems.map((item, idx) => (
        <div key={item.action}>
          <button
            type="button"
            className={`file-tree-context-menu-item${item.action === 'delete' ? ' is-danger' : ''}`}
            role="menuitem"
            disabled={disabled}
            onClick={() => handleAction(item.action)}
          >
            <FontAwesomeIcon icon={item.icon} className="file-tree-context-menu-icon" />
            <span className="file-tree-context-menu-label">{item.label}</span>
          </button>
          {item.dividerAfter && idx < visibleItems.length - 1 && (
            <div className="file-tree-context-menu-divider" role="separator" />
          )}
        </div>
      ))}
    </div>
  )
}
