<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { fmt, fmtDate, pct } from '@shared/format';
import { escapeHtml } from '@shared/api/client';
import DateRangePicker from '@shared/components/DateRangePicker.vue';
import { getShanghaiTodayRange } from '@shared/timeRange';

const dashboard = useDashboardStore();
const provider = ref('');
const model = ref('');
const startDate = ref('');
const endDate = ref('');
const groupBy = ref<'day' | 'week' | 'month' | 'all'>('day');
const loading = ref(false);
const error = ref('');

function setTodayRange() {
  const range = getShanghaiTodayRange();
  startDate.value = range.startDate;
  endDate.value = range.endDate;
}

function showProviderToday(nextProvider: string) {
  provider.value = nextProvider;
  setTodayRange();
  handleFilter();
}

function getBadgeClass(status: number): string {
  return Number(status) >= 400 ? 'badge err' : 'badge';
}

async function handleFilter() {
  loading.value = true;
  error.value = '';
  try {
    const filters = {
      provider: provider.value || undefined,
      model: model.value.trim() || undefined,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
    };
    await Promise.all([
      dashboard.loadUsage(filters),
      dashboard.loadUsageStats({ ...filters, groupBy: groupBy.value }),
    ]);
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function mimiPct(current: number, limit: number) {
  return pct(current, limit);
}

function setGroupBy(nextGroupBy: typeof groupBy.value) {
  groupBy.value = nextGroupBy;
  handleFilter();
}

onMounted(() => {
  dashboard.loadProfile();
  handleFilter();
});
</script>

<template>
  <div class="usage-page">
    <!-- Provider Summary Cards -->
    <div class="provider-cards" v-if="dashboard.profile">
      <!-- MiMo Card -->
      <div class="provider-card">
        <div class="provider-header">
          <div class="provider-title">
            <span class="dot" style="background:#3DB88B"></span>
            <span>MiMo</span>
          </div>
          <a href="#" class="detail-link" @click.prevent="showProviderToday('mimo')">查看详情 →</a>
        </div>
        <div class="metric-group">
          <div class="metric">
            <div class="metric-label">今日</div>
            <div class="metric-value">{{ fmt(dashboard.profile.dailyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.dailyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.dailyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: mimiPct(dashboard.profile.dailyTokensUsed, dashboard.profile.quota?.dailyTokenLimit || 0) + '%', background: '#3DB88B' }"></span></div>
          </div>
          <div class="metric">
            <div class="metric-label">本周</div>
            <div class="metric-value">{{ fmt(dashboard.profile.weeklyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.weeklyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.weeklyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: mimiPct(dashboard.profile.weeklyTokensUsed, dashboard.profile.quota?.weeklyTokenLimit || 0) + '%', background: '#3DB88B' }"></span></div>
          </div>
        </div>
        <div class="provider-footer">mimo-v2.5-pro · 2x token calculation</div>
      </div>

      <!-- Aliyun Card -->
      <div class="provider-card">
        <div class="provider-header">
          <div class="provider-title">
            <span class="dot" style="background:#4D6BFE"></span>
            <span>Aliyun Token Plan</span>
          </div>
          <a href="#" class="detail-link" @click.prevent="showProviderToday('aliyun')">查看详情 →</a>
        </div>
        <div class="metric-group">
          <div class="metric">
            <div class="metric-label">今日</div>
            <div class="metric-value">{{ fmt(dashboard.profile.aliyunDailyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.aliyunDailyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.dailyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: pct(dashboard.profile.aliyunDailyTokensUsed, dashboard.profile.quota?.dailyTokenLimit || 0) + '%', background: '#4D6BFE' }"></span></div>
          </div>
          <div class="metric">
            <div class="metric-label">本周</div>
            <div class="metric-value">{{ fmt(dashboard.profile.aliyunWeeklyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.aliyunWeeklyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.weeklyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: pct(dashboard.profile.aliyunWeeklyTokensUsed, dashboard.profile.quota?.weeklyTokenLimit || 0) + '%', background: '#4D6BFE' }"></span></div>
          </div>
        </div>
        <div class="provider-footer">GLM · Kimi · DeepSeek · Qwen</div>
      </div>
    </div>

    <!-- Usage Stats -->
    <div class="block">
      <div class="block-title-row">
        <div>
          <h3>历史统计</h3>
          <p>按天保存长期汇总，可切换为周、月或累计视图。</p>
        </div>
        <div class="segment">
          <button :class="{ active: groupBy === 'day' }" type="button" @click="setGroupBy('day')">日</button>
          <button :class="{ active: groupBy === 'week' }" type="button" @click="setGroupBy('week')">周</button>
          <button :class="{ active: groupBy === 'month' }" type="button" @click="setGroupBy('month')">月</button>
          <button :class="{ active: groupBy === 'all' }" type="button" @click="setGroupBy('all')">累计</button>
        </div>
      </div>
      <div class="filters">
        <select v-model="provider" class="control">
          <option value="">全部供应商</option>
          <option value="mimo">MiMo</option>
          <option value="aliyun">Aliyun Token Plan</option>
          <option value="minimax">MiniMax（历史）</option>
          <option value="deepseek">DeepSeek（历史）</option>
        </select>
        <input
          v-model="model"
          class="control"
          type="text"
          placeholder="按模型筛选"
          @keyup.enter="handleFilter"
        />
        <DateRangePicker
          v-model:start-date="startDate"
          v-model:end-date="endDate"
          @apply="handleFilter"
        />
        <button class="btn" :disabled="loading" @click="handleFilter">{{ loading ? '查询中…' : '查询' }}</button>
      </div>
      <div v-if="error" class="state-msg err">{{ error }}</div>
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
          <tr v-if="dashboard.usageStats?.summary && dashboard.usageStats.rows.length > 1" class="summary-row">
            <td>合计</td>
            <td>{{ fmt(dashboard.usageStats.summary.requests) }}</td>
            <td>{{ fmt(dashboard.usageStats.summary.successRequests) }}</td>
            <td>{{ fmt(dashboard.usageStats.summary.errorRequests) }}</td>
            <td>{{ fmt(dashboard.usageStats.summary.totalTokens) }}</td>
            <td>{{ fmt(dashboard.usageStats.summary.billingUnits) }}</td>
            <td>{{ dashboard.usageStats.summary.billingCostCny ? `¥${dashboard.usageStats.summary.billingCostCny.toFixed(4)}` : '-' }}</td>
          </tr>
          <tr v-for="r in dashboard.usageStats?.rows || []" :key="r.periodKey">
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
          <tr v-else-if="(dashboard.usageStats?.rows || []).length === 0">
            <td colspan="7" class="empty">暂无统计数据</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Usage Logs -->
    <div class="block">
      <h3>调用日志</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:12px">仅展示近七天的调用明细。</p>
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>供应商</th>
            <th>模型</th>
            <th>消耗 Tokens</th>
            <th>计费口径</th>
            <th>金额</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in dashboard.usageRecords" :key="r._id">
            <td>{{ fmtDate(r.createdAt) }}</td>
            <td>{{ escapeHtml(r.billingProvider || r.provider || '-') }}</td>
            <td><code>{{ escapeHtml(r.model || '-') }}</code></td>
            <td>{{ fmt(r.totalTokens) }}</td>
            <td>{{ escapeHtml(r.billingType || 'tokens') }} {{ r.billingUnits ? `· ${fmt(r.billingUnits)}` : '' }}</td>
            <td>{{ r.billingCostCny ? `¥${r.billingCostCny.toFixed(4)}` : '-' }}</td>
            <td><span :class="getBadgeClass(r.status)">{{ r.status }}</span></td>
          </tr>
          <tr v-if="loading">
            <td colspan="7" class="empty">加载中…</td>
          </tr>
          <tr v-else-if="dashboard.usageRecords.length === 0">
            <td colspan="7" class="empty">暂无调用记录</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usage-page { padding: 28px; max-width: 1180px; margin: 0 auto; }

.provider-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.provider-card {
  background: var(--surface);
  border-radius: 10px;
  padding: 18px 20px;
  border: 1px solid var(--border);
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.provider-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.detail-link {
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
}
.detail-link:hover { color: var(--primary); }

.metric-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric {
  flex: 1;
  min-width: 0;
}

.metric-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 4px;
}

.metric-value {
  font: 600 22px var(--mono);
  margin-bottom: 2px;
}

.metric-ratio {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 6px;
}

.progress-bar {
  height: 5px;
  background: #f0f0f0;
  border-radius: 999px;
  overflow: hidden;
}
.progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width .3s;
}

.provider-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted);
}

.block { padding: 18px; background: var(--surface); border-radius: 8px; margin-bottom: 18px; }
.block h3 { margin: 0 0 14px; font-size: 14px; }
.block-title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}
.block-title-row h3 { margin-bottom: 6px; }
.block-title-row p { margin: 0; color: var(--muted); font-size: 13px; }
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
.filters {
  display: flex;
  flex-wrap: wrap;
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
table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px; }
th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
.summary-row td { font-weight: 700; background: var(--bg); }
code { background: var(--primary-light); padding: 2px 6px; border-radius: 4px; }
.badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; background: var(--primary-light); color: var(--primary); }
.badge.err { background: rgba(199,91,91,.1); color: var(--danger); }
.empty { text-align: center; color: var(--muted); padding: 32px; }
.state-msg { font-size: 13px; padding: 8px 0 12px; }
.state-msg.err { color: var(--danger); }
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
@media (max-width: 900px) {
  .provider-cards { grid-template-columns: 1fr; }
  .metric-group { flex-direction: column; gap: 14px; }
  .block-title-row { flex-direction: column; }
  .filters { flex-direction: column; align-items: stretch; }
  .control { min-width: 0; }
}
</style>
