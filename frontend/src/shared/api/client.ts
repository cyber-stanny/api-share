export function getMountPath(): string {
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
  const appRoutes = new Set(['admin', 'admin.html', 'index.html', 'api', 'health', 'v1', 'assets']);
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

function getStoredTokenForPath(path: string): string | null {
  if (path.startsWith('/api/admin/') && path !== '/api/admin/login') {
    return localStorage.getItem('adminToken');
  }

  if (path.startsWith('/api/auth/')) {
    const publicPaths = new Set([
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/reset-password',
    ]);
    if (!publicPaths.has(path)) {
      return localStorage.getItem('studentToken');
    }
  }

  return null;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const authHeaders: Record<string, string> = {};
  const resolvedToken = token || getStoredTokenForPath(path);
  if (resolvedToken) authHeaders.Authorization = `Bearer ${resolvedToken}`;

  const res = await fetch(getMountPath() + path, {
    cache: 'no-store',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
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
