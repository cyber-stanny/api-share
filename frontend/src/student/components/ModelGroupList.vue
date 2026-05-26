<script setup lang="ts">
import { ref } from 'vue';
import type { ModelInfo } from '@shared/api/types';

const props = defineProps<{
  groups: [string, ModelInfo[]][];
}>();

const DEFAULT_VISIBLE = 2;
const expandedProviders = ref<Set<string>>(new Set());

function isExpanded(provider: string) {
  return expandedProviders.value.has(provider);
}

function toggle(provider: string) {
  const set = new Set(expandedProviders.value);
  if (set.has(provider)) {
    set.delete(provider);
  } else {
    set.add(provider);
  }
  expandedProviders.value = set;
}

function visibleModels(provider: string, models: ModelInfo[]) {
  if (isExpanded(provider) || models.length <= DEFAULT_VISIBLE) return models;
  return models.slice(0, DEFAULT_VISIBLE);
}
</script>

<template>
  <div class="model-group-list">
    <div v-for="[provider, models] in props.groups" :key="provider" class="model-group">
      <h3>{{ provider }}</h3>
      <div class="model-group-subtitle">{{ models.length }} 个模型</div>
      <div class="model-grid">
        <div v-for="model in visibleModels(provider, models)" :key="model.id" class="model-card">
          <div class="model-id">{{ model.id }}</div>
          <div class="model-protocols">
            <span
              v-for="p in (model.protocols || ['openai'])"
              :key="p"
              :class="['proto-badge', p]"
            >{{ p === 'anthropic' ? 'Anthropic' : 'OpenAI' }}</span>
          </div>
        </div>
      </div>
      <button
        v-if="models.length > DEFAULT_VISIBLE"
        class="toggle-btn"
        @click="toggle(provider)"
      >
        {{ isExpanded(provider) ? '收起' : `查看更多 (${models.length - DEFAULT_VISIBLE} 个)` }}
      </button>
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
  padding: 14px 16px;
  background: var(--bg);
  border-radius: 8px;
  border-top: 2px solid var(--primary);
}
.model-card:nth-child(even) { border-top-color: var(--secondary); }
.model-id { font: 600 13px/1.5 var(--mono); word-break: break-word; }
.model-protocols { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
.proto-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: .02em;
}
.proto-badge.openai { background: var(--primary-light); color: var(--primary); }
.proto-badge.anthropic { background: var(--secondary-light); color: var(--secondary); }
.toggle-btn {
  margin-top: 12px;
  border: 0;
  background: transparent;
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}
.toggle-btn:hover { color: var(--secondary); }
</style>
