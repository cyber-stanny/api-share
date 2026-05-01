<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { baseUrl, openaiBaseUrl } from '@shared/api/client';

const dashboard = useDashboardStore();

const recommended = computed(() => {
  const m = dashboard.models.find(x => String(x.provider || '').includes('MiniMax')) || dashboard.models[0];
  return m || { id: 'MiniMax-M2.7', provider: 'MiniMax Token Plan' };
});

const model = computed(() => recommended.value.id || 'MiniMax-M2.7');
const provider = computed(() => recommended.value.provider || 'MiniMax Token Plan');

const claudeGuide = computed(() => {
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：MiniMax-M2.7 / MiniMax-M2.7-highspeed';
  return `${recommendedNote}
# 当前示例来源：${provider.value}
export ANTHROPIC_BASE_URL="${baseUrl()}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export ANTHROPIC_MODEL="${model.value}"`;
});

const openaiGuide = computed(() => {
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：MiniMax-M2.7 / MiniMax-M2.7-highspeed';
  return `${recommendedNote}
curl ${openaiBaseUrl()}/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${model.value}","messages":[{"role":"user","content":"你好"}]}'`;
});
</script>

<template>
  <div class="guide-page">
    <div class="block">
      <h3>Claude Code</h3>
      <div class="code">{{ claudeGuide }}</div>
    </div>
    <div class="block">
      <h3>OpenAI 兼容客户端</h3>
      <div class="code">{{ openaiGuide }}</div>
    </div>
  </div>
</template>

<style scoped>
.guide-page { padding: 28px; max-width: 1180px; margin: 0 auto; }
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
</style>
