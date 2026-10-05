<template>
  <section class="page" data-module="diary">
    <header class="page-head">
      <div>
        <h2>发掘日记管理</h2>
        <p class="page-desc">
          按日记编号管理发掘日记，记录人与审核人分离：记录人提交后仅可查看本人日记，确认/退回仅本发掘区审核人可执行。
        </p>
      </div>
      <div class="page-actions">
        <button v-if="store.isRecorder" class="btn primary" type="button" @click="openCreate">登记发掘日记</button>
        <button class="btn" type="button" @click="exportRows">导出发掘日记清单</button>
      </div>
    </header>

    <div class="seat-bar">
      <span class="seat-label">当前席位</span>
      <select :value="store.operator" @change="onSwitchSeat">
        <option v-for="seat in seatOptions" :key="seat.name" :value="seat.name">
          {{ seat.name }} · {{ seat.title }}
        </option>
      </select>
      <span class="seat-scope">
        <template v-if="store.role === 'reviewer'">审核席位：仅可审核{{ seatArea }}日记</template>
        <template v-else-if="store.role === 'recorder'">记录席位：仅可查看并提交本人在{{ seatArea }}登记的日记</template>
        <template v-else>运营席位：只读，不参与审核</template>
      </span>
    </div>

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
      <label class="filter-item">
        <span>日记编号</span>
        <input v-model="filters['日记编号']" placeholder="按日记编号检索" />
      </label>
      <label class="filter-item">
        <span>所属发掘区</span>
        <input v-model="filters['所属发掘区']" placeholder="按发掘区检索" />
      </label>
      <label class="filter-item">
        <span>日期</span>
        <input v-model="filters['日期']" placeholder="按日期检索" />
      </label>
      <button class="btn" type="submit">查询</button>
      <button class="btn ghost" type="button" @click="resetFilters">重置条件</button>
    </form>

    <table class="data-table">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
          <th>审核状态</th>
          <th>退回说明</th>
          <th>可执行动作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="String(row.id)">
          <td v-for="column in columns" :key="column">{{ row[column] || '—' }}</td>
          <td>{{ row.status }}</td>
          <td class="note-cell" :title="String(row['退回说明'] || '')">
            <span v-if="row['退回说明']" class="note-text">{{ row['退回说明'] }}</span>
            <span v-else>—</span>
          </td>
          <td class="row-actions">
            <template v-for="action in availableActions(row)" :key="action.label">
              <button
                v-if="action.allowed"
                class="link"
                type="button"
                @click="runAction(action.label, row)"
              >
                {{ action.label }}
              </button>
              <span v-else class="action-lock" :title="action.reason">{{ action.label }}</span>
            </template>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length + 3" class="empty-state">当前席位下暂无可查看的发掘日记</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>共 {{ total }} 条可见发掘日记<span v-if="blocked > 0">（另有 {{ blocked }} 条因归属其他发掘区/记录人，按权限不可见）</span></span>
      <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
      <span v-else-if="successMessage" class="success-text">{{ successMessage }}</span>
    </footer>

    <div v-if="returnTarget" class="modal-mask" @click.self="closeReturn">
      <div class="modal-card">
        <h3>退回补充 · {{ String(returnTarget['日记编号']) }}</h3>
        <p class="modal-hint">
          审核席位：{{ store.operator }}（{{ seatArea }}）。退回后将给记录人「{{ String(returnTarget['记录人']) }}」生成一份补录待办。
        </p>
        <label class="modal-field">
          <span>退回说明</span>
          <textarea v-model="returnNote" rows="4"></textarea>
        </label>
        <p v-if="mismatchHint" class="error-text">{{ mismatchHint }}</p>
        <div class="modal-actions">
          <button class="btn" type="button" @click="closeReturn">取消</button>
          <button class="btn primary" type="button" @click="confirmReturn">确认退回</button>
        </div>
      </div>
    </div>

    <div v-if="creating" class="modal-mask" @click.self="creating = false">
      <div class="modal-card">
        <h3>登记发掘日记</h3>
        <p class="modal-hint">记录人：{{ store.operator }} · 所属发掘区：{{ seatArea }} · 审核人：{{ areaReviewer }}</p>
        <div class="modal-grid">
          <label class="modal-field">
            <span>日记编号</span>
            <input v-model="draft['日记编号']" placeholder="如 DIAR-0008" />
          </label>
          <label class="modal-field">
            <span>日期</span>
            <input v-model="draft['日期']" type="date" />
          </label>
          <label class="modal-field">
            <span>当日气候</span>
            <input v-model="draft['当日气候']" placeholder="如 晴 / 多云" />
          </label>
          <label class="modal-field">
            <span>参与人员</span>
            <input v-model="draft['参与人员']" placeholder="多人用顿号分隔" />
          </label>
        </div>
        <label class="modal-field">
          <span>工作内容</span>
          <textarea v-model="draft['工作内容']" rows="3"></textarea>
        </label>
        <label class="modal-field">
          <span>主要发现</span>
          <textarea v-model="draft['主要发现']" rows="3"></textarea>
        </label>
        <div class="modal-actions">
          <button class="btn" type="button" @click="creating = false">取消</button>
          <button class="btn primary" type="button" @click="submitCreate">保存草稿</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { downloadEntries } from '@/api/local-service'
import {
  buildReturnNote,
  confirmDiary,
  createDiary,
  isFindingMismatched,
  listDiaries,
  nextDiaryNo,
  returnDiary,
  submitDiary,
  type DiaryDraft,
} from '@/data/diary'
import { SEATS, reviewerOfArea } from '@/data/roster'
import { useSessionStore } from '@/stores/session'
import type { EntryRow } from '@/data/types'

const store = useSessionStore()
const columns = ["日记编号", "所属发掘区", "日期", "当日气候", "工作内容", "主要发现", "参与人员", "记录人", "审核人"]
const statuses = ["已录入", "待审核", "需补充", "已审核", "已归档"]
const seatOptions = SEATS

const rows = ref<EntryRow[]>([])
const total = ref(0)
const blocked = ref(0)
const errorMessage = ref('')
const successMessage = ref('')
const filters = ref<Record<string, string>>({})

const seatArea = computed(() => store.seat.areas[0] ?? '')
const areaReviewer = computed(() => reviewerOfArea(seatArea.value))

const statusSummary = computed(() =>
  statuses.map((status) => ({
    status,
    count: rows.value.filter((row) => String(row.status) === status).length,
  })),
)

const stats = computed(() => [
  { label: '可见日记总数', value: rows.value.length },
  { label: '已审核数', value: rows.value.filter((row) => String(row.status) === '已审核').length },
  {
    label: '待审核数',
    value: rows.value.filter((row) => String(row.status) === '待审核').length,
  },
  {
    label: '退回补录数',
    value: rows.value.filter((row) => String(row.status) === '需补充').length,
  },
])

function onSwitchSeat(event: Event) {
  store.switchSeat((event.target as HTMLSelectElement).value)
  errorMessage.value = ''
  successMessage.value = ''
  reload()
}

// 动作按席位权限与归属渲染：跨区、非本人一律锁定并给出拒绝原因，点击兜底仍会被服务层挡住。
type ActionView = { label: string; allowed: boolean; reason: string }
function availableActions(row: EntryRow): ActionView[] {
  const status = String(row.status)
  if (store.role === 'recorder') {
    const mine = String(row['记录人']) === store.operator
    if (status === '已录入') {
      return [{ label: '提交审核', allowed: mine, reason: '只有记录人本人可以提交' }]
    }
    if (status === '需补充') {
      return [{ label: '重新提交', allowed: mine, reason: '只有记录人本人可以重新提交' }]
    }
    return [{ label: '仅可查看', allowed: false, reason: '提交后只能查看，不能再改动' }]
  }
  if (store.role === 'reviewer') {
    if (status !== '待审核') {
      return [{ label: '仅可查看', allowed: false, reason: '只有待审核日记能执行审核动作' }]
    }
    const sameArea = String(row['所属发掘区']) === seatArea.value
    const sameReviewer = String(row['审核人']) === store.operator
    const reason = !sameArea
      ? `跨区审核属于越权：该日记归属${String(row['所属发掘区'])}，本席位仅负责${seatArea.value}`
      : !sameReviewer
        ? `该日记审核席位是${String(row['审核人'])}，不是${store.operator}`
        : ''
    return [
      { label: '确认审核', allowed: sameArea && sameReviewer, reason },
      { label: '退回补充', allowed: sameArea && sameReviewer, reason },
    ]
  }
  return [{ label: '只读', allowed: false, reason: '运营席位没有审核权限' }]
}

function flash(message: string, ok: boolean) {
  if (ok) {
    successMessage.value = message
    errorMessage.value = ''
  } else {
    errorMessage.value = message
    successMessage.value = ''
  }
}

function runAction(action: string, row: EntryRow) {
  if (action === '退回补充') {
    openReturn(row)
    return
  }
  const result =
    action === '确认审核'
      ? confirmDiary(Number(row.id), store.seat)
      : action === '提交审核' || action === '重新提交'
        ? submitDiary(Number(row.id), store.seat)
        : { ok: false, message: `不支持的动作「${action}」` }
  flash(result.message, result.ok)
  if (result.ok) {
    reload()
  }
}

const returnTarget = ref<EntryRow | null>(null)
const returnNote = ref('')
const mismatchHint = ref('')

function openReturn(row: EntryRow) {
  returnTarget.value = row
  returnNote.value = buildReturnNote(row)
  mismatchHint.value = isFindingMismatched(row)
    ? '系统判定主要发现与工作内容对不上，已按「以工作内容为准」预填退回说明，可在此基础上修改。'
    : ''
}

function closeReturn() {
  returnTarget.value = null
  returnNote.value = ''
  mismatchHint.value = ''
}

function confirmReturn() {
  if (!returnTarget.value) {
    return
  }
  const result = returnDiary(Number(returnTarget.value.id), store.seat, returnNote.value)
  closeReturn()
  flash(result.message, result.ok)
  if (result.ok) {
    reload()
  }
}

const creating = ref(false)
const draft = reactive<DiaryDraft>({
  日记编号: '',
  所属发掘区: '',
  日期: '',
  当日气候: '',
  工作内容: '',
  主要发现: '',
  参与人员: '',
})

function openCreate() {
  draft['日记编号'] = nextDiaryNo()
  draft['所属发掘区'] = seatArea.value
  draft['日期'] = new Date().toISOString().slice(0, 10)
  draft['当日气候'] = ''
  draft['工作内容'] = ''
  draft['主要发现'] = ''
  draft['参与人员'] = store.operator
  creating.value = true
}

function submitCreate() {
  const result = createDiary(draft, store.seat)
  flash(result.message, result.ok)
  if (result.ok) {
    creating.value = false
    reload()
  }
}

function resetFilters() {
  filters.value = {}
  reload()
}

function exportRows() {
  downloadEntries('diary')
}

function reload() {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = listDiaries(filters.value, store.seat)
    rows.value = payload.items
    total.value = payload.total
    blocked.value = payload.blocked
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '发掘日记列表读取失败'
  }
}

onMounted(reload)
</script>
