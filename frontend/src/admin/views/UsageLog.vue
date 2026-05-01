<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtDate, fmt } from '@shared/format';
import type { UsageRecord } from '@shared/api/types';

const records = ref<UsageRecord[]>([]);
const filterStudentId = ref('');

async function loadUsage() {
  const qs = filterStudentId.value ? `?studentId=${encodeURIComponent(filterStudentId.value)}` : '';
  const data = await api<{ records: UsageRecord[] }>('/api/admin/usage' + qs);
  records.value = data.records;
}

function handleFilter() {
  loadUsage();
}

onMounted(loadUsage);
</script>

<template>
  <div class="usage-page">
    <div class="page-header">
      <h2>调用日志</h2>
      <div class="filter-row">
        <input
          v-model="filterStudentId"
          placeholder="按学号筛选"
          @keyup.enter="handleFilter"
        />
        <button class="btn btn-sm" @click="handleFilter">查询</button>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>学号</th>
            <th>模型</th>
            <th>消耗 Tokens</th>
            <th>计费口径</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r._id">
            <td>{{ escapeHtml(r.studentId) }}</td>
            <td><code>{{ escapeHtml(r.model) }}</code></td>
            <td>{{ fmt(r.totalTokens) }}</td>
            <td>{{ escapeHtml(r.billingType || 'tokens') }} {{ r.billingUnits ? `· ${fmt(r.billingUnits)}` : '' }}</td>
            <td>{{ r.status }}</td>
            <td>{{ fmtDate(r.createdAt) }}</td>
          </tr>
          <tr v-if="records.length === 0">
            <td colspan="6" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; font-size: 20px; }
.filter-row { display: flex; gap: 8px; align-items: center; }
.filter-row input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
th { background: #fafafa; font-weight: 600; color: #666; font-size: 12px; }
code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.empty { text-align: center; color: #999; padding: 40px; }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
</style>
