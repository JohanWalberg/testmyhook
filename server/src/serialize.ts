import type { EndpointRow, RequestRow } from './db.js';

export interface ApiRequest {
  id: number;
  method: string;
  path: string;
  query: { k: string; v: string }[];
  headers: { name: string; value: string }[];
  body: string;
  bodyIsText: boolean;
  contentType: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  bodySize: number;
  receivedAt: number;
  responseStatus: number;
  durationMs: number;
}

function decodeBody(raw: Uint8Array | null): { body: string; bodyIsText: boolean } {
  if (!raw || raw.length === 0) return { body: '', bodyIsText: true };
  const buf = Buffer.from(raw);
  const text = buf.toString('utf8');
  // Round-trip check: if re-encoding differs, the payload is not valid UTF-8.
  const isText = Buffer.from(text, 'utf8').equals(buf) && !text.includes('\u0000');
  if (isText) return { body: text, bodyIsText: true };
  return { body: buf.toString('base64'), bodyIsText: false };
}

export function serializeRequest(r: RequestRow): ApiRequest {
  const { body, bodyIsText } = decodeBody(r.raw_body);
  return {
    id: r.id,
    method: r.method,
    path: r.path,
    query: JSON.parse(r.query_json),
    headers: JSON.parse(r.headers_json),
    body,
    bodyIsText,
    contentType: r.content_type,
    sourceIp: r.source_ip,
    userAgent: r.user_agent,
    bodySize: r.body_size,
    receivedAt: r.received_at,
    responseStatus: r.response_status,
    durationMs: r.duration_ms
  };
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

export function serializeEndpoint(
  e: EndpointRow,
  extras: { requestCount: number; lastReceivedAt: number | null },
  now = Date.now()
): ApiEndpoint {
  return {
    token: e.token,
    name: e.name,
    secret: e.secret,
    createdAt: e.created_at,
    expiresAt: e.expires_at,
    paused: e.paused === 1,
    sigRequired: e.sig_required === 1,
    maxRequests: e.max_requests,
    maxBodySize: e.max_body_size,
    responseStatus: e.response_status,
    responseContentType: e.response_content_type,
    responseBody: e.response_body,
    responseDelayMs: e.response_delay_ms,
    requestCount: extras.requestCount,
    lastReceivedAt: extras.lastReceivedAt,
    expired: e.expires_at <= now
  };
}
