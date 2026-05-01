import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@shared/api/client';
import type { User, ModelInfo, UsageRecord } from '@shared/api/types';

export interface Profile extends User {}

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
    const data = await api<{ models: ModelInfo[]; groups: [string, ModelInfo[]][] }>('/api/auth/models');
    models.value = data.models;
    modelGroups.value = data.groups;
  }

  async function loadUsage() {
    const data = await api<{ records: UsageRecord[] }>('/api/auth/usage?pageSize=20');
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
