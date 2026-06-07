export function fmt(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString();
}

export function fmtTokens(n: number | null | undefined): string {
  if (!n) return '0';
  if (n >= 10000) return Math.round(n / 1000) + 'K';
  return n.toLocaleString();
}

export function fmtCny(n: number | null | undefined): string {
  if (!n) return '0';
  return Number(n).toFixed(2);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('zh-CN');
}

export function pct(used: number, limit: number): number {
  return limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
}

export function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    'mimo': 'MiMo',
    'MiMo': 'MiMo Token Plan',
    'aliyun': 'Aliyun Token Plan',
    'minimax': 'MiniMax (历史)',
    'deepseek': 'DeepSeek Official API',
  };
  return map[provider] || provider;
}

export function groupModelsByProvider<T extends { provider?: string; id: string }>(
  list: T[]
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const model of list || []) {
    const provider = model.provider || 'API Share';
    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider)!.push(model);
  }
  return [...groups.entries()];
}
