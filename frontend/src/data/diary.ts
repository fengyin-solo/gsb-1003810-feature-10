import { listRows, listTodos, saveRows, saveTodos } from '@/data/local-store'
import {
  EXCAVATION_AREAS,
  REVIEWER_BY_AREA,
  reviewerOfArea,
  type Seat,
} from '@/data/roster'
import type { EntryRow, TodoItem } from '@/data/types'

export const DIARY_KEY = 'diary'
export const DIARY_STATUSES = ['已录入', '待审核', '需补充', '已审核', '已归档'] as const

export type DiaryDraft = {
  日记编号: string
  所属发掘区: string
  日期: string
  当日气候: string
  工作内容: string
  主要发现: string
  参与人员: string
}

export type DiaryListResult = {
  items: EntryRow[]
  /** 受席位可见范围限制后实际展示的条数 */
  total: number
  /** 因为越权而被挡下的条数（跨区日记不属于本审核席位） */
  blocked: number
}

// 台账去重键：同一条日记的同一类待办只保留一条，重复退回只更新原补录待办。
function todoId(entryId: number, type: TodoItem['type']): string {
  return `${DIARY_KEY}:${entryId}:${type}`
}

function upsertTodo(todos: TodoItem[], candidate: TodoItem): TodoItem[] {
  const next = todos.filter((item) => item.id !== candidate.id)
  next.unshift(candidate)
  return next
}

function nowStamp(): string {
  return new Date().toISOString()
}

function diaryNo(row: EntryRow): string {
  return String(row['日记编号'] ?? `#${row.id}`)
}

/**
 * 台账对账：审核结论以发掘日记状态为准回写运营概览待办台账。
 * 幂等——重复调用不会产生重复待办；已有待办（含已办结）原样保留，只做新增/关闭。
 */
export function syncDiaryTodos(): TodoItem[] {
  const todos = [...listTodos()]
  let changed = false
  const stamp = nowStamp()

  const close = (id: string): void => {
    const index = todos.findIndex((item) => item.id === id)
    if (index >= 0 && !todos[index].done) {
      todos[index] = { ...todos[index], done: true, updatedAt: stamp }
      changed = true
    }
  }
  // 幂等打开：没有就新建，已办结或内容有变化就刷新原条（重新提交/再次退回复用同一条，不产生多份）。
  const ensureOpen = (id: string, make: () => TodoItem, patch: Partial<TodoItem>): void => {
    const index = todos.findIndex((item) => item.id === id)
    if (index < 0) {
      todos.unshift(make())
      changed = true
      return
    }
    const current = todos[index]
    const stale =
      current.done ||
      current.assignee !== (patch.assignee ?? current.assignee) ||
      current.title !== (patch.title ?? current.title) ||
      current.note !== (patch.note ?? current.note)
    if (stale) {
      todos[index] = { ...current, ...patch, done: false, updatedAt: stamp }
      changed = true
    }
  }

  for (const row of listRows(DIARY_KEY)) {
    const entryId = Number(row.id)
    const area = String(row['所属发掘区'] ?? '')
    const reviewer = String(row['审核人'] ?? '')
    const recorder = String(row['记录人'] ?? '')
    const no = diaryNo(row)
    const status = String(row.status)
    const reviewId = todoId(entryId, '审核')
    const supplementId = todoId(entryId, '补录')

    if (status === '待审核') {
      ensureOpen(
        reviewId,
        () => ({
          id: reviewId,
          module: DIARY_KEY,
          entryId,
          businessNo: no,
          area,
          type: '审核',
          assignee: reviewer,
          title: `发掘日记 ${no}（${area}）待审核`,
          note: '记录人已提交，等待本发掘区审核人确认或退回',
          done: false,
          createdAt: stamp,
          updatedAt: stamp,
        }),
        { assignee: reviewer },
      )
      close(supplementId)
    } else if (status === '需补充') {
      // 退回：补录待办按日记编号幂等写入，重复退回同一条日记只会刷新这一条，不会再多出一份。
      const note = String(row['退回说明'] ?? '') || '审核人退回，请补充完善后重新提交'
      ensureOpen(
        supplementId,
        () => ({
          id: supplementId,
          module: DIARY_KEY,
          entryId,
          businessNo: no,
          area,
          type: '补录',
          assignee: recorder,
          title: `发掘日记 ${no}（${area}）退回补录`,
          note,
          done: false,
          createdAt: stamp,
          updatedAt: stamp,
        }),
        { assignee: recorder, title: `发掘日记 ${no}（${area}）退回补录`, note },
      )
      close(reviewId)
    } else {
      // 已录入（草稿）不产生待办；已审核/已归档：审核与补录待办全部办结。
      close(reviewId)
      close(supplementId)
    }
  }

  if (changed) {
    saveTodos(todos)
  }
  return todos
}

/** 列表取数路径：记录人提交后只能查看自己的发掘日记；审核人只看本发掘区席位下的日记。 */
export function listDiaries(filters: Record<string, string> = {}, seat: Seat): DiaryListResult {
  syncDiaryTodos()
  const pairs = Object.entries(filters).filter(([, value]) => value.trim() !== '')
  let visible = listRows(DIARY_KEY)
  let blocked = 0

  if (seat.role === 'recorder') {
    visible = visible.filter((row) => String(row['记录人']) === seat.name)
  } else if (seat.role === 'reviewer') {
    const ownArea = seat.areas[0] ?? ''
    visible = visible.filter((row) => String(row['所属发掘区']) === ownArea)
  }
  blocked = listRows(DIARY_KEY).length - visible.length

  const items = pairs.length
    ? visible.filter((row) =>
        pairs.every(([field, value]) => String(row[field] ?? '').includes(value.trim())),
      )
    : visible

  return { items, total: items.length, blocked }
}

export function nextDiaryNo(): string {
  const max = listRows(DIARY_KEY).reduce((acc, row) => {
    const matched = /(\d+)$/.exec(String(row['日记编号'] ?? ''))
    return matched ? Math.max(acc, Number(matched[1])) : acc
  }, 0)
  return `DIAR-${String(max + 1).padStart(4, '0')}`
}

/** 登记发掘日记：仅记录人席位可登记，归属本人所在发掘区，审核人由发掘区名册指定。 */
export function createDiary(draft: DiaryDraft, seat: Seat): { ok: boolean; message: string } {
  if (seat.role !== 'recorder') {
    return { ok: false, message: '只有记录人席位可以登记发掘日记' }
  }
  const area = seat.areas[0] ?? ''
  if (!EXCAVATION_AREAS.includes(area)) {
    return { ok: false, message: '当前席位没有所属发掘区，不能登记发掘日记' }
  }
  if (!draft['日记编号'].trim()) {
    return { ok: false, message: '请填写日记编号' }
  }
  const rows = listRows(DIARY_KEY)
  if (rows.some((row) => String(row['日记编号']) === draft['日记编号'].trim())) {
    return { ok: false, message: `日记编号 ${draft['日记编号'].trim()} 已存在` }
  }
  const entry: EntryRow = {
    id: rows.reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1,
    status: '已录入',
    pending: true,
    abnormal: false,
    '日记编号': draft['日记编号'].trim(),
    '所属发掘区': area,
    '日期': draft['日期'].trim(),
    '当日气候': draft['当日气候'].trim(),
    '工作内容': draft['工作内容'].trim(),
    '主要发现': draft['主要发现'].trim(),
    '参与人员': draft['参与人员'].trim(),
    '记录人': seat.name,
    '审核人': reviewerOfArea(area),
    '退回说明': '',
    '日记状态': '草稿',
  }
  saveRows(DIARY_KEY, [...rows, entry])
  syncDiaryTodos()
  return { ok: true, message: `发掘日记 ${entry['日记编号']} 已登记，当前为草稿，可提交审核` }
}

function findDiary(id: number): EntryRow | undefined {
  return listRows(DIARY_KEY).find((row) => Number(row.id) === id)
}

function saveDiary(updated: EntryRow): void {
  const rows = listRows(DIARY_KEY)
  const next = rows.map((row) => (Number(row.id) === Number(updated.id) ? updated : row))
  saveRows(DIARY_KEY, next)
  syncDiaryTodos()
}

/** 提交/重新提交：只允许记录人本人操作自己的草稿或退回件。 */
export function submitDiary(id: number, seat: Seat): { ok: boolean; message: string } {
  const row = findDiary(id)
  if (!row) {
    return { ok: false, message: `没有找到编号为 ${id} 的发掘日记` }
  }
  if (seat.role !== 'recorder' || String(row['记录人']) !== seat.name) {
    return { ok: false, message: '只有日记记录人本人可以提交审核' }
  }
  const status = String(row.status)
  if (status !== '已录入' && status !== '需补充') {
    return { ok: false, message: `当前状态「${status}」不能提交审核` }
  }
  saveDiary({
    ...row,
    status: '待审核',
    pending: true,
    abnormal: false,
    '退回说明': '',
    '日记状态': '待审',
  })
  return {
    ok: true,
    message: `发掘日记 ${diaryNo(row)} 已提交${status === '需补充' ? '（重新提交）' : ''}，等待${String(
      row['审核人'],
    )}审核`,
  }
}

// 审核动作的三重校验：席位必须是审核人、日记必须属于本发掘区、审核人必须是本人（历史日记保留原审核人）。
function assertReviewer(row: EntryRow, seat: Seat): { ok: boolean; message: string } {
  if (seat.role !== 'reviewer') {
    return { ok: false, message: '当前席位不是审核人，无权审核发掘日记' }
  }
  const ownArea = seat.areas[0] ?? ''
  if (String(row['所属发掘区']) !== ownArea) {
    return {
      ok: false,
      message: `跨区审核属于越权：该日记归属${String(
        row['所属发掘区'],
      )}，${seat.name}仅负责${ownArea}，已拒绝`,
    }
  }
  if (String(row['审核人']) !== seat.name) {
    return {
      ok: false,
      message: `该日记的审核席位是${String(row['审核人'])}，不是${seat.name}，不能代为审核`,
    }
  }
  return { ok: true, message: '' }
}

/** 确认审核：只有本发掘区审核人本人能确认，确认后审核待办办结。 */
export function confirmDiary(id: number, seat: Seat): { ok: boolean; message: string } {
  const row = findDiary(id)
  if (!row) {
    return { ok: false, message: `没有找到编号为 ${id} 的发掘日记` }
  }
  const guard = assertReviewer(row, seat)
  if (!guard.ok) {
    return guard
  }
  if (String(row.status) !== '待审核') {
    return { ok: false, message: `只有「待审核」的日记可以确认，当前为「${String(row.status)}」` }
  }
  saveDiary({ ...row, status: '已审核', pending: false, abnormal: false, '日记状态': '通过' })
  return { ok: true, message: `发掘日记 ${diaryNo(row)} 已由${seat.name}确认审核` }
}

/** 主要发现与工作内容是否对得上：按工作内容的实义词条比对，主要发现一条都没承接即视为对不上。 */
export function isFindingMismatched(row: EntryRow): boolean {
  const work = String(row['工作内容'] ?? '')
  const finding = String(row['主要发现'] ?? '')
  if (!work.trim() || !finding.trim()) {
    return false
  }
  const stopWords = new Set([
    '清理', '记录', '测绘', '发掘', '完成', '进行', '全面', '剖面', '平剖面', '编号',
    '采集', '出土', '探方', '耕土层', '土样', '浮', '选', '升', '件', '若干', '并',
    '的', '与', '和', '及', '在', '了', '把', '向', '北段', '南段', '堆积', '层',
  ])
  const tokens = work.split(/[，。、,\s（）()0-9A-Za-z]+/).filter((token) => token.length >= 2)
  const keywords = [...new Set(tokens.filter((token) => !stopWords.has(token)))]
  return keywords.length > 0 && !keywords.some((token) => finding.includes(token))
}

/** 默认退回说明：内容对不上时以工作内容为准（工作内容是当天实际作业，发现描述应承接作业对象）。 */
export function buildReturnNote(row: EntryRow): string {
  if (isFindingMismatched(row)) {
    return `主要发现与工作内容对不上，以工作内容「${String(row['工作内容'])}」为准，请据实核对主要发现后补录`
  }
  return '审核未通过，请按审核意见补充完善记录后重新提交'
}

/** 退回补充：只有本发掘区审核人本人能退回，退回结论（含说明）回写补录待办台账。 */
export function returnDiary(
  id: number,
  seat: Seat,
  note?: string,
): { ok: boolean; message: string } {
  const row = findDiary(id)
  if (!row) {
    return { ok: false, message: `没有找到编号为 ${id} 的发掘日记` }
  }
  const guard = assertReviewer(row, seat)
  if (!guard.ok) {
    return guard
  }
  if (String(row.status) !== '待审核') {
    return { ok: false, message: `只有「待审核」的日记可以退回，当前为「${String(row.status)}」` }
  }
  const finalNote = note && note.trim() ? note.trim() : buildReturnNote(row)
  saveDiary({
    ...row,
    status: '需补充',
    pending: true,
    abnormal: true,
    '退回说明': finalNote,
    '日记状态': '退回',
  })
  return { ok: true, message: `发掘日记 ${diaryNo(row)} 已退回${String(row['记录人'])}补录` }
}

export { REVIEWER_BY_AREA }
