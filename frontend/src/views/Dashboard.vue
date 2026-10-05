<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h2>运营概览</h2>
        <p class="page-desc">汇总各业务模块的关键指标，先看总量再看异常。</p>
      </div>
      <div class="page-actions">
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
        <tr><th>业务模块</th><th>今日新增</th><th>待处理</th><th>异常量</th></tr>
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
    <h3 class="section-title">待办台账</h3>
    <table class="data-table">
      <thead>
        <tr><th>业务模块</th><th>事项</th><th>对象</th><th>待办人</th><th>说明</th></tr>
      </thead>
      <tbody>
        <tr v-for="todo in todos" :key="todo.key">
          <td>{{ todo.module }}</td>
          <td>{{ todo.item }}</td>
          <td>{{ todo.target }}</td>
          <td>{{ todo.owner || '—' }}</td>
          <td>{{ todo.note }}</td>
        </tr>
        <tr v-if="!todos.length">
          <td colspan="5" class="empty-state">暂无待办事项</td>
        </tr>
      </tbody>
    </table>
    <footer class="page-foot">
      <span>数据保存在本机浏览器里，换浏览器或清缓存会回到示例数据</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { loadOverview } from '@/api/local-service'
import type { OverviewResult } from '@/data/types'

const cards = ref<OverviewResult['cards']>([])
const moduleRows = ref<OverviewResult['modules']>([])
const todos = ref<OverviewResult['todos']>([])

function refresh() {
  const payload = loadOverview()
  cards.value = payload.cards
  moduleRows.value = payload.modules
  todos.value = payload.todos
}

onMounted(refresh)
</script>

<style scoped>
.section-title {
  margin: 16px 0 8px;
  font-size: 15px;
}
</style>
