import { defineStore } from 'pinia'

import { DIARY_RECORDERS, reviewerOf } from '@/data/review-seats'

export const useSessionStore = defineStore('session', {
  state: () => ({
    operator: DIARY_RECORDERS[0].name,
    seat: 'recorder' as 'recorder' | 'reviewer',
    area: DIARY_RECORDERS[0].area,
    shiftLabel: '白班 08:00-20:00',
    scope: '田野考古发掘数字化管理系统',
  }),
  getters: {
    canOperate: (state) => state.operator.length > 0,
    seatDesc: (state) =>
      state.seat === 'reviewer' ? `审核席位 · ${state.area}` : `记录人席位 · ${state.area}`,
  },
  actions: {
    setShift(label: string) {
      this.shiftLabel = label
    },
    useRecorderSeat(name: string) {
      const recorder = DIARY_RECORDERS.find((item) => item.name === name)
      this.seat = 'recorder'
      this.operator = recorder?.name ?? name
      this.area = recorder?.area ?? this.area
    },
    useReviewerSeat(area: string) {
      this.seat = 'reviewer'
      this.area = area
      this.operator = reviewerOf(area) || this.operator
    },
  },
})
