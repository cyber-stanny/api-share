<script setup lang="ts">
import { onMounted } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { fmt, fmtDate } from '@shared/format';
import { escapeHtml } from '@shared/api/client';

const dashboard = useDashboardStore();

function getBadgeClass(status: number): string {
  return Number(status) >= 400 ? 'badge err' : 'badge';
}

onMounted(() => dashboard.loadUsage());
</script>

<template>
  <div class="usage-page">
    <div class="block">
      <h3>调用日志</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:12px">仅展示近三天的调用记录。</p>
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
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
code { background: var(--primary-light); padding: 2px 6px; border-radius: 4px; }
.badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; background: var(--primary-light); color: var(--primary); }
.badge.err { background: rgba(199,91,91,.1); color: var(--danger); }
</style>
