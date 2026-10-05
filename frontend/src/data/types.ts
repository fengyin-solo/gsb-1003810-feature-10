/** 纯前端数据层的公共类型：与全栈版后端返回的结构保持一致，换回后端时页面不用改。 */

export type EntryRow = {
  id: number
  status: string
  pending: boolean
  abnormal: boolean
  [field: string]: string | number | boolean
}

export type ModuleMeta = {
  key: string
  name: string
  entity: string
  desc: string
  fields: string[]
  statuses: string[]
  actions: string[]
  actionTargets: Record<string, string>
  metrics: string[]
}

export type PageResult = {
  items: EntryRow[]
  total: number
  page: number
  size: number
}

export type ActionResult = {
  ok: boolean
  message: string
}

// 发掘日记的席位：记录人席位只能登记/提交自己的日记，审核席位按发掘区归属审核。
export type DiarySeat = {
  role: 'recorder' | 'reviewer'
  name: string
  area: string
}

// 运营概览的待办台账条目：按 key（模块:编号）去重，同一对象不会重复占位。
export type TodoItem = {
  key: string
  module: string
  item: string
  target: string | number
  owner: string
  note: string
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
  todos: TodoItem[]
}
