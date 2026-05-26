<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtTokens } from '@shared/format';
import type { User } from '@shared/api/types';
import QuotaEditor from '../components/QuotaEditor.vue';

const students = ref<User[]>([]);
const loading = ref(false);
const error = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = ref(100);
const showQuotaEditor = ref(false);
const editingStudent = ref<{
  id: string; studentId: string;
  daily: number; weekly: number;
} | null>(null);
const showAddDialog = ref(false);
const showResetDialog = ref(false);
const addError = ref('');
const resetError = ref('');
const addForm = ref({
  studentId: '',
  name: '',
  password: '',
  dailyTokenLimit: 500000,
  weeklyTokenLimit: 2000000,
});
const resetForm = ref({
  id: '',
  studentId: '',
  newPassword: '',
});

async function loadStudents() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api<{ students: User[]; total: number }>(`/api/admin/students?page=${page.value}&pageSize=${pageSize.value}`);
    students.value = data.students;
    total.value = data.total;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function prevPage() {
  if (page.value > 1) { page.value--; loadStudents(); }
}

function nextPage() {
  if (page.value * pageSize.value < total.value) { page.value++; loadStudents(); }
}

function usagePct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barColor(pct: number) {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 70) return 'var(--secondary)';
  return 'var(--primary)';
}

function openQuotaEditor(s: User) {
  editingStudent.value = {
    id: s._id,
    studentId: s.studentId,
    daily: s.quota?.dailyTokenLimit || 500000,
    weekly: s.quota?.weeklyTokenLimit || 2000000,
  };
  showQuotaEditor.value = true;
}

function openAddDialog() {
  addForm.value = { studentId: '', name: '', password: '', dailyTokenLimit: 500000, weeklyTokenLimit: 2000000 };
  addError.value = '';
  showAddDialog.value = true;
}

function openResetDialog(s: User) {
  resetForm.value = { id: s._id, studentId: s.studentId, newPassword: '' };
  resetError.value = '';
  showResetDialog.value = true;
}

async function handleQuotaSave(daily: number, weekly: number) {
  if (!editingStudent.value) return;
  await api(`/api/admin/students/${editingStudent.value.id}/quota`, {
    method: 'PUT',
    body: JSON.stringify({
      dailyTokenLimit: daily, weeklyTokenLimit: weekly,
    }),
  });
  showQuotaEditor.value = false;
  loadStudents();
}

async function handleAddStudent() {
  addError.value = '';
  try {
    await api('/api/admin/students', { method: 'POST', body: JSON.stringify(addForm.value) });
    showAddDialog.value = false;
    await loadStudents();
  } catch (e: any) {
    addError.value = e.message || '创建失败';
  }
}

async function handleResetPassword() {
  resetError.value = '';
  try {
    await api(`/api/admin/students/${resetForm.value.id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword: resetForm.value.newPassword }),
    });
    showResetDialog.value = false;
  } catch (e: any) {
    resetError.value = e.message || '重置失败';
  }
}

onMounted(loadStudents);
</script>

<template>
  <div class="students-page">
    <div class="page-header">
      <h2>学生列表</h2>
      <button class="btn primary btn-sm" @click="openAddDialog">添加学生</button>
    </div>

    <div v-if="error" class="state-msg err">{{ error }}</div>

    <div class="card">
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>学号 / 姓名</th>
            <th>Key</th>
            <th>MiMo Token</th>
            <th>Aliyun Token Plan</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="5" class="empty">加载中…</td>
          </tr>
          <tr v-else v-for="s in students" :key="s._id">
            <td>
              <div class="cell-primary">{{ escapeHtml(s.studentId) }}</div>
              <div class="cell-sub">{{ escapeHtml(s.name) || '—' }}</div>
            </td>
            <td><code>{{ escapeHtml(s.apiKeyPrefix) }}…</code></td>
            <td>
              <div class="usage-row">
                <span class="usage-label">日</span>
                <div class="mini-bar">
                  <span :style="{ width: usagePct(s.dailyTokensUsed, s.quota?.dailyTokenLimit || 500000) + '%', background: barColor(usagePct(s.dailyTokensUsed, s.quota?.dailyTokenLimit || 500000)) }"></span>
                </div>
                <span class="usage-val">{{ fmtTokens(s.dailyTokensUsed) }} / {{ fmtTokens(s.quota?.dailyTokenLimit || 500000) }}</span>
              </div>
              <div class="usage-row">
                <span class="usage-label">周</span>
                <div class="mini-bar">
                  <span :style="{ width: usagePct(s.weeklyTokensUsed, s.quota?.weeklyTokenLimit || 2000000) + '%', background: barColor(usagePct(s.weeklyTokensUsed, s.quota?.weeklyTokenLimit || 2000000)) }"></span>
                </div>
                <span class="usage-val">{{ fmtTokens(s.weeklyTokensUsed) }} / {{ fmtTokens(s.quota?.weeklyTokenLimit || 2000000) }}</span>
              </div>
            </td>
            <td>
              <div class="usage-row">
                <span class="usage-label">日</span>
                <div class="mini-bar">
                  <span :style="{ width: usagePct(s.aliyunDailyTokensUsed || 0, s.quota?.dailyTokenLimit || 500000) + '%', background: barColor(usagePct(s.aliyunDailyTokensUsed || 0, s.quota?.dailyTokenLimit || 500000)) }"></span>
                </div>
                <span class="usage-val">{{ fmtTokens(s.aliyunDailyTokensUsed || 0) }} / {{ fmtTokens(s.quota?.dailyTokenLimit || 500000) }}</span>
              </div>
              <div class="usage-row">
                <span class="usage-label">周</span>
                <div class="mini-bar">
                  <span :style="{ width: usagePct(s.aliyunWeeklyTokensUsed || 0, s.quota?.weeklyTokenLimit || 2000000) + '%', background: barColor(usagePct(s.aliyunWeeklyTokensUsed || 0, s.quota?.weeklyTokenLimit || 2000000)) }"></span>
                </div>
                <span class="usage-val">{{ fmtTokens(s.aliyunWeeklyTokensUsed || 0) }} / {{ fmtTokens(s.quota?.weeklyTokenLimit || 2000000) }}</span>
              </div>
            </td>
            <td class="actions-cell">
              <button class="btn btn-sm" @click="openQuotaEditor(s)">调额度</button>
              <button class="btn btn-sm secondary" @click="openResetDialog(s)">重置密码</button>
            </td>
          </tr>
          <tr v-if="!loading && students.length === 0">
            <td colspan="5" class="empty">暂无学生数据</td>
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

    <QuotaEditor
      v-if="editingStudent"
      :visible="showQuotaEditor"
      :student-id="editingStudent.studentId"
      :current-daily="editingStudent.daily"
      :current-weekly="editingStudent.weekly"
      @close="showQuotaEditor = false"
      @save="handleQuotaSave"
    />

    <Teleport to="body">
      <div v-if="showAddDialog" class="modal-overlay" @click.self="showAddDialog = false">
        <div class="modal">
          <h3>添加学生</h3>
          <div v-if="addError" class="form-error">{{ addError }}</div>
          <div class="form-grid">
            <label>
              <span>学号</span>
              <input v-model="addForm.studentId" class="input" type="text" />
            </label>
            <label>
              <span>姓名</span>
              <input v-model="addForm.name" class="input" type="text" />
            </label>
            <label>
              <span>初始密码</span>
              <input v-model="addForm.password" class="input" type="password" />
            </label>
            <label>
              <span>每日 Token 上限</span>
              <input v-model.number="addForm.dailyTokenLimit" class="input" type="number" min="0" />
            </label>
            <label>
              <span>每周 Token 上限</span>
              <input v-model.number="addForm.weeklyTokenLimit" class="input" type="number" min="0" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="showAddDialog = false">取消</button>
            <button class="btn primary" @click="handleAddStudent">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showResetDialog" class="modal-overlay" @click.self="showResetDialog = false">
        <div class="modal">
          <h3>重置密码</h3>
          <p class="muted">学号：{{ resetForm.studentId }}</p>
          <div v-if="resetError" class="form-error">{{ resetError }}</div>
          <div class="field">
            <label>新密码</label>
            <input v-model="resetForm.newPassword" class="input" type="password" minlength="6" />
          </div>
          <div class="modal-actions">
            <button class="btn" @click="showResetDialog = false">取消</button>
            <button class="btn primary" @click="handleResetPassword">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45,40,36,.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
</style>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 { margin: 0; font: 700 20px var(--serif); }
.card {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(45,45,45,.06);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.table-scroll {
  overflow-x: auto;
  min-width: 100%;
}
table { width: 100%; border-collapse: collapse; min-width: 800px; }
th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
th { background: var(--bg); font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font: 12px var(--mono); }
.cell-primary { font-weight: 600; }
.cell-sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
.usage-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.usage-row:last-child { margin-bottom: 0; }
.usage-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--light-muted);
  width: 12px;
  flex-shrink: 0;
}
.mini-bar {
  flex: 1;
  height: 4px;
  background: var(--primary-light);
  border-radius: 999px;
  overflow: hidden;
  min-width: 48px;
}
.mini-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width .3s;
}
.usage-val { font-size: 11px; color: var(--muted); white-space: nowrap; font-family: var(--mono); }
.actions-cell { white-space: nowrap; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; background: var(--bg); color: var(--text); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn.primary { background: var(--primary); color: #fff; }
.btn.secondary { margin-left: 6px; background: var(--secondary-light); color: var(--secondary); }
.state-msg { font-size: 13px; margin-bottom: 12px; }
.state-msg.err { color: var(--danger); }
.form-error {
  background: rgba(199,91,91,.08);
  color: var(--danger);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}
.empty { text-align: center; color: var(--muted); padding: 40px; }
.modal {
  width: min(560px, calc(100vw - 24px));
  background: var(--surface);
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 12px 36px rgba(45,45,45,.08);
}
.modal h3 { margin: 0 0 16px; font: 700 18px var(--serif); }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.form-grid label:first-child { grid-column: 1 / -1; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
.muted { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
.pagination { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--border); }
.page-info { font-size: 13px; color: var(--muted); margin-right: auto; }
@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
