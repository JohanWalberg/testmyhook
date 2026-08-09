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
  bodyTruncated: boolean;
  contentType: string | null;
  source: string;
  sourceIp: string | null;
  userAgent: string | null;
  bodySize: number;
  receivedAt: number;
  responseStatus: number;
  responseBody: string;
  responseDelayMs: number;
  durationMs: number;
}

export interface ApiEndpoint {
  slug: string;
  createdAt: number;
  lastActivityAt: number;
  responseStatus: number;
  responseBody: string;
  responseDelayMs: number;
  requestCount: number;
}
