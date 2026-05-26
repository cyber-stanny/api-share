<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmt } from '@shared/format';
import DateRangePicker from '@shared/components/DateRangePicker.vue';

interface ModelStats {
  model: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
  totalTokens: number;
  billingUnits: number;
  billingCostCny: number;
}

interface StudentSummary {
  studentId: string;
  name: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
  totalTokens: number;
  billingUnits: number;
  billingCostCny: number;
  models: ModelStats[];
}

const students = ref<StudentSummary[]>([]);
const startDate = ref('');
const endDate = ref('');
const loading = ref(false);
const error = ref('');
const truncated = ref(false);
const expandedStudents = ref(new Set<string>());

function toggleExpand(studentId: string) {
  if (expandedStudents.value.has(studentId)) {
    expandedStudents.value.delete(studentId);
  } else {
    expandedStudents.value.add(studentId);
  }
  // Force reactivity
  expandedStudents.value = new Set(expandedStudents.value);
}

function isExpanded(studentId: string): boolean {
  return expandedStudents.value.has(studentId);
}

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams();
    if (startDate.value) params.set('startDate', startDate.value);
    if (endDate.value) params.set('endDate', endDate.value);
    const data = await api<{ students: StudentSummary[]; truncated: boolean }>('/api/admin/usage/summary?' + params.toString());
    students.value = data.students;
    truncated.value = data.truncated;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="summary-page">
    <div class="page-header">
      <h2>用量总览</h2>
    </div>
    <div class="filter-row">
      <DateRangePicker
        v-model:start-date="startDate"
        v-model:end-date="endDate"
        @apply="loadData"
      />
      <button class="btn btn-sm" :disabled="loading" @click="loadData">{{ loading ? '查询中...' : '查询' }}</button>
    </div>
    <p class="hint">默认展示全量累计，可选择日期范围筛选。点击行可展开查看各模型明细。</p>
    <div v-if="error" class="state-msg err">{{ error }}</div>
    <div v-if="truncated" class="state-msg warn">数据量较大，结果可能被截断。</div>
    <div class="card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="col-expand"></th>
              <th>学号</th>
              <th>姓名</th>
              <th class="col-num">请求数</th>
              <th class="col-num">成功</th>
              <th class="col-num">失败</th>
              <th class="col-num">Tokens</th>
              <th class="col-num">计费量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="empty">加载中...</td>
            </tr>
            <template v-else-if="students.length > 0" v-for="s in students" :key="s.studentId">
              <tr class="student-row" @click="toggleExpand(s.studentId)">
                <td class="col-expand">
                  <span class="expand-icon">{{ isExpanded(s.studentId) ? '▼' : '▶' }}</span>
                </td>
                <td><code>{{ escapeHtml(s.studentId) }}</code></td>
                <td>{{ escapeHtml(s.name || '-') }}</td>
                <td class="col-num">{{ fmt(s.requests) }}</td>
                <td class="col-num">{{ fmt(s.successRequests) }}</td>
                <td class="col-num">{{ fmt(s.errorRequests) }}</td>
                <td class="col-num highlight">{{ fmt(s.totalTokens) }}</td>
                <td class="col-num">{{ fmt(s.billingUnits) }}</td>
              </tr>
              <tr v-if="isExpanded(s.studentId)" class="models-header">
                <td></td>
                <td colspan="2" class="models-label">模型明细</td>
                <td class="col-num">请求数</td>
                <td class="col-num">成功</td>
                <td class="col-num">失败</td>
                <td class="col-num">Tokens</td>
                <td class="col-num">计费量</td>
              </tr>
              <tr v-if="isExpanded(s.studentId)" v-for="m in s.models" :key="m.model" class="model-row">
                <td></td>
                <td colspan="2" class="model-name"><code>{{ escapeHtml(m.model) }}</code></td>
                <td class="col-num">{{ fmt(m.requests) }}</td>
                <td class="col-num">{{ fmt(m.successRequests) }}</td>
                <td class="col-num">{{ fmt(m.errorRequests) }}</td>
                <td class="col-num">{{ fmt(m.totalTokens) }}</td>
                <td class="col-num">{{ fmt(m.billingUnits) }}</td>
              </tr>
            </template>
            <tr v-else-if="!loading && students.length === 0">
              <td colspan="8" class="empty">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; font: 700 20px var(--serif); }
.filter-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}
.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 16px;
}
.card {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(45,45,45,.06);
  overflow: hidden;
}
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}
th, td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
th {
  background: var(--bg);
  font-weight: 600;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.col-expand { width: 30px; text-align: center; }
.col-num { text-align: right; font-variant-numeric: tabular-nums; }
.student-row {
  cursor: pointer;
  transition: background .1s;
}
.student-row:hover {
  background: var(--bg);
}
.expand-icon {
  font-size: 10px;
  color: var(--muted);
}
.highlight {
  font-weight: 600;
  color: var(--primary);
}
.models-header {
  background: var(--bg);
}
.models-header td {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 6px 12px;
}
.models-label {
  padding-left: 24px !important;
}
.model-row td {
  padding-left: 12px;
  font-size: 13px;
  color: var(--muted);
}
.model-row .model-name {
  padding-left: 24px;
}
.model-row .col-num {
  color: var(--text);
}
code {
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  font: 12px var(--mono);
}
.empty {
  text-align: center;
  color: var(--muted);
  padding: 40px;
}
.state-msg {
  font-size: 13px;
  margin-bottom: 12px;
}
.state-msg.err { color: var(--danger); }
.state-msg.warn { color: #c77b00; }
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  background: var(--bg);
  color: var(--text);
}
.btn-sm { padding: 6px 14px; font-size: 13px; }
.btn:disabled { opacity: .6; cursor: default; }
</style>
