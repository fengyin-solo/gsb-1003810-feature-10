import { MODULE_BY_KEY } from '@/data/modules'
import { allRows, listRows, resetRows, saveRows } from '@/data/local-store'
import { reviewerOf } from '@/data/review-seats'
import type {
  ActionResult,
  DiarySeat,
  EntryRow,
  ModuleMeta,
  OverviewResult,
  PageResult,
  TodoItem,
} from '@/data/types'

// 会写进数据的「往回走」动作：命中就把这条记录标成异常态，看板上能一眼看出来。
const NEGATIVE_ACTIONS = ['撤销', '作废', '拒绝', '驳回', '停用', '忽略', '下线', '回滚']

const DIARY_KEY = 'diary'

export function moduleMeta(key: string): ModuleMeta {
  const meta = MODULE_BY_KEY.get(key)
  if (!meta) {
    throw new Error(`没有登记名为 ${key} 的业务模块`)
  }
  return meta
}

export function filterRows(rows: EntryRow[], filters: Record<string, string>): EntryRow[] {
  const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
  if (pairs.length === 0) {
    return rows
  }
  return rows.filter((row) =>
    pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
  )
}

export function listEntries(key: string, filters: Record<string, string> = {}): PageResult {
  const matched = filterRows(listRows(key), filters)
  return { items: matched, total: matched.length, page: 1, size: matched.length }
}

export function runAction(key: string, id: number, action: string): ActionResult {
  if (key === DIARY_KEY) {
    // 发掘日记已启用审核席位，动作必须带席位走 runDiaryAction，不能绕过权限与归属校验。
    return { ok: false, message: '发掘日记已启用审核席位，请通过审核席位执行动作' }
  }
  const meta = moduleMeta(key)
  const target = meta.actionTargets[action]
  if (!target) {
    return { ok: false, message: `${meta.entity}没有登记「${action}」这个动作` }
  }
  const rows = listRows(key)
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的${meta.entity}` }
  }
  const current = String(rows[index].status)
  if (current === target) {
    return { ok: false, message: `${meta.entity}已经是「${target}」，不用重复操作` }
  }
  const lastStatus = meta.statuses[meta.statuses.length - 1]
  const updated: EntryRow = {
    ...rows[index],
    status: target,
    pending: target !== lastStatus,
    abnormal: NEGATIVE_ACTIONS.some((verb) => action.startsWith(verb)),
  }
  const next = [...rows]
  next[index] = updated
  saveRows(key, next)
  return { ok: true, message: `${meta.entity}已${action}，当前状态「${target}」` }
}

export function resetModule(key: string): PageResult {
  resetRows(key)
  return listEntries(key)
}

// ---- 发掘日记审核席位：列表、登记、动作都按席位走，记录人与审核人分离 ----

export function listDiaryEntries(seat: DiarySeat, filters: Record<string, string> = {}): PageResult {
  const all = listRows(DIARY_KEY)
  // 记录人提交后只能查看自己的发掘日记；审核席位看全量，动作权限在 runDiaryAction 里卡。
  const scoped =
    seat.role === 'recorder' ? all.filter((row) => String(row.记录人) === seat.name) : all
  const matched = filterRows(scoped, filters)
  return { items: matched, total: matched.length, page: 1, size: matched.length }
}

export function createDiaryEntry(seat: DiarySeat, draft: Record<string, string>): ActionResult {
  if (seat.role !== 'recorder') {
    return { ok: false, message: '记录人与审核人分离，审核席位不能登记发掘日记' }
  }
  const rows = listRows(DIARY_KEY)
  const id = rows.reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1
  const code = `DIAR-${String(id).padStart(4, '0')}`
  const row: EntryRow = {
    id,
    status: '已录入',
    pending: true,
    abnormal: false,
    日记编号: code,
    日期: draft.日期?.trim() || new Date().toISOString().slice(0, 10),
    当日气候: draft.当日气候?.trim() || '—',
    工作内容: draft.工作内容?.trim() || '—',
    主要发现: draft.主要发现?.trim() || '—',
    参与人员: draft.参与人员?.trim() || seat.name,
    记录人: seat.name,
    所属发掘区: seat.area,
    审核人: '',
    退回说明: '',
    日记状态: '已录入',
  }
  saveRows(DIARY_KEY, [...rows, row])
  return { ok: true, message: `发掘日记 ${code} 已登记，记录人 ${seat.name}（${seat.area}）` }
}

// 退回说明口径：主要发现与工作内容对不上时，以「工作内容」为基准，
// 退回说明引用工作内容，要求记录人据此补录主要发现。
function rejectionNote(diary: EntryRow): string {
  return `主要发现与工作内容对不上，以工作内容为准补录主要发现（工作内容：${diary.工作内容}）`
}

export function runDiaryAction(seat: DiarySeat, id: number, action: string): ActionResult {
  const meta = moduleMeta(DIARY_KEY)
  const target = meta.actionTargets[action]
  if (!target) {
    return { ok: false, message: `${meta.entity}没有登记「${action}」这个动作` }
  }
  const rows = listRows(DIARY_KEY)
  const index = rows.findIndex((row) => Number(row.id) === id)
  if (index < 0) {
    return { ok: false, message: `没有找到编号为 ${id} 的${meta.entity}` }
  }
  const diary = rows[index]
  const current = String(diary.status)
  let updated: EntryRow
  let message: string

  if (action === '提交审核') {
    if (seat.role !== 'recorder') {
      return { ok: false, message: '记录人与审核人分离，审核席位不能提交发掘日记' }
    }
    if (String(diary.记录人) !== seat.name) {
      return { ok: false, message: `日记 ${diary.日记编号} 的记录人是 ${diary.记录人}，只能由本人提交` }
    }
    if (current !== '已录入' && current !== '需补充') {
      return { ok: false, message: `${meta.entity}当前状态「${current}」，不能提交审核` }
    }
    const reviewer = reviewerOf(String(diary.所属发掘区))
    if (!reviewer) {
      return { ok: false, message: `发掘区 ${diary.所属发掘区} 还没有配置审核人` }
    }
    updated = { ...diary, status: target, 审核人: reviewer, pending: true, abnormal: false }
    message = `${meta.entity}已提交审核，审核人 ${reviewer}（${diary.所属发掘区}）`
  } else {
    // 确认审核 / 退回补充：只有本发掘区审核人能执行，跨区审核属于越权。
    if (seat.role !== 'reviewer') {
      return { ok: false, message: '记录人与审核人分离，记录人不能执行审核动作，请切换到审核席位' }
    }
    if (current !== '待审核') {
      return { ok: false, message: `${meta.entity}当前状态「${current}」，不在待审核状态，不能${action}` }
    }
    if (String(diary.所属发掘区) !== seat.area || String(diary.审核人) !== seat.name) {
      return {
        ok: false,
        message: `日记 ${diary.日记编号} 归属${diary.所属发掘区}（审核人 ${diary.审核人}），跨区审核属于越权，已按权限和归属拒绝`,
      }
    }
    if (action === '确认审核') {
      updated = { ...diary, status: target, pending: false, abnormal: false }
      message = `${meta.entity}已确认审核，当前状态「${target}」`
    } else {
      const note = rejectionNote(diary)
      updated = { ...diary, status: target, pending: true, abnormal: true, 退回说明: note }
      message = `${meta.entity}已退回补充：${note}`
    }
  }

  const next = [...rows]
  next[index] = updated
  saveRows(DIARY_KEY, next)
  return { ok: true, message }
}

export function exportEntries(key: string): { filename: string; content: string } {
  const meta = moduleMeta(key)
  const header = ['编号', ...meta.fields, '当前状态']
  const lines = [header.join(',')]
  for (const row of listRows(key)) {
    lines.push([row.id, ...meta.fields.map((field) => row[field] ?? ''), row.status].join(','))
  }
  return { filename: `${meta.name}-清单.csv`, content: `\uFEFF${lines.join('\n')}` }
}

export function downloadEntries(key: string): void {
  const { filename, content } = exportEntries(key)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// 待办台账：每条待办按「模块:编号」占位，审核结论（确认/退回）写回数据行后在这里汇出。
// 同一条日记重复退回也只对应一行数据，台账里自然只有一份补录待办。
function buildTodo(meta: ModuleMeta, row: EntryRow): TodoItem {
  const key = `${meta.key}:${row.id}`
  if (meta.key === DIARY_KEY) {
    const status = String(row.status)
    if (status === '需补充') {
      return {
        key,
        module: meta.name,
        item: '补录待办',
        target: String(row.日记编号 ?? row.id),
        owner: String(row.记录人 ?? ''),
        note: String(row.退回说明 ?? '') || '待补录',
      }
    }
    if (status === '待审核') {
      return {
        key,
        module: meta.name,
        item: '审核待办',
        target: String(row.日记编号 ?? row.id),
        owner: String(row.审核人 ?? ''),
        note: `${row.所属发掘区}待审核`,
      }
    }
    return {
      key,
      module: meta.name,
      item: '提交待办',
      target: String(row.日记编号 ?? row.id),
      owner: String(row.记录人 ?? ''),
      note: '待提交审核',
    }
  }
  return {
    key,
    module: meta.name,
    item: '待处理',
    target: String(row[meta.fields[0]] ?? row.id),
    owner: '',
    note: String(row.status),
  }
}

export function loadOverview(): OverviewResult {
  const rows = allRows()
  const modules = [...MODULE_BY_KEY.values()].map((meta) => {
    const entries = rows[meta.key] ?? []
    return {
      name: meta.name,
      created: entries.length,
      pending: entries.filter((row) => row.pending).length,
      abnormal: entries.filter((row) => row.abnormal).length,
    }
  })
  const cards = [
    { label: '业务模块', value: modules.length },
    { label: '登记总量', value: modules.reduce((sum, item) => sum + item.created, 0) },
    { label: '待处理', value: modules.reduce((sum, item) => sum + item.pending, 0) },
    { label: '异常量', value: modules.reduce((sum, item) => sum + item.abnormal, 0) },
  ]
  const todoMap = new Map<string, TodoItem>()
  for (const meta of MODULE_BY_KEY.values()) {
    for (const row of rows[meta.key] ?? []) {
      if (!row.pending) {
        continue
      }
      const todo = buildTodo(meta, row)
      if (!todoMap.has(todo.key)) {
        todoMap.set(todo.key, todo)
      }
    }
  }
  return { cards, modules, todos: [...todoMap.values()] }
}
