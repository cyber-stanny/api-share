export function getMountPath(): string {
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
  const appRoutes = new Set(['admin', 'api', 'health', 'v1']);
  return firstSegment && !appRoutes.has(firstSegment) ? `/${firstSegment}` : '';
}

export function baseUrl(): string {
  return `${window.location.origin}${getMountPath()}`;
}

export function openaiBaseUrl(): string {
  return `${baseUrl()}/v1`;
}

export interface ApiOptions extends RequestInit {
  token?: string;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const authHeaders: Record<string, string> = {};
  if (token) authHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(getMountPath() + path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.error?.message || '请求失败');
  }
  return data.data as T;
}

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
