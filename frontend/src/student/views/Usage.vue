<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { fmt, fmtDate } from '@shared/format';
import { escapeHtml } from '@shared/api/client';

const dashboard = useDashboardStore();
const provider = ref('');
const model = ref('');

function getBadgeClass(status: number): string {
  return Number(status) >= 400 ? 'badge err' : 'badge';
}

function handleFilter() {
  dashboard.loadUsage({
    provider: provider.value || undefined,
    model: model.value.trim() || undefined,
  });
}

onMounted(handleFilter);
</script>

<template>
  <div class="usage-page">
    <div class="block">
      <h3>调用日志</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:12px">仅展示近三天的调用记录。</p>
      <div class="filters">
        <select v-model="provider" class="control">
          <option value="">全部供应商</option>
          <option value="mimo">MiMo</option>
          <option value="minimax">MiniMax</option>
          <option value="deepseek">DeepSeek</option>
        </select>
        <input
          v-model="model"
          class="control"
          type="text"
          placeholder="按模型筛选"
          @keyup.enter="handleFilter"
        />
        <button class="btn" @click="handleFilter">查询</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>模型</th>
            <th>消耗 Tokens</th>
            <th>计费口径</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in dashboard.usageRecords" :key="r._id">
            <td>{{ fmtDate(r.createdAt) }}</td>
            <td><code>{{ escapeHtml(r.model || '-') }}</code></td>
            <td>{{ fmt(r.totalTokens) }}</td>
            <td>{{ escapeHtml(r.billingType || 'tokens') }} {{ r.billingUnits ? `· ${fmt(r.billingUnits)}` : '' }}</td>
            <td><span :class="getBadgeClass(r.status)">{{ r.status }}</span></td>
          </tr>
          <tr v-if="dashboard.usageRecords.length === 0">
            <td colspan="5" style="color:var(--muted)">暂无调用记录</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.usage-page { padding: 28px; max-width: 1180px; margin: 0 auto; }
.block { padding: 18px; background: var(--surface); border-radius: 8px; margin-bottom: 18px; }
.block h3 { margin: 0 0 14px; font-size: 14px; }
.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.control {
  min-width: 160px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
code { background: var(--primary-light); padding: 2px 6px; border-radius: 4px; }
.badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; background: var(--primary-light); color: var(--primary); }
.badge.err { background: rgba(199,91,91,.1); color: var(--danger); }
@media (max-width: 900px) {
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  .control {
    min-width: 0;
  }
}
</style>
