export interface User {
  _id: string;
  studentId: string;
  name?: string;
  apiKeyPrefix: string;
  quota: {
    dailyTokenLimit: number;
    weeklyTokenLimit: number;
  };
  minimaxQuota?: {
    dailyRequestLimit: number;
    weeklyRequestLimit: number;
  };
  dailyTokensUsed: number;
  weeklyTokensUsed: number;
  minimaxDailyRequestsUsed: number;
  minimaxWeeklyRequestsUsed: number;
  createdAt: string;
}

export interface UsageRecord {
  _id: string;
  studentId: string;
  model: string;
  provider: string;
  totalTokens: number;
  billingType?: string;
  billingUnits?: number;
  status: number;
  createdAt: string;
}

export interface Upstream {
  _id: string;
  name: string;
  provider: string;
  protocol: 'openai' | 'anthropic';
  models: string[];
  priority: number;
  isActive: boolean;
}

export interface ModelInfo {
  id: string;
  provider: string;
  protocols?: string[];
}

export interface Quota {
  dailyTokenLimit: number;
  weeklyTokenLimit: number;
}

export interface WhitelistItem {
  _id: string;
  studentId: string;
  name?: string;
  addedAt: string;
}
