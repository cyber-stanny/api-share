<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtTokens } from '@shared/format';
import type { User } from '@shared/api/types';
import QuotaEditor from '../components/QuotaEditor.vue';

const students = ref<User[]>([]);
const showQuotaEditor = ref(false);
const editingStudent = ref<{ id: string; studentId: string; daily: number; weekly: number } | null>(null);

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

async function handleQuotaSave(daily: number, weekly: number) {
  if (!editingStudent.value) return;
  await api(`/api/admin/students/${editingStudent.value.id}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ dailyTokenLimit: daily, weeklyTokenLimit: weekly }),
  });
  showQuotaEditor.value = false;
  loadStudents();
}

onMounted(loadStudents);
</script>

<template>
  <div class="students-page">
    <div class="page-header">
      <h2>学生列表</h2>
      <button class="btn btn-primary btn-sm" @click="$router.push('/whitelist?add=true')">添加学生</button>
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
</style>
