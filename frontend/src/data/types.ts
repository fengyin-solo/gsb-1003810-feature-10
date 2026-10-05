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

// 审核结论回写的待办台账：一条发掘日记在同一待办类型下至多挂一条，避免重复退回产生多份补录待办。
export type TodoType = '审核' | '补录'

export type TodoItem = {
  id: string
  module: string
  entryId: number
  businessNo: string
  area: string
  type: TodoType
  assignee: string
  title: string
  note: string
  done: boolean
  createdAt: string
  updatedAt: string
}

export type OverviewResult = {
  cards: { label: string; value: number }[]
  modules: { name: string; created: number; pending: number; abnormal: number }[]
  todos: TodoItem[]
  todoOpenCount: number
}
