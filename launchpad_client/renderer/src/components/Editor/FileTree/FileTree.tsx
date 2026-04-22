import { useCallback, useMemo, useRef, useState } from 'react'
import { Spinner } from '../../Spinner'
import type { ProjectTreeNode } from '../../../api/launchpad'
import { FileIcon, FolderIcon } from './FileTreeIcons'
import { FileTreeContextMenu, type ContextMenuAction, type ContextMenuTarget } from './FileTreeContextMenu'
import { useFileTreeDragDrop } from './FileTreeDragDrop'
import { FileTreePreview, useFileTreePreview, type PreviewData } from './FileTreePreview'
import { useFileTreeSelection, flattenTreeFiles } from './FileTreeSelection'
import { InlineEditInput, type InlineEditState } from './FileTreeInlineEdit'

export type { ProjectTreeNode }

function formatSize(n: number | null | undefined): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function fileBasename(relPosix: string): string {
  const parts = relPosix.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : relPosix
}

export function parentDirRel(relPosix: string): string {
  const parts = relPosix.split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

export function ancestorDirRelPathsForFile(fileRel: string): string[] {
  const parts = fileRel.split('/').filter(Boolean)
  if (parts.length <= 1) return ['']
  const out: string[] = ['']
  for (let i = 0; i < parts.length - 1; i++) {
    out.push(parts.slice(0, i + 1).join('/'))
  }
  return out
}

export function firstFileRelDepthFirst(node: ProjectTreeNode): string | null {
  if (node.kind === 'file') return node.relPath || null
  for (const ch of node.children ?? []) {
    const hit = firstFileRelDepthFirst(ch)
    if (hit) return hit
  }
  return null
}

export function isPaaRel(relPosix: string): boolean {
  return fileBasename(relPosix).toLowerCase().endsWith('.paa')
}

export function isP3dRel(relPosix: string): boolean {
  return fileBasename(relPosix).toLowerCase().endsWith('.p3d')
}

export type FileTreeProps = {
  tree: ProjectTreeNode
  expanded: Set<string>
  selectedRel: string | null
  busyFileRel: string | null
  onToggle: (rel: string) => void
  onSelectFile: (rel: string) => void
  onRequestNewFile: (dirRel: string) => void
  onRequestNewFolder?: (dirRel: string) => void
  onRequestRename: (fileRel: string, currentName: string) => void
  onRequestDelete?: (rel: string, kind: 'file' | 'dir') => void
  onRequestDuplicate?: (rel: string) => void
  onCopyPath?: (rel: string) => void
  onRevealInExplorer?: (rel: string) => void
  onMove?: (sourceRel: string, targetDirRel: string) => void | Promise<void>
  onExpandAll?: () => void
  onCollapseAll?: () => void
  getPreviewData?: (rel: string) => Promise<PreviewData>
  disabled?: boolean
  enableDragDrop?: boolean
  enableMultiSelect?: boolean
  enablePreview?: boolean
  enableContextMenu?: boolean
  inlineEditState?: InlineEditState
  onInlineEditConfirm?: (rel: string, newName: string, mode: 'rename' | 'new-file' | 'new-folder') => void
  onInlineEditCancel?: () => void
}

type TreeBranchProps = {
  node: ProjectTreeNode
  depth: number
  expanded: Set<string>
  toggle: (rel: string) => void
  selectedRel: string | null
  busyFileRel: string | null
  onSelectFile: (rel: string, e: React.MouseEvent) => void
  onContextMenu: (rel: string, kind: 'file' | 'dir', e: React.MouseEvent) => void
  disabled?: boolean
  onRequestNewFile: (dirRel: string) => void
  onRequestRename: (fileRel: string, currentName: string) => void
  isMultiSelected?: (rel: string) => boolean
  dragHandlers?: {
    onDragStart: (rel: string, kind: 'file' | 'dir', e: React.DragEvent) => void
    onDragOver: (rel: string, kind: 'file' | 'dir', e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
  getDropClass?: (rel: string) => string
  enableDragDrop?: boolean
  onMouseEnterFile?: (rel: string, element: HTMLElement) => void
  onMouseLeaveFile?: () => void
  inlineEditState?: InlineEditState
  onInlineEditConfirm?: (value: string) => void
  onInlineEditCancel?: () => void
}

function TreeBranch({
  node,
  depth,
  expanded,
  toggle,
  selectedRel,
  busyFileRel,
  onSelectFile,
  onContextMenu,
  disabled,
  onRequestNewFile,
  onRequestRename,
  isMultiSelected,
  dragHandlers,
  getDropClass,
  enableDragDrop,
  onMouseEnterFile,
  onMouseLeaveFile,
  inlineEditState,
  onInlineEditConfirm,
  onInlineEditCancel,
}: TreeBranchProps) {
  const rowRef = useRef<HTMLButtonElement>(null)
  const isDir = node.kind === 'dir'
  const rel = node.relPath
  const open = isDir ? expanded.has(rel) : false
  const selected = selectedRel === rel || isMultiSelected?.(rel)
  const dropClass = getDropClass?.(rel) ?? ''
  
  const isBeingEdited = inlineEditState?.rel === rel && inlineEditState.mode === 'rename'
  const hasNewItemPlaceholder = isDir && inlineEditState && 
    (inlineEditState.mode === 'new-file' || inlineEditState.mode === 'new-folder') &&
    inlineEditState.rel === `${rel}/__new__`

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      onContextMenu(rel, node.kind, e)
    },
    [rel, node.kind, onContextMenu],
  )

  const handleMouseEnter = useCallback(() => {
    if (!isDir && rowRef.current && onMouseEnterFile) {
      onMouseEnterFile(rel, rowRef.current)
    }
  }, [isDir, rel, onMouseEnterFile])

  return (
    <li
      className={`file-tree-item${isDir && open ? ' is-expanded' : ''}${dropClass ? ` ${dropClass}` : ''}`}
      style={{ paddingLeft: depth <= 2 ? depth * 12 : 24 + (depth - 2) * 8 }}
    >
      {isDir ? (
        <div className="file-tree-line">
          {isBeingEdited ? (
            <div className="file-tree-row file-tree-row-dir file-tree-row-editing">
              <span className="file-tree-toggle" aria-hidden />
              <FolderIcon isOpen={open} />
              <InlineEditInput
                initialValue={inlineEditState.initialValue}
                mode="rename"
                onConfirm={(value) => onInlineEditConfirm?.(value)}
                onCancel={() => onInlineEditCancel?.()}
              />
            </div>
          ) : (
            <button
              type="button"
              className="file-tree-row file-tree-row-dir file-tree-row-main"
              onClick={() => toggle(rel)}
              onContextMenu={handleContextMenu}
              aria-expanded={open}
              draggable={enableDragDrop && !disabled}
              onDragStart={(e) => dragHandlers?.onDragStart(rel, 'dir', e)}
              onDragOver={(e) => dragHandlers?.onDragOver(rel, 'dir', e)}
              onDragLeave={dragHandlers?.onDragLeave}
              onDrop={dragHandlers?.onDrop}
              onDragEnd={dragHandlers?.onDragEnd}
            >
              <span className="file-tree-toggle" aria-hidden />
              <FolderIcon isOpen={open} />
              <span className="file-tree-name">{node.name}</span>
              {node.truncated ? <span className="file-tree-meta">…</span> : null}
            </button>
          )}
        </div>
      ) : (
        <div className="file-tree-line">
          {isBeingEdited ? (
            <div className="file-tree-row file-tree-row-file file-tree-row-editing is-selected">
              <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden />
              <FileIcon filename={node.name} />
              <InlineEditInput
                initialValue={inlineEditState.initialValue}
                mode="rename"
                onConfirm={(value) => onInlineEditConfirm?.(value)}
                onCancel={() => onInlineEditCancel?.()}
              />
            </div>
          ) : (
            <button
              ref={rowRef}
              type="button"
              className={`file-tree-row file-tree-row-file file-tree-row-main${selected ? ' is-selected' : ''}`}
              onClick={(e) => onSelectFile(rel, e)}
              onContextMenu={handleContextMenu}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={onMouseLeaveFile}
              draggable={enableDragDrop && !disabled}
              onDragStart={(e) => dragHandlers?.onDragStart(rel, 'file', e)}
              onDragOver={(e) => dragHandlers?.onDragOver(rel, 'file', e)}
              onDragLeave={dragHandlers?.onDragLeave}
              onDrop={dragHandlers?.onDrop}
              onDragEnd={dragHandlers?.onDragEnd}
            >
              <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden />
              <FileIcon filename={node.name} />
              <span className="file-tree-name">{node.name}</span>
              {busyFileRel === rel ? (
                <span className="file-tree-busy" aria-hidden>
                  <Spinner size={14} color="var(--text-muted)" />
                </span>
              ) : null}
              {node.size != null ? <span className="file-tree-meta">{formatSize(node.size)}</span> : null}
            </button>
          )}
        </div>
      )}
      {isDir && open && (
        <ul className="file-tree-list file-tree-nested">
          {hasNewItemPlaceholder && inlineEditState && (
            <li
              className="file-tree-item"
              style={{ paddingLeft: (depth + 1) <= 2 ? (depth + 1) * 12 : 24 + ((depth + 1) - 2) * 8 }}
            >
              <div className="file-tree-line">
                <div className={`file-tree-row file-tree-row-${inlineEditState.mode === 'new-folder' ? 'dir' : 'file'} file-tree-row-editing is-selected`}>
                  <span className="file-tree-toggle file-tree-toggle-spacer" aria-hidden />
                  {inlineEditState.mode === 'new-folder' ? (
                    <FolderIcon isOpen={false} />
                  ) : (
                    <FileIcon filename="" />
                  )}
                  <InlineEditInput
                    initialValue=""
                    mode={inlineEditState.mode}
                    onConfirm={(value) => onInlineEditConfirm?.(value)}
                    onCancel={() => onInlineEditCancel?.()}
                  />
                </div>
              </div>
            </li>
          )}
          {node.children?.map((ch) => (
            <TreeBranch
              key={ch.relPath || ch.name}
              node={ch}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedRel={selectedRel}
              busyFileRel={busyFileRel}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
              disabled={disabled}
              onRequestNewFile={onRequestNewFile}
              onRequestRename={onRequestRename}
              isMultiSelected={isMultiSelected}
              dragHandlers={dragHandlers}
              getDropClass={getDropClass}
              enableDragDrop={enableDragDrop}
              onMouseEnterFile={onMouseEnterFile}
              onMouseLeaveFile={onMouseLeaveFile}
              inlineEditState={inlineEditState}
              onInlineEditConfirm={onInlineEditConfirm}
              onInlineEditCancel={onInlineEditCancel}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function FileTree({
  tree,
  expanded,
  selectedRel,
  busyFileRel,
  onToggle,
  onSelectFile,
  onRequestNewFile,
  onRequestNewFolder,
  onRequestRename,
  onRequestDelete,
  onRequestDuplicate,
  onCopyPath,
  onRevealInExplorer,
  onMove,
  getPreviewData,
  disabled,
  enableDragDrop = false,
  enableMultiSelect = false,
  enablePreview = false,
  enableContextMenu = true,
  inlineEditState,
  onInlineEditConfirm,
  onInlineEditCancel,
}: FileTreeProps) {
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null)

  const flatFiles = useMemo(() => flattenTreeFiles(tree), [tree])

  const { isSelected, handleSelect } = useFileTreeSelection({
    flatFiles,
  })

  const { handlers: dragHandlers, getDropIndicatorClass } = useFileTreeDragDrop({
    onMove: onMove ?? (() => {}),
    disabled,
  })

  const defaultGetPreviewData = useCallback(async (): Promise<PreviewData> => {
    return { type: 'none' }
  }, [])

  const { previewRel, previewData, previewLoading, previewAnchorRect, onMouseEnter, onMouseLeave } =
    useFileTreePreview({
      getPreviewData: getPreviewData ?? defaultGetPreviewData,
      enabled: enablePreview && !!getPreviewData,
    })

  const handleContextMenu = useCallback(
    (rel: string, kind: 'file' | 'dir', e: React.MouseEvent) => {
      if (!enableContextMenu) return
      setContextMenuTarget({ rel, kind, x: e.clientX, y: e.clientY })
    },
    [enableContextMenu],
  )

  const findNodeName = useCallback((rel: string): string => {
    const parts = rel.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1]! : ''
  }, [])

  const handleContextMenuAction = useCallback(
    (action: ContextMenuAction, rel: string, kind: 'file' | 'dir') => {
      switch (action) {
        case 'new-file':
          onRequestNewFile(rel)
          break
        case 'new-folder':
          onRequestNewFolder?.(rel)
          break
        case 'rename':
          onRequestRename(rel, findNodeName(rel))
          break
        case 'delete':
          onRequestDelete?.(rel, kind)
          break
        case 'duplicate':
          onRequestDuplicate?.(rel)
          break
        case 'copy-path':
          onCopyPath?.(rel)
          break
        case 'reveal':
          onRevealInExplorer?.(rel)
          break
      }
    },
    [onRequestNewFile, onRequestNewFolder, onRequestRename, onRequestDelete, onRequestDuplicate, onCopyPath, onRevealInExplorer, findNodeName],
  )

  const handleFileSelect = useCallback(
    (rel: string, e: React.MouseEvent) => {
      if (enableMultiSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        handleSelect(rel, e)
      } else {
        onSelectFile(rel)
      }
    },
    [enableMultiSelect, handleSelect, onSelectFile],
  )

  const handleInlineConfirm = useCallback((value: string) => {
    if (inlineEditState && onInlineEditConfirm) {
      onInlineEditConfirm(inlineEditState.rel, value, inlineEditState.mode)
    }
  }, [inlineEditState, onInlineEditConfirm])

  return (
    <>
      <ul className="file-tree-list file-tree-root">
        <TreeBranch
          node={tree}
          depth={0}
          expanded={expanded}
          toggle={onToggle}
          selectedRel={selectedRel}
          busyFileRel={busyFileRel}
          onSelectFile={handleFileSelect}
          onContextMenu={handleContextMenu}
          disabled={disabled}
          onRequestNewFile={onRequestNewFile}
          onRequestRename={onRequestRename}
          isMultiSelected={enableMultiSelect ? isSelected : undefined}
          dragHandlers={enableDragDrop ? dragHandlers : undefined}
          getDropClass={enableDragDrop ? getDropIndicatorClass : undefined}
          enableDragDrop={enableDragDrop}
          onMouseEnterFile={enablePreview ? onMouseEnter : undefined}
          onMouseLeaveFile={enablePreview ? onMouseLeave : undefined}
          inlineEditState={inlineEditState}
          onInlineEditConfirm={handleInlineConfirm}
          onInlineEditCancel={onInlineEditCancel}
        />
      </ul>

      {enableContextMenu && (
        <FileTreeContextMenu
          target={contextMenuTarget}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuTarget(null)}
          disabled={disabled}
        />
      )}

      {enablePreview && (
        <FileTreePreview
          rel={previewRel}
          anchorRect={previewAnchorRect}
          previewData={previewData}
          loading={previewLoading}
        />
      )}
    </>
  )
}
