export interface KV {
  k: string;
  v: string;
}

export interface Header {
  name: string;
  value: string;
}

export interface ApiRequest {
  id: number;
  method: string;
  path: string;
  query: KV[];
  headers: Header[];
  body: string;
  bodyIsText: boolean;
  contentType: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  bodySize: number;
  receivedAt: number;
  responseStatus: number;
  durationMs: number;
  isNew?: boolean;
}

export interface ApiEndpoint {
  token: string;
  name: string;
  secret: string;
  createdAt: number;
  expiresAt: number;
  paused: boolean;
  sigRequired: boolean;
  maxRequests: number;
  maxBodySize: number;
  responseStatus: number;
  responseContentType: string;
  responseBody: string;
  responseDelayMs: number;
  requestCount: number;
  lastReceivedAt: number | null;
  expired: boolean;
}

export interface ReplayResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  headers?: Header[];
  body?: string;
  timeMs: number;
  error?: string;
}

export type RejectedNotice =
  | { type: 'too_large'; limit: number }
  | { type: 'rate_limit'; limit: number };
