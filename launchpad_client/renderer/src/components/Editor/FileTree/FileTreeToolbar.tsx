import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFolderMinus,
  faFolderPlus,
  faFileCirclePlus,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons'

export type FileTreeToolbarProps = {
  onCollapseAll: () => void
  onExpandAll: () => void
  onNewFile: () => void
  onRefresh: () => void
  disabled?: boolean
}

export function FileTreeToolbar({
  onCollapseAll,
  onExpandAll,
  onNewFile,
  onRefresh,
  disabled,
}: FileTreeToolbarProps) {
  return (
    <div className="file-tree-toolbar">
      <span className="file-tree-toolbar-title">Files</span>
      <div className="file-tree-toolbar-actions">
        <button
          type="button"
          className="file-tree-toolbar-btn"
          onClick={onNewFile}
          disabled={disabled}
          title="New File"
          aria-label="New File"
        >
          <FontAwesomeIcon icon={faFileCirclePlus} />
        </button>
        <button
          type="button"
          className="file-tree-toolbar-btn"
          onClick={onExpandAll}
          disabled={disabled}
          title="Expand All"
          aria-label="Expand All Folders"
        >
          <FontAwesomeIcon icon={faFolderPlus} />
        </button>
        <button
          type="button"
          className="file-tree-toolbar-btn"
          onClick={onCollapseAll}
          disabled={disabled}
          title="Collapse All"
          aria-label="Collapse All Folders"
        >
          <FontAwesomeIcon icon={faFolderMinus} />
        </button>
        <button
          type="button"
          className="file-tree-toolbar-btn"
          onClick={onRefresh}
          disabled={disabled}
          title="Refresh"
          aria-label="Refresh File Tree"
        >
          <FontAwesomeIcon icon={faRotateRight} />
        </button>
      </div>
    </div>
  )
}
