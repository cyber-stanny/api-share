export interface User {
  _id: string;
  studentId: string;
  name?: string;
  apiKeyPrefix: string;
  quota: {
    dailyTokenLimit: number;
    weeklyTokenLimit: number;
    mimoDailyTokenLimit: number;
    mimoWeeklyTokenLimit: number;
    aliyunDailyTokenLimit: number;
    aliyunWeeklyTokenLimit: number;
    deepseekDailyCostLimitCny: number;
    deepseekWeeklyCostLimitCny: number;
  };
  dailyTokensUsed: number;
  weeklyTokensUsed: number;
  aliyunDailyTokensUsed: number;
  aliyunWeeklyTokensUsed: number;
  deepseekDailyTokensUsed: number;
  deepseekWeeklyTokensUsed: number;
  deepseekDailyCostMicroCny: number;
  deepseekWeeklyCostMicroCny: number;
  deepseekDailyCostCny: number;
  deepseekWeeklyCostCny: number;
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
  billingProvider?: string;
  billingCostCny?: number;
  status: number;
  createdAt: string;
}

export interface UsageStatsRow {
  periodKey: string;
  label: string;
  requests: number;
  successRequests: number;
  errorRequests: number;
  totalTokens: number;
  billingUnits: number;
  billingCostMicroCny: number;
  billingCostCny: number;
}

export interface UsageStatsResponse {
  groupBy: 'day' | 'week' | 'month' | 'all';
  rows: UsageStatsRow[];
  summary: UsageStatsRow;
  firstDateKey: string | null;
  lastDateKey: string | null;
  truncated: boolean;
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
  mimoDailyTokenLimit: number;
  mimoWeeklyTokenLimit: number;
  aliyunDailyTokenLimit: number;
  aliyunWeeklyTokenLimit: number;
  deepseekDailyCostLimitCny: number;
  deepseekWeeklyCostLimitCny: number;
}

export interface WhitelistItem {
  _id: string;
  studentId: string;
  name?: string;
  addedAt: string;
}
