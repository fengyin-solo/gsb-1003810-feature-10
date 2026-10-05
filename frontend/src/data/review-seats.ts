// 发掘区审核席位配置：每个发掘区固定一名审核人，记录人与审核人分离。
// 跨区审核属于越权，动作层会按「权限（是否审核席位）+ 归属（是否本发掘区审核人）」拒绝。

export const EXCAVATION_AREAS = ['一号发掘区', '二号发掘区']

// 发掘区 -> 现任审核人。历史日记上登记的原审核人可能已不在这里，迁移时不得覆盖。
export const AREA_REVIEWERS: Record<string, string> = {
  '一号发掘区': '王岚',
  '二号发掘区': '李衡',
}

// 记录人名册：记录人只归属一个发掘区，提交后只能查看自己的发掘日记。
export const DIARY_RECORDERS: { name: string; area: string }[] = [
  { name: '陈禾', area: '一号发掘区' },
  { name: '赵青', area: '二号发掘区' },
]

export function reviewerOf(area: string): string {
  return AREA_REVIEWERS[area] ?? ''
}
