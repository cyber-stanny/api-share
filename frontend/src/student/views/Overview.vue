<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { fmt, pct } from '@shared/format';
import { baseUrl } from '@shared/api/client';
import KeyModal from '../components/KeyModal.vue';

const dashboard = useDashboardStore();
const showKeyModal = ref(false);
const displayedKey = ref('');

const recommended = { id: 'MiniMax-M2.7', provider: 'MiniMax Token Plan' };

async function loadData() {
  await Promise.all([dashboard.loadProfile(), dashboard.loadModels()]);
  const firstModel = dashboard.models.find(m => String(m.provider || '').includes('MiniMax')) || dashboard.models[0];
  if (firstModel) {
    recommended.id = firstModel.id;
    recommended.provider = firstModel.provider;
  }
}

function renderQuickConfig(): string {
  const model = recommended.id;
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：MiniMax-M2.7 / MiniMax-M2.7-highspeed';
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

    <div class="cards" v-if="dashboard.profile">
      <div class="stat">
        <div class="stat-label">MiMo 今日 Token</div>
        <div class="stat-value">{{ fmt(dashboard.profile.dailyTokensUsed) }}</div>
        <div class="stat-sub">{{ fmt(dashboard.profile.dailyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.dailyTokenLimit || 0) }} MiMo tokens</div>
        <div class="bar"><span :style="{ width: pct(dashboard.profile.dailyTokensUsed, dashboard.profile.quota?.dailyTokenLimit || 0) + '%' }"></span></div>
      </div>
      <div class="stat">
        <div class="stat-label">MiMo 本周 Token</div>
        <div class="stat-value">{{ fmt(dashboard.profile.weeklyTokensUsed) }}</div>
        <div class="stat-sub">{{ fmt(dashboard.profile.weeklyTokensUsed) }} / {{ fmt(dashboard.profile.quota?.weeklyTokenLimit || 0) }} MiMo tokens</div>
        <div class="bar"><span :style="{ width: pct(dashboard.profile.weeklyTokensUsed, dashboard.profile.quota?.weeklyTokenLimit || 0) + '%', background: 'var(--secondary)' }"></span></div>
      </div>
      <div class="stat">
        <div class="stat-label">MiniMax 今日调用</div>
        <div class="stat-value">{{ fmt(dashboard.profile.minimaxDailyRequestsUsed) }}</div>
        <div class="stat-sub">{{ fmt(dashboard.profile.minimaxDailyRequestsUsed) }} / {{ fmt(dashboard.profile.minimaxQuota?.dailyRequestLimit || 0) }} requests</div>
        <div class="bar"><span :style="{ width: pct(dashboard.profile.minimaxDailyRequestsUsed, dashboard.profile.minimaxQuota?.dailyRequestLimit || 0) + '%', background: '#5f7ea8' }"></span></div>
      </div>
      <div class="stat">
        <div class="stat-label">MiniMax 本周调用</div>
        <div class="stat-value">{{ fmt(dashboard.profile.minimaxWeeklyRequestsUsed) }}</div>
        <div class="stat-sub">{{ fmt(dashboard.profile.minimaxWeeklyRequestsUsed) }} / {{ fmt(dashboard.profile.minimaxQuota?.weeklyRequestLimit || 0) }} requests</div>
        <div class="bar"><span :style="{ width: pct(dashboard.profile.minimaxWeeklyRequestsUsed, dashboard.profile.minimaxQuota?.weeklyRequestLimit || 0) + '%', background: '#8b6a9b' }"></span></div>
      </div>
      <div class="stat">
        <div class="stat-label">API Key</div>
        <div class="stat-value" style="font-size:18px">{{ dashboard.profile.apiKeyPrefix }}...</div>
        <div class="stat-sub">完整 Key 只在注册或重置时显示</div>
      </div>
    </div>

    <div class="wide-grid">
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
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px; }
.stat { padding: 16px; background: var(--surface); border-radius: 8px; border-top: 2px solid var(--primary); }
.stat:nth-child(2) { border-top-color: var(--secondary); }
.stat:nth-child(3) { border-top-color: #5f7ea8; }
.stat:nth-child(4) { border-top-color: #8b6a9b; }
.stat-label { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.stat-value { margin: 8px 0 6px; font: 600 24px var(--mono); }
.stat-sub { color: var(--muted); font-size: 11px; }
.bar { height: 5px; background: var(--primary-light); border-radius: 999px; overflow: hidden; margin-top: 10px; }
.bar span { display: block; height: 100%; background: var(--primary); border-radius: inherit; }
.wide-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr); gap: 18px; }
.block { padding: 18px; background: var(--surface); border-radius: 8px; margin-bottom: 18px; }
.block h3 { margin: 0 0 14px; font-size: 14px; }
.code {
  background: #2D2D2D;
  color: #D5CEC4;
  border-radius: 8px;
  padding: 14px;
  font: 12px/1.7 var(--mono);
  overflow: auto;
  white-space: pre-wrap;
}
@media (max-width: 900px) {
  .cards, .wide-grid { grid-template-columns: 1fr; }
}
</style>
