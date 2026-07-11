<script setup lang="ts">
import { computed } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { baseUrl, openaiBaseUrl } from '@shared/api/client';

const dashboard = useDashboardStore();

const recommended = computed(() => {
  const m = dashboard.models.find(x => x.id === 'deepseek-v4-flash') || dashboard.models[0];
  return m || { id: 'deepseek-v4-flash', provider: 'DeepSeek Official API' };
});

const model = computed(() => recommended.value.id || 'deepseek-v4-flash');
const provider = computed(() => recommended.value.provider || 'DeepSeek Official API');

const claudeGuide = computed(() => {
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：deepseek-v4-flash';
  return `${recommendedNote}
# 当前示例来源：${provider.value}
export ANTHROPIC_BASE_URL="${baseUrl()}"
export ANTHROPIC_AUTH_TOKEN="${key}"
export ANTHROPIC_MODEL="${model.value}"`;
});

const openaiGuide = computed(() => {
  const key = '<你的 API Key>';
  const recommendedNote = '# 推荐模型：deepseek-v4-flash';
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
  background: var(--shell);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  font: 12px/1.7 var(--mono);
  overflow: auto;
  white-space: pre-wrap;
}
</style>
