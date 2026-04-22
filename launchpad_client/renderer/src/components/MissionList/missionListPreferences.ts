import { useCallback, useEffect, useState } from 'react'

export type MissionTableColumnId = 'name' | 'author' | 'map' | 'type' | 'gameType' | 'status'

const LS_FAV = 'launchpad.missionList.favorites'
const LS_ORDER = 'launchpad.missionList.columnOrder'
const LS_WIDTHS = 'launchpad.missionList.columnWidths'

export const DEFAULT_COLUMN_ORDER: MissionTableColumnId[] = [
  'name',
  'author',
  'map',
  'type',
  'gameType',
  'status',
]

export const DEFAULT_COLUMN_WIDTHS: Record<MissionTableColumnId, number> = {
  name: 200,
  author: 140,
  map: 96,
  type: 88,
  gameType: 96,
  status: 140,
}

const MIN_COL = 64
const MAX_COL = 480

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function normalizeOrder(order: unknown): MissionTableColumnId[] {
  const allowed = new Set(DEFAULT_COLUMN_ORDER)
  const arr = Array.isArray(order) ? order.filter((x): x is MissionTableColumnId => typeof x === 'string' && allowed.has(x as MissionTableColumnId)) : []
  const seen = new Set(arr)
  for (const id of DEFAULT_COLUMN_ORDER) {
    if (!seen.has(id)) arr.push(id)
  }
  return arr
}

function normalizeWidths(w: unknown): Record<MissionTableColumnId, number> {
  const out = { ...DEFAULT_COLUMN_WIDTHS }
  if (!w || typeof w !== 'object') return out
  for (const id of DEFAULT_COLUMN_ORDER) {
    const n = (w as Record<string, unknown>)[id]
    if (typeof n === 'number' && Number.isFinite(n)) {
      out[id] = Math.min(MAX_COL, Math.max(MIN_COL, Math.round(n)))
    }
  }
  return out
}

export function loadFavoriteIds(): Set<string> {
  const raw = parseJson<string[] | null>(localStorage.getItem(LS_FAV), null)
  if (!Array.isArray(raw)) return new Set()
  return new Set(raw.filter((x) => typeof x === 'string' && x.trim()))
}

export function saveFavoriteIds(ids: Set<string>) {
  localStorage.setItem(LS_FAV, JSON.stringify([...ids]))
}

export function loadColumnOrder(): MissionTableColumnId[] {
  return normalizeOrder(parseJson(localStorage.getItem(LS_ORDER), DEFAULT_COLUMN_ORDER))
}

export function saveColumnOrder(order: MissionTableColumnId[]) {
  localStorage.setItem(LS_ORDER, JSON.stringify(normalizeOrder(order)))
}

export function loadColumnWidths(): Record<MissionTableColumnId, number> {
  return normalizeWidths(parseJson(localStorage.getItem(LS_WIDTHS), DEFAULT_COLUMN_WIDTHS))
}

export function saveColumnWidths(widths: Record<MissionTableColumnId, number>) {
  localStorage.setItem(LS_WIDTHS, JSON.stringify(normalizeWidths(widths)))
}

export function useMissionListPreferences() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(loadFavoriteIds)
  const [columnOrder, setColumnOrder] = useState<MissionTableColumnId[]>(loadColumnOrder)
  const [columnWidths, setColumnWidths] = useState<Record<MissionTableColumnId, number>>(loadColumnWidths)

  useEffect(() => {
    saveFavoriteIds(favoriteIds)
  }, [favoriteIds])

  useEffect(() => {
    saveColumnOrder(columnOrder)
  }, [columnOrder])

  useEffect(() => {
    saveColumnWidths(columnWidths)
  }, [columnWidths])

  const toggleFavorite = useCallback((missionId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(missionId)) next.delete(missionId)
      else next.add(missionId)
      return next
    })
  }, [])

  const moveColumn = useCallback((fromId: MissionTableColumnId, toId: MissionTableColumnId) => {
    if (fromId === toId) return
    setColumnOrder((prev) => {
      const i = prev.indexOf(fromId)
      const j = prev.indexOf(toId)
      if (i === -1 || j === -1) return prev
      const next = [...prev]
      next.splice(i, 1)
      next.splice(j, 0, fromId)
      return next
    })
  }, [])

  const setColumnWidth = useCallback((id: MissionTableColumnId, px: number) => {
    const w = Math.min(MAX_COL, Math.max(MIN_COL, Math.round(px)))
    setColumnWidths((prev) => ({ ...prev, [id]: w }))
  }, [])

  return {
    favoriteIds,
    toggleFavorite,
    columnOrder,
    setColumnOrder,
    moveColumn,
    columnWidths,
    setColumnWidth,
  }
}
