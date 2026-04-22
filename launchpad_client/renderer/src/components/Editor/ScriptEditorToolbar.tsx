import { useCallback, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEllipsisV } from '@fortawesome/free-solid-svg-icons'

export type ScriptEditorToolbarProps = {
  selectedRel: string | null
  dirty: boolean
  disabled?: boolean
  fileLoading?: boolean
  savingFile?: boolean
  showMinimap: boolean
  showFolding: boolean
  onMinimapToggle: () => void
  onFoldingToggle: () => void
  onGoToLineClick: () => void
  onGoToSymbolClick: () => void
  onRenameClick: () => void
  onSaveClick: () => void
  isImageOrMesh?: boolean
}

export function ScriptEditorToolbar({
  selectedRel,
  dirty,
  disabled,
  fileLoading,
  savingFile,
  showMinimap,
  showFolding,
  onMinimapToggle,
  onFoldingToggle,
  onGoToLineClick,
  onGoToSymbolClick,
  onRenameClick,
  onSaveClick,
  isImageOrMesh,
}: ScriptEditorToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.relatedTarget as Node)) {
      setMenuOpen(false)
    }
  }, [])

  return (
    <div className="script-editor-toolbar">
      <div className="script-editor-toolbar-path">
        <code className="script-editor-toolbar-path-text">{selectedRel}</code>
      </div>
      <div className="script-editor-toolbar-actions">
        {!isImageOrMesh && (
          <div className="script-editor-toolbar-menu-wrap" ref={menuRef} onBlur={handleBlur}>
            <button
              ref={btnRef}
              type="button"
              className={`script-editor-toolbar-menu-btn${menuOpen ? ' is-open' : ''}`}
              disabled={disabled || fileLoading}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="View options"
            >
              <FontAwesomeIcon icon={faEllipsisV} />
            </button>
            {menuOpen && (
              <div className="script-editor-toolbar-dropdown" role="menu">
                <button
                  type="button"
                  className="script-editor-toolbar-dropdown-item"
                  role="menuitem"
                  onClick={() => { onGoToLineClick(); closeMenu() }}
                >
                  <span className="script-editor-toolbar-dropdown-label">Go to Line</span>
                  <kbd className="script-editor-toolbar-dropdown-kbd">Ctrl+G</kbd>
                </button>
                <button
                  type="button"
                  className="script-editor-toolbar-dropdown-item"
                  role="menuitem"
                  onClick={() => { onGoToSymbolClick(); closeMenu() }}
                >
                  <span className="script-editor-toolbar-dropdown-label">Go to Symbol</span>
                  <kbd className="script-editor-toolbar-dropdown-kbd">Ctrl+Shift+O</kbd>
                </button>
                <div className="script-editor-toolbar-dropdown-sep" role="separator" />
                <button
                  type="button"
                  className="script-editor-toolbar-dropdown-item"
                  role="menuitemcheckbox"
                  aria-checked={showMinimap}
                  onClick={() => { onMinimapToggle(); closeMenu() }}
                >
                  <span className="script-editor-toolbar-dropdown-check">{showMinimap ? '✓' : ''}</span>
                  <span className="script-editor-toolbar-dropdown-label">Show Minimap</span>
                </button>
                <button
                  type="button"
                  className="script-editor-toolbar-dropdown-item"
                  role="menuitemcheckbox"
                  aria-checked={showFolding}
                  onClick={() => { onFoldingToggle(); closeMenu() }}
                >
                  <span className="script-editor-toolbar-dropdown-check">{showFolding ? '✓' : ''}</span>
                  <span className="script-editor-toolbar-dropdown-label">Show Folding</span>
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled || fileLoading}
          onClick={onRenameClick}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled || savingFile || fileLoading || !dirty || isImageOrMesh}
          onClick={onSaveClick}
        >
          {savingFile ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
