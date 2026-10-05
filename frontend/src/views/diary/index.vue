<template>
  <section class="page" data-module="diary">
    <header class="page-head">
      <div>
        <h2>发掘日记管理</h2>
        <p class="page-desc">维护发掘日记，围绕日记编号、日期、当日气候、工作内容做登记、筛选与状态流转。</p>
      </div>
      <div class="page-actions">
        <button class="btn primary" type="button" @click="openCreate">登记发掘日记</button>
        <button class="btn" type="button" @click="exportRows">导出发掘日记清单</button>
      </div>
    </header>

    <div class="seat-bar">
      <span class="seat-label">当前席位：{{ store.operator }}（{{ store.seatDesc }}）</span>
      <button
        class="btn"
        :class="{ primary: store.seat === 'recorder' }"
        type="button"
        @click="switchSeat('recorder')"
      >
        记录人席位
      </button>
      <button
        class="btn"
        :class="{ primary: store.seat === 'reviewer' }"
        type="button"
        @click="switchSeat('reviewer')"
      >
        审核席位
      </button>
      <label v-if="store.seat === 'recorder'" class="filter-item">
        <span>记录人</span>
        <select v-model="recorderName" @change="applySeat">
          <option v-for="item in recorderOptions" :key="item.name" :value="item.name">
            {{ item.name }}（{{ item.area }}）
          </option>
        </select>
      </label>
      <label v-else class="filter-item">
        <span>审核发掘区</span>
        <select v-model="reviewArea" @change="applySeat">
          <option v-for="area in areaOptions" :key="area" :value="area">
            {{ area }}（审核人 {{ reviewerOf(area) }}）
          </option>
        </select>
      </label>
    </div>

    <form v-if="creating" class="filter-bar" @submit.prevent="submitCreate">
      <label v-for="field in createFields" :key="field" class="filter-item">
        <span>{{ field }}</span>
        <input v-model="draft[field]" :placeholder="`填写${field}`" />
      </label>
      <button class="btn primary" type="submit">保存登记</button>
      <button class="btn ghost" type="button" @click="creating = false">取消</button>
    </form>

    <div class="stat-row">
      <article v-for="item in stats" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong class="stat-value">{{ item.value }}</strong>
      </article>
    </div>

    <p class="status-legend">
      <span v-for="item in statusSummary" :key="item.status" class="legend-item">
        {{ item.status }}：{{ item.count }}
      </span>
    </p>

    <form class="filter-bar" @submit.prevent="reload">
      <label v-for="field in filterFields" :key="field" class="filter-item">
        <span>{{ field }}</span>
        <input v-model="filters[field]" :placeholder="`按${field}检索`" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
    </form>

    <table class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
          <th>当前状态</th>
          <th>可执行动作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="String(row.id)">
          <td v-for="column in columns" :key="column">{{ row[column] || '—' }}</td>
          <td>{{ row.status }}</td>
          <td class="row-actions">
            <button
              v-for="action in actions"
              :key="action"
              class="link"
              type="button"
              @click="runAction(action, row)"
            >
              {{ action }}
            </button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 2" class="empty-state">暂无发掘日记数据，可先登记发掘日记</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条发掘日记记录</span>
      <span v-if="noticeMessage" class="notice-text">{{ noticeMessage }}</span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  createDiaryEntry,
  downloadEntries,
  listDiaryEntries,
  moduleMeta,
  runDiaryAction,
} from '@/api/local-service'
import { DIARY_RECORDERS, EXCAVATION_AREAS, reviewerOf } from '@/data/review-seats'
import type { DiarySeat, EntryRow } from '@/data/types'
import { useSessionStore } from '@/stores/session'

const meta = moduleMeta('diary')
const store = useSessionStore()
const columns = ["日记编号", "日期", "当日气候", "工作内容", "主要发现", "参与人员", "记录人", "所属发掘区", "审核人", "退回说明", "日记状态"]
const statuses = meta.statuses
const recorderOptions = DIARY_RECORDERS
const areaOptions = EXCAVATION_AREAS
const createFields = ["日期", "当日气候", "工作内容", "主要发现", "参与人员"]

const rows = ref<EntryRow[]>([])
const total = ref(0)
const errorMessage = ref('')
const noticeMessage = ref('')
const filters = ref<Record<string, string>>({})
const creating = ref(false)
const draft = ref<Record<string, string>>({})
const recorderName = ref(store.seat === 'recorder' ? store.operator : DIARY_RECORDERS[0].name)
const reviewArea = ref(store.area)
const filterFields = columns.slice(0, 3)

// 记录人席位只能提交审核；审核席位执行确认/退回，跨区动作会被服务层按越权拒绝。
const actions = computed(() =>
  store.seat === 'reviewer' ? ['确认审核', '退回补充'] : ['提交审核'],
)
const stats = computed(() => [
  { label: '日记总数', value: rows.value.length },
  { label: '已审核数', value: rows.value.filter((row) => String(row.status) === '已审核').length },
  { label: '待审核数', value: rows.value.filter((row) => String(row.status) === '待审核').length },
])
const statusSummary = computed(() =>
  statuses.map((status: string) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

function currentSeat(): DiarySeat {
  return { role: store.seat, name: store.operator, area: store.area }
}

function switchSeat(seat: 'recorder' | 'reviewer') {
  if (seat === store.seat) {
    return
  }
  if (seat === 'recorder') {
    store.useRecorderSeat(recorderName.value)
  } else {
    store.useReviewerSeat(reviewArea.value)
  }
  reload()
}

function applySeat() {
  if (store.seat === 'recorder') {
    store.useRecorderSeat(recorderName.value)
  } else {
    store.useReviewerSeat(reviewArea.value)
  }
  reload()
}

function resetFilters() {
  filters.value = {}
  reload()
}

function exportRows() {
  downloadEntries(meta.key)
}

function openCreate() {
  noticeMessage.value = ''
  errorMessage.value = ''
  if (store.seat !== 'recorder') {
    errorMessage.value = '记录人与审核人分离，审核席位不能登记发掘日记'
    return
  }
  draft.value = {}
  creating.value = true
}

function submitCreate() {
  const result = createDiaryEntry(currentSeat(), draft.value)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  creating.value = false
  noticeMessage.value = result.message
  reload()
}

function runAction(action: string, row: EntryRow) {
  errorMessage.value = ''
  noticeMessage.value = ''
  const result = runDiaryAction(currentSeat(), Number(row.id), action)
  if (!result.ok) {
    errorMessage.value = result.message
    return
  }
  noticeMessage.value = result.message
  reload()
}

function reload() {
  errorMessage.value = ''
  try {
    const payload = listDiaryEntries(currentSeat(), filters.value)
    rows.value = payload.items
    total.value = payload.total
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发掘日记列表读取失败'
  }
}

onMounted(reload)
</script>

<style scoped>
.seat-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.seat-label {
  font-size: 13px;
  color: var(--muted);
  align-self: center;
}
.notice-text {
  color: #067647;
}
</style>
