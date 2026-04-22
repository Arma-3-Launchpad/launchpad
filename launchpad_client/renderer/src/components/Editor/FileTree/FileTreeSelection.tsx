import { useCallback, useState } from 'react'
import type { ProjectTreeNode } from '../../../api/launchpad'

export type SelectionState = {
  selected: Set<string>
  lastSelected: string | null
}

export type UseFileTreeSelectionProps = {
  flatFiles: string[]
  onSelectionChange?: (selected: Set<string>) => void
}

export type UseFileTreeSelectionResult = {
  selection: SelectionState
  isSelected: (rel: string) => boolean
  handleSelect: (rel: string, e: React.MouseEvent) => void
  clearSelection: () => void
  selectAll: () => void
  getSelectedFiles: () => string[]
}

function collectAllFileRels(node: ProjectTreeNode): string[] {
  if (node.kind === 'file' && node.relPath) {
    return [node.relPath]
  }
  const out: string[] = []
  for (const ch of node.children ?? []) {
    out.push(...collectAllFileRels(ch))
  }
  return out
}

export function useFileTreeSelection({
  flatFiles,
  onSelectionChange,
}: UseFileTreeSelectionProps): UseFileTreeSelectionResult {
  const [selection, setSelection] = useState<SelectionState>({
    selected: new Set(),
    lastSelected: null,
  })

  const isSelected = useCallback(
    (rel: string) => selection.selected.has(rel),
    [selection.selected],
  )

  const handleSelect = useCallback(
    (rel: string, e: React.MouseEvent) => {
      setSelection((prev) => {
        const newSelected = new Set(prev.selected)

        if (e.ctrlKey || e.metaKey) {
          if (newSelected.has(rel)) {
            newSelected.delete(rel)
          } else {
            newSelected.add(rel)
          }
          const next = { selected: newSelected, lastSelected: rel }
          onSelectionChange?.(newSelected)
          return next
        }

        if (e.shiftKey && prev.lastSelected) {
          const startIdx = flatFiles.indexOf(prev.lastSelected)
          const endIdx = flatFiles.indexOf(rel)

          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
            for (let i = from; i <= to; i++) {
              newSelected.add(flatFiles[i])
            }
            const next = { selected: newSelected, lastSelected: rel }
            onSelectionChange?.(newSelected)
            return next
          }
        }

        const next = {
          selected: new Set([rel]),
          lastSelected: rel,
        }
        onSelectionChange?.(next.selected)
        return next
      })
    },
    [flatFiles, onSelectionChange],
  )

  const clearSelection = useCallback(() => {
    setSelection({ selected: new Set(), lastSelected: null })
    onSelectionChange?.(new Set())
  }, [onSelectionChange])

  const selectAll = useCallback(() => {
    const allFiles = new Set(flatFiles)
    setSelection({
      selected: allFiles,
      lastSelected: flatFiles[flatFiles.length - 1] ?? null,
    })
    onSelectionChange?.(allFiles)
  }, [flatFiles, onSelectionChange])

  const getSelectedFiles = useCallback(() => {
    return Array.from(selection.selected)
  }, [selection.selected])

  return {
    selection,
    isSelected,
    handleSelect,
    clearSelection,
    selectAll,
    getSelectedFiles,
  }
}

export function flattenTreeFiles(node: ProjectTreeNode): string[] {
  return collectAllFileRels(node)
}
