import { EXCAVATION_AREAS, reviewerOf } from './review-seats'
import { SEED_ROWS } from './seed'
import type { EntryRow } from './types'

// 本地持久化：数据放在 localStorage 里，刷新、关掉再打开都还在。
const STORAGE_KEY = 'field-archaeology-digital:entries'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// 发掘日记的迁移：旧数据没有发掘区/审核人/退回说明，读取时补齐。
// 历史日记已登记的审核人（包括已离任的原审核人）原样保留，绝不覆盖。
function normalizeDiaryRows(rows: EntryRow[]): EntryRow[] {
  return rows.map((row) => {
    const area = String(row.所属发掘区 ?? EXCAVATION_AREAS[0])
    const inReview = ['待审核', '需补充', '已审核'].includes(String(row.status))
    const reviewer =
      row.审核人 !== undefined && String(row.审核人) !== ''
        ? String(row.审核人)
        : inReview
          ? reviewerOf(area)
          : ''
    return {
      ...row,
      所属发掘区: area,
      审核人: reviewer,
      退回说明: String(row.退回说明 ?? ''),
    }
  })
}

function readStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  let merged: Record<string, EntryRow[]>
  if (!raw) {
    merged = fallback
  } else {
    try {
      const parsed = JSON.parse(raw) as Record<string, EntryRow[]>
      merged = { ...fallback, ...parsed }
    } catch {
      merged = fallback
    }
  }
  merged.diary = normalizeDiaryRows(merged.diary ?? [])
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}

let cache: Record<string, EntryRow[]> | null = null

export function allRows(): Record<string, EntryRow[]> {
  if (cache === null) {
    cache = readStorage()
  }
  return cache
}

export function listRows(key: string): EntryRow[] {
  return allRows()[key] ?? []
}

export function saveRows(key: string, rows: EntryRow[]): void {
  const next = { ...allRows(), [key]: rows }
  cache = next
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
}

export function resetRows(key: string): EntryRow[] {
  const rows = clone(SEED_ROWS[key] ?? [])
  saveRows(key, rows)
  return rows
}

export function storageKey(): string {
  return STORAGE_KEY
}
