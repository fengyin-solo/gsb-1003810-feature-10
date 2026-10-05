import { SEED_ROWS } from './seed'
import { reviewerOfArea } from './roster'
import type { EntryRow, TodoItem } from './types'

// 本地持久化：业务记录与审核待办台账分键存放，刷新、关掉再打开都还在。
const STORAGE_KEY = 'field-archaeology-digital:entries'
const TODO_STORAGE_KEY = 'field-archaeology-digital:review-todos'

const DIARY_KEY = 'diary'
const DIARY_STATUSES = ['已录入', '待审核', '需补充', '已审核', '已归档']
// 老版本没有「待审核」，提交即落「需补充」是早期流转配置的笔误，迁移时纠正。
const LEGACY_STATUS_MAP: Record<string, string> = {
  需补充: '待审核',
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * 发掘日记迁移：
 * 1. 老行补齐「所属发掘区 / 审核人 / 退回说明」，归属沿用行内发掘区，不重派历史审核人；
 * 2. 旧版流转里没有「待审核」，提交后落的是「需补充」；没有「所属发掘区」列的才是旧版行，做状态纠正；
 * 3. 新版种子按 id 并入，演示库升级后能拿到新样例。
 */
function migrateDiary(stored: EntryRow[] | undefined, seed: EntryRow[]): EntryRow[] {
  const normalize = (row: EntryRow): EntryRow => {
    const isLegacy = row['所属发掘区'] === undefined
    const area = String(row['所属发掘区'] ?? 'Ⅰ区') || 'Ⅰ区'
    const rawStatus = String(row.status ?? '')
    const status =
      DIARY_STATUSES.includes(rawStatus) && !(isLegacy && rawStatus === '需补充')
        ? rawStatus
        : (LEGACY_STATUS_MAP[rawStatus] ?? '已录入')
    return {
      ...row,
      status,
      pending: status !== '已审核' && status !== '已归档',
      abnormal: status === '需补充',
      '所属发掘区': area,
      '审核人': String(row['审核人'] ?? reviewerOfArea(area) ?? '周慎'),
      '退回说明': String(row['退回说明'] ?? ''),
    }
  }
  const merged = new Map<number, EntryRow>()
  for (const row of seed) {
    merged.set(Number(row.id), normalize(row))
  }
  for (const row of stored ?? []) {
    const id = Number(row.id)
    const incoming = normalize(row)
    const existing = merged.get(id)
    if (!existing) {
      merged.set(id, incoming)
      continue
    }
    // 同 id 时浏览器里已经流转过的数据（状态、内容等）优先；仅旧行留空的可选字段从种子补齐。
    const mergedRow: EntryRow = { ...incoming }
    for (const field of ['退回说明']) {
      if (String(incoming[field] ?? '').trim() === '') {
        mergedRow[field] = existing[field]
      }
    }
    merged.set(id, mergedRow)
  }
  return [...merged.values()].sort((a, b) => Number(a.id) - Number(b.id))
}

function readStorage(): Record<string, EntryRow[]> {
  const fallback = clone(SEED_ROWS)
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, EntryRow[]>
    const merged: Record<string, EntryRow[]> = { ...fallback, ...parsed }
    merged[DIARY_KEY] = migrateDiary(parsed[DIARY_KEY], fallback[DIARY_KEY])
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback))
    return fallback
  }
}

function readTodos(): TodoItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }
  const raw = window.localStorage.getItem(TODO_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    return JSON.parse(raw) as TodoItem[]
  } catch {
    return []
  }
}

let cache: Record<string, EntryRow[]> | null = null
let todoCache: TodoItem[] | null = null

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

export function listTodos(): TodoItem[] {
  if (todoCache === null) {
    todoCache = readTodos()
  }
  return todoCache
}

export function saveTodos(todos: TodoItem[]): void {
  todoCache = todos
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos))
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

export function todoStorageKey(): string {
  return TODO_STORAGE_KEY
}
