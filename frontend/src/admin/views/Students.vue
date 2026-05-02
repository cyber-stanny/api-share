<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtTokens } from '@shared/format';
import type { User } from '@shared/api/types';
import QuotaEditor from '../components/QuotaEditor.vue';

const students = ref<User[]>([]);
const showQuotaEditor = ref(false);
const editingStudent = ref<{ id: string; studentId: string; daily: number; weekly: number } | null>(null);
const showAddDialog = ref(false);
const showResetDialog = ref(false);
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
  const data = await api<{ students: User[] }>('/api/admin/students');
  students.value = data.students;
}

function getDailyPct(s: User) {
  const limit = s.quota?.dailyTokenLimit || 500000;
  return limit > 0 ? Math.round((s.dailyTokensUsed / limit) * 100) : 0;
}

function getWeeklyPct(s: User) {
  const limit = s.quota?.weeklyTokenLimit || 2000000;
  return limit > 0 ? Math.round((s.weeklyTokensUsed / limit) * 100) : 0;
}

function getBadgeClass(pct: number) {
  if (pct >= 90) return 'badge-danger';
  if (pct >= 70) return 'badge-warn';
  return 'badge-ok';
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
  addForm.value = {
    studentId: '',
    name: '',
    password: '',
    dailyTokenLimit: 500000,
    weeklyTokenLimit: 2000000,
  };
  showAddDialog.value = true;
}

function openResetDialog(s: User) {
  resetForm.value = {
    id: s._id,
    studentId: s.studentId,
    newPassword: '',
  };
  showResetDialog.value = true;
}

async function handleQuotaSave(daily: number, weekly: number) {
  if (!editingStudent.value) return;
  await api(`/api/admin/students/${editingStudent.value.id}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ dailyTokenLimit: daily, weeklyTokenLimit: weekly }),
  });
  showQuotaEditor.value = false;
  loadStudents();
}

async function handleAddStudent() {
  await api('/api/admin/students', {
    method: 'POST',
    body: JSON.stringify(addForm.value),
  });
  showAddDialog.value = false;
  await loadStudents();
}

async function handleResetPassword() {
  await api(`/api/admin/students/${resetForm.value.id}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ newPassword: resetForm.value.newPassword }),
  });
  showResetDialog.value = false;
}

onMounted(loadStudents);
</script>

<template>
  <div class="students-page">
    <div class="page-header">
      <h2>学生列表</h2>
      <button class="btn btn-primary btn-sm" @click="openAddDialog">添加学生</button>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>Key 前缀</th>
            <th>MiMo 日限额</th>
            <th>MiMo 日已用</th>
            <th>MiMo 周限额</th>
            <th>MiMo 周已用</th>
            <th>MiniMax 日调用</th>
            <th>MiniMax 周调用</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in students" :key="s._id">
            <td>{{ escapeHtml(s.studentId) }}</td>
            <td>{{ escapeHtml(s.name) || '-' }}</td>
            <td><code>{{ escapeHtml(s.apiKeyPrefix) }}...</code></td>
            <td>{{ fmtTokens(s.quota?.dailyTokenLimit || 500000) }}</td>
            <td>
              <span :class="['badge', getBadgeClass(getDailyPct(s))]">
                {{ fmtTokens(s.dailyTokensUsed) }} ({{ getDailyPct(s) }}%)
              </span>
            </td>
            <td>{{ fmtTokens(s.quota?.weeklyTokenLimit || 2000000) }}</td>
            <td>
              <span :class="['badge', getBadgeClass(getWeeklyPct(s))]">
                {{ fmtTokens(s.weeklyTokensUsed) }} ({{ getWeeklyPct(s) }}%)
              </span>
            </td>
            <td>{{ fmtTokens(s.minimaxDailyRequestsUsed || 0) }}</td>
            <td>{{ fmtTokens(s.minimaxWeeklyRequestsUsed || 0) }}</td>
            <td>
              <button class="btn btn-sm" @click="openQuotaEditor(s)">调额度</button>
              <button class="btn btn-sm btn-secondary" @click="openResetDialog(s)">重置密码</button>
            </td>
          </tr>
        </tbody>
      </table>
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
          <div class="form-grid">
            <label>
              <span>学号</span>
              <input v-model="addForm.studentId" type="text" />
            </label>
            <label>
              <span>姓名</span>
              <input v-model="addForm.name" type="text" />
            </label>
            <label>
              <span>初始密码</span>
              <input v-model="addForm.password" type="password" />
            </label>
            <label>
              <span>每日 Token 上限</span>
              <input v-model.number="addForm.dailyTokenLimit" type="number" min="0" />
            </label>
            <label>
              <span>每周 Token 上限</span>
              <input v-model.number="addForm.weeklyTokenLimit" type="number" min="0" />
            </label>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="showAddDialog = false">取消</button>
            <button class="btn btn-primary" @click="handleAddStudent">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showResetDialog" class="modal-overlay" @click.self="showResetDialog = false">
        <div class="modal">
          <h3>重置密码</h3>
          <p class="muted">学号：{{ resetForm.studentId }}</p>
          <label class="single-field">
            <span>新密码</span>
            <input v-model="resetForm.newPassword" type="password" minlength="6" />
          </label>
          <div class="modal-actions">
            <button class="btn" @click="showResetDialog = false">取消</button>
            <button class="btn btn-primary" @click="handleResetPassword">保存</button>
          </div>
        </div>
      </div>
    </Teleport>
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
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
  overflow: auto;
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
th { background: #fafafa; font-weight: 600; color: #666; font-size: 12px; }
code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.badge-ok { background: #dcfce7; color: #166534; }
.badge-warn { background: #fef3c7; color: #92400e; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-primary { background: #4f46e5; color: #fff; }
.btn-secondary { margin-left: 8px; background: #e5e7eb; color: #374151; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: min(560px, calc(100vw - 24px));
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}
.modal h3 { margin: 0 0 16px; }
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.form-grid label,
.single-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #666;
}
.form-grid label:first-child,
.single-field {
  grid-column: 1 / -1;
}
.form-grid input,
.single-field input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.muted {
  color: #6b7280;
  font-size: 13px;
  margin: 0 0 12px;
}
@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
