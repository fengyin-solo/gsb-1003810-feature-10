/**
 * 发掘区席位名册：记录人与审核人分离。
 * 审核席位按发掘区授权，只有「本发掘区审核人」能确认/退回本区日记；跨区审核一律按越权拒绝。
 */

export type SeatRole = 'admin' | 'reviewer' | 'recorder'

export type Seat = {
  /** 与日记行里「记录人 / 审核人」字段一致的姓名，用于归属比对 */
  name: string
  role: SeatRole
  /** 审核人：负责的发掘区；记录人：所属发掘区；运营管理员留空 */
  areas: string[]
  title: string
}

export const EXCAVATION_AREAS = ['Ⅰ区', 'Ⅱ区', 'Ⅲ区']

/** 现任审核席位：每个发掘区恰好一名审核人，换人后新日记按这里取审核人。 */
export const REVIEWER_BY_AREA: Record<string, string> = {
  Ⅰ区: '周慎',
  Ⅱ区: '吴砺',
  Ⅲ区: '郑衡',
}

export const AREA_BY_REVIEWER: Record<string, string> = Object.fromEntries(
  Object.entries(REVIEWER_BY_AREA).map(([area, name]) => [name, area]),
)

/** 可切换的值班席位：记录人、本发掘区审核人、运营概览管理员。 */
export const SEATS: Seat[] = [
  { name: '值班管理员', role: 'admin', areas: [], title: '运营概览（只读）' },
  { name: '周慎', role: 'reviewer', areas: ['Ⅰ区'], title: 'Ⅰ区审核人' },
  { name: '吴砺', role: 'reviewer', areas: ['Ⅱ区'], title: 'Ⅱ区审核人' },
  { name: '郑衡', role: 'reviewer', areas: ['Ⅲ区'], title: 'Ⅲ区审核人' },
  { name: '林渠', role: 'recorder', areas: ['Ⅰ区'], title: 'Ⅰ区记录人' },
  { name: '马垣', role: 'recorder', areas: ['Ⅱ区'], title: 'Ⅱ区记录人' },
  { name: '何苗', role: 'recorder', areas: ['Ⅲ区'], title: 'Ⅲ区记录人' },
]

export const SEAT_BY_NAME = new Map(SEATS.map((seat) => [seat.name, seat]))

export function reviewerOfArea(area: string): string {
  return REVIEWER_BY_AREA[area] ?? ''
}

export function areaOfReviewer(name: string): string {
  return AREA_BY_REVIEWER[name] ?? ''
}
