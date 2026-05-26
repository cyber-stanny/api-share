<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { fmt, pct } from '@shared/format';
import { baseUrl } from '@shared/api/client';
import KeyModal from '../components/KeyModal.vue';

const dashboard = useDashboardStore();
const showKeyModal = ref(false);
const displayedKey = ref('');
const loading = ref(false);
const error = ref('');

const recommended = { id: 'qwen3.7-max', provider: 'Aliyun Token Plan' };

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
  await Promise.all([dashboard.loadProfile(), dashboard.loadModels()]);
  const firstModel = dashboard.models.find(m => m.id === 'qwen3.7-max') || dashboard.models[0];
  if (firstModel) {
    recommended.id = firstModel.id;
    recommended.provider = firstModel.provider;
  }
  } catch (e: any) {
    error.value = e.message || '数据加载失败';
  } finally {
    loading.value = false;
  }
}

function renderQuickConfig(): string {
  const model = recommended.id;
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：qwen3.7-max';
  return `${recommendedNote}
# 当前示例来源：${recommended.provider}
export ANTHROPIC_BASE_URL="${baseUrl()}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export ANTHROPIC_MODEL="${model}"`;
}

async function handleRegenerateKey() {
  if (!confirm('确定重新生成 API Key？旧 Key 会立即失效。')) return;
  const newKey = await dashboard.regenerateKey();
  displayedKey.value = newKey;
  showKeyModal.value = true;
  await loadData();
}

onMounted(loadData);
</script>

<template>
  <div class="overview-page">
    <div class="headline">
      <h2>概览</h2>
      <div class="student-meta" v-if="dashboard.profile">
        {{ dashboard.profile.studentId }}
        {{ dashboard.profile.name ? '· ' + dashboard.profile.name : '' }}
      </div>
    </div>

    <div v-if="loading" class="state-msg">加载中…</div>
    <div v-else-if="error" class="state-msg err">{{ error }}</div>

    <div class="provider-cards" v-if="dashboard.profile && !loading">
      <!-- MiMo Card -->
      <div class="provider-card">
        <div class="provider-header">
          <div class="provider-title">
            <span class="dot" style="background:#3DB88B"></span>
            <span>MiMo</span>
          </div>
        </div>
        <div class="metric-group">
          <div class="metric">
            <div class="metric-label">今日</div>
            <div class="metric-value">{{ fmt(dashboard.profile.dailyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.dailyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.dailyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: pct(dashboard.profile.dailyTokensUsed, dashboard.profile.quota?.dailyTokenLimit || 0) + '%', background: '#3DB88B' }"></span></div>
          </div>
          <div class="metric">
            <div class="metric-label">本周</div>
            <div class="metric-value">{{ fmt(dashboard.profile.weeklyTokensUsed) }}</div>
            <div class="metric-ratio">{{ fmt(dashboard.profile.weeklyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.weeklyTokenLimit || 0) }} tokens</div>
            <div class="progress-bar"><span :style="{ width: pct(dashboard.profile.weeklyTokensUsed, dashboard.profile.quota?.weeklyTokenLimit || 0) + '%', background: '#3DB88B' }"></span></div>
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

    <div class="api-key-card" v-if="dashboard.profile && !loading">
      <div class="api-key-header">
        <div class="provider-title">
          <span class="dot" style="background:#8B5CF6"></span>
          <span>API Key</span>
        </div>
      </div>
      <div class="api-key-body">
        <div class="api-key-value">{{ dashboard.profile.apiKeyPrefix }}...</div>
        <div class="api-key-sub">完整 Key 只在注册或重置时显示</div>
      </div>
    </div>

    <div v-if="!loading" class="wide-grid">
      <div class="block">
        <h3>快速配置</h3>
        <div class="code">{{ renderQuickConfig() }}</div>
      </div>
      <div class="block">
        <h3>API Key 管理</h3>
        <p style="color:var(--muted);font-size:13px;line-height:1.7;margin-top:0">如果 Key 泄露，可以重新生成。旧 Key 会立即失效，新 Key 只显示一次。</p>
        <button class="btn danger" @click="handleRegenerateKey">重新生成 Key</button>
      </div>
    </div>


    <KeyModal
      :visible="showKeyModal"
      :api-key="displayedKey"
      @close="showKeyModal = false"
    />
  </div>
</template>

<style scoped>
.overview-page { padding: 28px; max-width: 1180px; margin: 0 auto; }
.headline { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 20px; }
.headline h2 { margin: 0; font: 700 24px var(--serif); }
.student-meta { color: var(--muted); font: 12px var(--mono); }
.provider-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 18px;
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

.metric-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metric {
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

.api-key-card {
  background: var(--surface);
  border-radius: 10px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  margin-bottom: 18px;
}

.api-key-header { margin-bottom: 12px; }

.api-key-value {
  font: 600 18px var(--mono);
  margin-bottom: 4px;
}

.api-key-sub { font-size: 12px; color: var(--muted); }
.wide-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr); gap: 18px; }
.block { padding: 18px; background: var(--surface); border-radius: 8px; margin-bottom: 18px; }
.block h3 { margin: 0 0 14px; font-size: 14px; }
.code {
  background: var(--shell);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  font: 12px/1.7 var(--mono);
  overflow: auto;
  white-space: pre-wrap;
}
.state-msg {
  color: var(--muted);
  font-size: 13px;
  padding: 32px 0;
  text-align: center;
}
.state-msg.err { color: var(--danger); }
@media (max-width: 900px) {
  .cards, .wide-grid { grid-template-columns: 1fr; }
}
</style>
