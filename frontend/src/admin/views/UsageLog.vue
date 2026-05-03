<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtDate, fmt } from '@shared/format';
import type { UsageRecord } from '@shared/api/types';

const records = ref<UsageRecord[]>([]);
const filterStudentId = ref('');
const loading = ref(false);
const error = ref('');

function getBadgeClass(status: number): string {
  return Number(status) >= 400 ? 'badge badge-err' : 'badge badge-ok';
}

async function loadUsage() {
  loading.value = true;
  error.value = '';
  try {
    const qs = filterStudentId.value ? `?studentId=${encodeURIComponent(filterStudentId.value)}` : '';
    const data = await api<{ records: UsageRecord[] }>('/api/admin/usage' + qs);
    records.value = data.records;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
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
          class="input"
          placeholder="按学号筛选"
          @keyup.enter="loadUsage"
        />
        <button class="btn btn-sm" :disabled="loading" @click="loadUsage">{{ loading ? '查询中…' : '查询' }}</button>
      </div>
    </div>

    <div v-if="error" class="state-msg err">{{ error }}</div>

    <div class="card">
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>学号</th>
            <th>供应商</th>
            <th>模型</th>
            <th>消耗 Tokens</th>
            <th>计费口径</th>
            <th>金额</th>
            <th>状态</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="empty">加载中…</td>
          </tr>
          <tr v-else v-for="r in records" :key="r._id">
            <td>{{ escapeHtml(r.studentId) }}</td>
            <td>{{ escapeHtml(r.billingProvider || r.provider || '-') }}</td>
            <td><code>{{ escapeHtml(r.model) }}</code></td>
            <td>{{ fmt(r.totalTokens) }}</td>
            <td>{{ escapeHtml(r.billingType || 'tokens') }} {{ r.billingUnits ? `· ${fmt(r.billingUnits)}` : '' }}</td>
            <td>{{ r.billingCostCny ? `¥${r.billingCostCny.toFixed(4)}` : '-' }}</td>
            <td><span :class="getBadgeClass(r.status)">{{ r.status }}</span></td>
            <td>{{ fmtDate(r.createdAt) }}</td>
          </tr>
          <tr v-if="!loading && records.length === 0">
            <td colspan="8" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
      </div>
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
.page-header h2 { margin: 0; font: 700 20px var(--serif); }
.filter-row { display: flex; gap: 8px; align-items: center; }
.filter-row .input { width: 180px; }
.card {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(45,45,45,.06);
  overflow: auto;
}
table { width: 100%; border-collapse: collapse; min-width: 800px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
th { background: var(--bg); font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font: 12px var(--mono); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.badge-ok { background: var(--primary-light); color: var(--primary); }
.badge-err { background: rgba(199,91,91,.1); color: var(--danger); }
.empty { text-align: center; color: var(--muted); padding: 40px; }
.state-msg { font-size: 13px; margin-bottom: 12px; }
.state-msg.err { color: var(--danger); }
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; background: var(--bg); color: var(--text); }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn:disabled { opacity: .6; cursor: default; }
</style>
