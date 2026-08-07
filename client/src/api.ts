import type { ApiEndpoint, ApiRequest, Header, ReplayResult } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = String(data.error);
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CreateEndpointInput {
  name?: string;
  expiry?: string;
  maxRequests?: number;
  responseStatus?: number;
  responseBody?: string;
}

export interface UpdateEndpointInput {
  name?: string;
  expiresAt?: number;
  paused?: boolean;
  sigRequired?: boolean;
  maxRequests?: number;
  maxBodySize?: number;
  responseStatus?: number;
  responseContentType?: string;
  responseBody?: string;
  responseDelayMs?: number;
}

export const api = {
  createEndpoint: (input: CreateEndpointInput) =>
    fetch('/api/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }).then(r => json<ApiEndpoint>(r)),

  getEndpoint: (token: string) => fetch(`/api/endpoints/${token}`).then(r => json<ApiEndpoint>(r)),

  updateEndpoint: (token: string, input: UpdateEndpointInput) =>
    fetch(`/api/endpoints/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }).then(r => json<ApiEndpoint>(r)),

  regenerate: (token: string) =>
    fetch(`/api/endpoints/${token}/regenerate`, { method: 'POST' }).then(r => json<ApiEndpoint>(r)),

  deleteEndpoint: (token: string) =>
    fetch(`/api/endpoints/${token}`, { method: 'DELETE' }).then(r => json<void>(r)),

  listRequests: (token: string) =>
    fetch(`/api/endpoints/${token}/requests`).then(r => json<ApiRequest[]>(r)),

  clearRequests: (token: string) =>
    fetch(`/api/endpoints/${token}/requests`, { method: 'DELETE' }).then(r => json<void>(r)),

  deleteRequest: (token: string, id: number) =>
    fetch(`/api/endpoints/${token}/requests/${id}`, { method: 'DELETE' }).then(r => json<void>(r)),

  replay: (token: string, input: { url: string; method: string; headers: Header[]; body: string; timeoutMs: number; followRedirects: boolean }) =>
    fetch(`/api/endpoints/${token}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }).then(r => json<ReplayResult>(r)),

  sendExample: (token: string) =>
    fetch(`/h/${token}?environment=sandbox&source=payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Id': 'evt_example' },
      body: JSON.stringify(
        {
          id: 'evt_example',
          event: 'payment.completed',
          data: { payment_id: 'pay_239184', amount: 1499, currency: 'SEK', status: 'completed' }
        },
        null,
        2
      )
    })
};

export function webhookUrl(token: string): string {
  return `${window.location.origin}/h/${token}`;
}
