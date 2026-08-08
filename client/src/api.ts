import type { ApiEndpoint, ApiRequest } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  createUrl: () => fetch('/api/urls', { method: 'POST' }).then(r => json<ApiEndpoint>(r)),

  getUrl: (slug: string) => fetch(`/api/urls/${slug}`).then(r => json<ApiEndpoint>(r)),

  updateResponse: (slug: string, input: { responseStatus?: number; responseBody?: string; responseDelayMs?: number }) =>
    fetch(`/api/urls/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }).then(r => json<ApiEndpoint>(r)),

  regenerate: (slug: string) =>
    fetch(`/api/urls/${slug}/regenerate`, { method: 'POST' }).then(r => json<ApiEndpoint>(r)),

  listRequests: (slug: string) => fetch(`/api/urls/${slug}/requests`).then(r => json<ApiRequest[]>(r)),

  getRequest: (slug: string, id: number) =>
    fetch(`/api/urls/${slug}/requests/${id}`).then(r => json<ApiRequest>(r)),

  deleteRequest: (slug: string, id: number) =>
    fetch(`/api/urls/${slug}/requests/${id}`, { method: 'DELETE' }).then(r => json<void>(r)),

  clearRequests: (slug: string) =>
    fetch(`/api/urls/${slug}/requests`, { method: 'DELETE' }).then(r => json<void>(r)),

  deleteUrl: (slug: string) =>
    fetch(`/api/urls/${slug}`, { method: 'DELETE' }).then(r => json<void>(r)),

  exportAllUrl: (slug: string) => `/api/urls/${slug}/export`
};

export function displayUrl(slug: string): string {
  return `${window.location.host}/${slug}`;
}

export function fullUrl(slug: string): string {
  return `${window.location.origin}/${slug}`;
}
