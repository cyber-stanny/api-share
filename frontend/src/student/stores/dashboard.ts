import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@shared/api/client';
import type { User, ModelInfo, UsageRecord } from '@shared/api/types';

export interface Profile extends User {}
type ModelGroupResponse = { provider: string; items: ModelInfo[] } | [string, ModelInfo[]];

export const useDashboardStore = defineStore('dashboard', () => {
  const profile = ref<Profile | null>(null);
  const models = ref<ModelInfo[]>([]);
  const modelGroups = ref<[string, ModelInfo[]][]>([]);
  const usageRecords = ref<UsageRecord[]>([]);
  const lastFullKey = ref<string>('');

  async function loadProfile() {
    const data = await api<Profile>('/api/auth/profile');
    profile.value = data;
  }

  async function loadModels() {
    const data = await api<{ models: ModelInfo[]; groups?: ModelGroupResponse[] }>('/api/auth/models');
    models.value = data.models;
    modelGroups.value = Array.isArray(data.groups)
      ? data.groups.map((group): [string, ModelInfo[]] => Array.isArray(group) ? group : [group.provider, group.items])
      : [];
  }

  async function loadUsage(filters: { provider?: string; model?: string } = {}) {
    const params = new URLSearchParams({ pageSize: '20' });
    if (filters.provider) params.set('provider', filters.provider);
    if (filters.model) params.set('model', filters.model);
    const data = await api<{ records: UsageRecord[] }>(`/api/auth/usage?${params.toString()}`);
    usageRecords.value = data.records;
  }

  async function regenerateKey(): Promise<string> {
    const data = await api<{ apiKey: string }>('/api/auth/key/regenerate', { method: 'POST' });
    return data.apiKey;
  }

  return {
    profile,
    models,
    modelGroups,
    usageRecords,
    lastFullKey,
    loadProfile,
    loadModels,
    loadUsage,
    regenerateKey,
  };
});
