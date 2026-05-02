<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api, escapeHtml } from '@shared/api/client';
import { fmtDate } from '@shared/format';
import type { WhitelistItem } from '@shared/api/types';

const whitelist = ref<WhitelistItem[]>([]);
const showAddDialog = ref(false);
const newIds = ref('');

async function loadWhitelist() {
  const data = await api<{ items: WhitelistItem[] }>('/api/admin/whitelist');
  whitelist.value = data.items;
}

async function addWhitelist() {
  const lines = newIds.value.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return;
  const items = lines.map(line => {
    const parts = line.split(/\s+/);
    return { studentId: parts[0], name: parts[1] || '' };
  });
  await api('/api/admin/whitelist', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
  showAddDialog.value = false;
  newIds.value = '';
  loadWhitelist();
}

async function deleteItem(id: string) {
  if (!confirm('确定删除？')) return;
  await api(`/api/admin/whitelist/${id}`, { method: 'DELETE' });
  loadWhitelist();
}

onMounted(loadWhitelist);
</script>

<template>
  <div class="whitelist-page">
    <div class="page-header">
      <h2>学号白名单</h2>
      <button class="btn primary btn-sm" @click="showAddDialog = true">添加白名单</button>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>学号</th>
            <th>姓名</th>
            <th>添加时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in whitelist" :key="w._id">
            <td>{{ escapeHtml(w.studentId) }}</td>
            <td>{{ escapeHtml(w.name) || '-' }}</td>
            <td>{{ fmtDate(w.addedAt) }}</td>
            <td>
              <button class="btn danger btn-sm" @click="deleteItem(w._id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="showAddDialog" class="modal-overlay" @click.self="showAddDialog = false">
        <div class="modal">
          <h3>添加白名单</h3>
          <p class="hint">每行一个，格式：<code>学号 姓名</code>（姓名选填，用空格分隔）</p>
          <textarea
            v-model="newIds"
            placeholder="202401050655 王思懿&#10;202401050687 张中宝&#10;202401050731"
          ></textarea>
          <div class="modal-actions">
            <button class="btn" @click="showAddDialog = false">取消</button>
            <button class="btn primary" @click="addWhitelist">添加</button>
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
.page-header h2 { margin: 0; font: 700 20px var(--serif); }
.card {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(45,45,45,.06);
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
th { background: var(--bg); font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; background: var(--bg); color: var(--text); }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn.primary { background: var(--primary); color: #fff; }
.btn.danger { background: #fae4e4; color: var(--danger); }
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(45,40,36,.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--surface); border-radius: 12px; padding: 28px; min-width: 400px;
  box-shadow: 0 12px 36px rgba(45,45,45,.08);
}
.modal h3 { margin: 0 0 12px; font: 700 18px var(--serif); }
.hint { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.hint code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font: 12px var(--mono); }
textarea {
  width: 100%; height: 100px; resize: vertical; padding: 10px 12px;
  border: 1px solid var(--border); border-radius: 8px; font-size: 14px;
  background: var(--bg); color: var(--text);
}
textarea:focus { border-color: var(--primary); background: var(--surface); outline: none; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
