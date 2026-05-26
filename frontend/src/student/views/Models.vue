<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { groupModelsByProvider } from '@shared/format';
import ModelGroupList from '../components/ModelGroupList.vue';

const dashboard = useDashboardStore();

const publicModelCards = [
  { id: 'mimo-v2.5-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-omni', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'qwen3.7-max', provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'glm-5.1', provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'kimi-k2.6', provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'deepseek-v4-flash', provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'deepseek-v4-pro', provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] },
];

const modelList = computed(() => dashboard.models.length ? dashboard.models : publicModelCards);
const groups = computed(() => groupModelsByProvider(modelList.value));

onMounted(() => dashboard.loadModels());
</script>

<template>
  <div class="models-page">
    <div class="block">
      <h3>模型总览</h3>
      <ModelGroupList :groups="groups" />
    </div>
  </div>
</template>

<style scoped>
.models-page { padding: 28px; max-width: 1180px; margin: 0 auto; }
.block { padding: 18px; background: var(--surface); border-radius: 8px; margin-bottom: 18px; }
.block h3 { margin: 0 0 14px; font-size: 14px; }
</style>
