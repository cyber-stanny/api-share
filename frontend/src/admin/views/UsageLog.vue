<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtDate, fmt } from '@shared/format';
import type { UsageRecord, UsageStatsResponse } from '@shared/api/types';
import DateRangePicker from '@shared/components/DateRangePicker.vue';

const records = ref<UsageRecord[]>([]);
const filterStudentId = ref('');
const provider = ref('');
const model = ref('');
const startDate = ref('');
const endDate = ref('');
const loading = ref(false);
const error = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const groupBy = ref<'day' | 'week' | 'month' | 'all'>('day');
const stats = ref<UsageStatsResponse | null>(null);

function getBadgeClass(status: number): string {
  return Number(status) >= 400 ? 'badge badge-err' : 'badge badge-ok';
}

async function loadUsage() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) });
    if (filterStudentId.value) params.set('studentId', filterStudentId.value);
    if (provider.value) params.set('provider', provider.value);
    if (model.value.trim()) params.set('model', model.value.trim());
    if (startDate.value) params.set('startDate', startDate.value);
    if (endDate.value) params.set('endDate', endDate.value);
    const statsParams = new URLSearchParams(params);
    statsParams.delete('page');
    statsParams.delete('pageSize');
    statsParams.set('groupBy', groupBy.value);
    const [usageData, statsData] = await Promise.all([
      api<{ records: UsageRecord[]; total: number }>('/api/admin/usage?' + params.toString()),
      api<UsageStatsResponse>('/api/admin/usage/stats?' + statsParams.toString()),
    ]);
    records.value = usageData.records;
    total.value = usageData.total;
    stats.value = statsData;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function searchUsage() {
  page.value = 1;
  loadUsage();
}

function prevPage() {
  if (page.value > 1) { page.value--; loadUsage(); }
}

function nextPage() {
  if (page.value * pageSize.value < total.value) { page.value++; loadUsage(); }
}

function setGroupBy(nextGroupBy: typeof groupBy.value) {
  groupBy.value = nextGroupBy;
  searchUsage();
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
          @keyup.enter="searchUsage"
        />
        <select v-model="provider" class="input input-select">
          <option value="">全部供应商</option>
          <option value="mimo">MiMo</option>
          <option value="minimax">MiniMax</option>
          <option value="deepseek">DeepSeek</option>
        </select>
        <input
          v-model="model"
          class="input"
          placeholder="按模型筛选"
          @keyup.enter="searchUsage"
        />
        <DateRangePicker
          v-model:start-date="startDate"
          v-model:end-date="endDate"
          @apply="searchUsage"
        />
        <button class="btn btn-sm" :disabled="loading" @click="searchUsage">{{ loading ? '查询中…' : '查询' }}</button>
      </div>
    </div>

    <div v-if="error" class="state-msg err">{{ error }}</div>

    <div class="card stats-card">
      <div class="stats-header">
        <div>
          <h3>历史统计</h3>
          <p>基于每日汇总数据，可按日、周、月或累计查看。</p>
        </div>
        <div class="segment">
          <button :class="{ active: groupBy === 'day' }" type="button" @click="setGroupBy('day')">日</button>
          <button :class="{ active: groupBy === 'week' }" type="button" @click="setGroupBy('week')">周</button>
          <button :class="{ active: groupBy === 'month' }" type="button" @click="setGroupBy('month')">月</button>
          <button :class="{ active: groupBy === 'all' }" type="button" @click="setGroupBy('all')">累计</button>
        </div>
      </div>
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>周期</th>
            <th>请求数</th>
            <th>成功</th>
            <th>失败</th>
            <th>Tokens</th>
            <th>计费量</th>
            <th>金额</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="stats?.summary && stats.rows.length > 1" class="summary-row">
            <td>合计</td>
            <td>{{ fmt(stats.summary.requests) }}</td>
            <td>{{ fmt(stats.summary.successRequests) }}</td>
            <td>{{ fmt(stats.summary.errorRequests) }}</td>
            <td>{{ fmt(stats.summary.totalTokens) }}</td>
            <td>{{ fmt(stats.summary.billingUnits) }}</td>
            <td>{{ stats.summary.billingCostCny ? `¥${stats.summary.billingCostCny.toFixed(4)}` : '-' }}</td>
          </tr>
          <tr v-for="r in stats?.rows || []" :key="r.periodKey">
            <td>{{ r.label }}</td>
            <td>{{ fmt(r.requests) }}</td>
            <td>{{ fmt(r.successRequests) }}</td>
            <td>{{ fmt(r.errorRequests) }}</td>
            <td>{{ fmt(r.totalTokens) }}</td>
            <td>{{ fmt(r.billingUnits) }}</td>
            <td>{{ r.billingCostCny ? `¥${r.billingCostCny.toFixed(4)}` : '-' }}</td>
          </tr>
          <tr v-if="loading">
            <td colspan="7" class="empty">加载中…</td>
          </tr>
          <tr v-else-if="(stats?.rows || []).length === 0">
            <td colspan="7" class="empty">暂无统计数据</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div class="card">
      <div class="log-header">
        <h3>七天明细日志</h3>
      </div>
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
      <div class="pagination">
        <span class="page-info">第 {{ page }} / {{ Math.ceil(total / pageSize) || 1 }} 页，共 {{ total }} 条</span>
        <button class="btn btn-sm" :disabled="page <= 1" @click="prevPage">上一页</button>
        <button class="btn btn-sm" :disabled="page * pageSize >= total" @click="nextPage">下一页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; font: 700 20px var(--serif); }
.filter-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filter-row .input { width: 180px; }
.filter-row .input-select { width: 150px; }
.card {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(45,45,45,.06);
  overflow: auto;
  margin-bottom: 16px;
}
.stats-card { padding-top: 0; }
.stats-header,
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.stats-header h3,
.log-header h3 { margin: 0; font-size: 14px; }
.stats-header p { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
.segment {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--bg);
}
.segment button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
.segment button.active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: 0 1px 3px rgba(45,45,45,.08);
}
table { width: 100%; border-collapse: collapse; min-width: 800px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
th { background: var(--bg); font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.summary-row td { font-weight: 700; background: var(--bg); }
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
.pagination { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); }
.page-info { font-size: 13px; color: var(--muted); margin-right: auto; }
</style>
