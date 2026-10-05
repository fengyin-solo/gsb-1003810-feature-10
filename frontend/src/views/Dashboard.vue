<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>运营概览</h2>
        <p class="page-desc">汇总各业务模块的关键指标，并回写发掘日记审核结论生成的待办台账。</p>
      </div>
      <div class="page-actions">
        <label class="ledger-toggle">
          <input v-model="showClosed" type="checkbox" />
          显示已办结
        </label>
        <button class="btn" type="button" @click="refresh">重新统计</button>
      </div>
    </header>
    <div class="stat-row">
      <article v-for="card in cards" :key="card.label" class="stat-card">
        <span class="stat-label">{{ card.label }}</span>
        <strong class="stat-value">{{ card.value }}</strong>
      </article>
    </div>
    <table class="data-table">
      <thead>
        <tr><th>业务模块</th><th>登记量</th><th>待处理</th><th>异常量</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in moduleRows" :key="row.name">
          <td>{{ row.name }}</td>
          <td>{{ row.created }}</td>
          <td>{{ row.pending }}</td>
          <td>{{ row.abnormal }}</td>
        </tr>
      </tbody>
    </table>

    <h3 class="ledger-title">发掘日记审核待办台账（{{ visibleTodos.length }}）</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>类型</th><th>日记编号</th><th>发掘区</th><th>承办人</th><th>事项</th><th>说明</th><th>状态</th><th>最近更新</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="todo in visibleTodos" :key="todo.id">
          <td>{{ todo.type }}</td>
          <td>{{ todo.businessNo }}</td>
          <td>{{ todo.area }}</td>
          <td>{{ todo.assignee }}</td>
          <td>{{ todo.title }}</td>
          <td class="note-cell"><span class="note-text">{{ todo.note }}</span></td>
          <td>
            <span :class="todo.done ? 'todo-done' : 'todo-open'">{{ todo.done ? '已办结' : '待处理' }}</span>
          </td>
          <td>{{ formatTime(todo.updatedAt) }}</td>
        </tr>
        <tr v-if="!visibleTodos.length">
          <td colspan="8" class="empty-state">暂无待办：发掘日记提交审核或退回补充后会在这里生成台账</td>
        </tr>
      </tbody>
    </table>

    <footer class="page-foot">
      <span>数据保存在本机浏览器里，换浏览器或清缓存会回到示例数据</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { loadOverview } from '@/api/local-service'
import type { OverviewResult, TodoItem } from '@/data/types'

const cards = ref<OverviewResult['cards']>([])
const moduleRows = ref<OverviewResult['modules']>([])
const todos = ref<TodoItem[]>([])
const showClosed = ref(false)

const visibleTodos = computed(() => {
  const list = showClosed.value ? todos.value : todos.value.filter((item) => !item.done)
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
})

function formatTime(stamp: string): string {
  if (!stamp) {
    return '—'
  }
  return stamp.replace('T', ' ').slice(0, 16)
}

function refresh() {
  const payload = loadOverview()
  cards.value = payload.cards
  moduleRows.value = payload.modules
  todos.value = payload.todos
}

onMounted(refresh)
</script>
