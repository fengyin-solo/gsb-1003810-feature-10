import { defineStore } from 'pinia'

import { SEAT_BY_NAME, SEATS, type Seat, type SeatRole } from '@/data/roster'

type SessionState = {
  operator: string
  shiftLabel: string
  scope: string
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    operator: '值班管理员',
    shiftLabel: '白班 08:00-20:00',
    scope: '田野考古发掘数字化管理系统',
  }),
  getters: {
    canOperate: (state) => state.operator.length > 0,
    seat(state): Seat {
      return SEAT_BY_NAME.get(state.operator) ?? SEATS[0]
    },
    role(): SeatRole {
      return this.seat.role
    },
    isReviewer(): boolean {
      return this.seat.role === 'reviewer'
    },
    isRecorder(): boolean {
      return this.seat.role === 'recorder'
    },
  },
  actions: {
    setShift(label: string) {
      this.shiftLabel = label
    },
    switchSeat(name: string) {
      const seat = SEAT_BY_NAME.get(name)
      if (!seat) {
        return
      }
      this.operator = seat.name
      this.shiftLabel = seat.title
    },
  },
})
