<script setup lang="ts">
import type { ModelInfo } from '@shared/api/types';

defineProps<{
  groups: [string, ModelInfo[]][];
}>();
</script>

<template>
  <div class="model-group-list">
    <div v-for="[provider, models] in groups" :key="provider" class="model-group">
      <h3>{{ provider }}</h3>
      <div class="model-group-subtitle">{{ models.length }} 个模型</div>
      <div v-if="provider.includes('MiniMax')" class="model-group-subtitle">
        MiniMax highspeed 不额外加倍
      </div>
      <div class="model-grid">
        <div v-for="model in models" :key="model.id" class="model-card">
          <div class="model-id">{{ model.id }}</div>
          <div class="model-provider">{{ (model.protocols || ['openai']).join(' / ') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-group-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.model-group {
  padding: 18px;
  background: var(--surface);
  border-radius: 8px;
}
.model-group h3 { margin: 0 0 14px; font-size: 15px; }
.model-group-subtitle {
  margin-top: -8px;
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 12px;
}
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
}
.model-card {
  padding: 16px;
  background: var(--surface);
  border-radius: 8px;
  border-top: 2px solid var(--primary);
  min-height: 96px;
}
.model-card:nth-child(even) { border-top-color: var(--secondary); }
.model-id { font: 600 13px/1.5 var(--mono); word-break: break-word; }
.model-provider { margin-top: 6px; font-size: 12px; color: var(--muted); }
</style>
