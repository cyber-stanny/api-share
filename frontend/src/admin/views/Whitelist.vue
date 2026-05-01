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
      <button class="btn btn-primary btn-sm" @click="showAddDialog = true">添加白名单</button>
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
              <button class="btn btn-danger btn-sm" @click="deleteItem(w._id)">删除</button>
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
            <button class="btn btn-primary" @click="addWhitelist">添加</button>
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
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
th { background: #fafafa; font-weight: 600; color: #666; font-size: 12px; }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-primary { background: #4f46e5; color: #fff; }
.btn-danger { background: #ef4444; color: #fff; }
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff; border-radius: 12px; padding: 24px; min-width: 400px;
}
.modal h3 { margin-bottom: 12px; }
.hint { font-size: 13px; color: #666; margin-bottom: 8px; }
.hint code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
textarea { width: 100%; height: 100px; resize: vertical; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
</style>
