import type { EndpointRow, RequestRow } from './db.js';

/** Known webhook senders, matched against the user-agent (design shows e.g. "shopify · 200 · 1.4 kB"). */
const SOURCES: [RegExp, string][] = [
  [/shopify/i, 'shopify'],
  [/stripe/i, 'stripe'],
  [/github/i, 'github'],
  [/slack/i, 'slack'],
  [/paypal/i, 'paypal'],
  [/jira|atlassian/i, 'jira'],
  [/discord/i, 'discord'],
  [/twilio/i, 'twilio'],
  [/sendgrid/i, 'sendgrid'],
  [/linear/i, 'linear'],
  [/curl/i, 'curl'],
  [/wget/i, 'wget'],
  [/postman/i, 'postman'],
  [/insomnia/i, 'insomnia'],
  [/node|undici/i, 'node'],
  [/python|requests/i, 'python'],
  [/go-http/i, 'go'],
  [/mozilla|chrome|safari/i, 'browser']
];

export function detectSource(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  for (const [pattern, name] of SOURCES) {
    if (pattern.test(userAgent)) return name;
  }
  const token = userAgent.split(/[/\s]/)[0].toLowerCase();
  return token.slice(0, 16) || 'unknown';
}

/** Bodies above this size are truncated in list/stream payloads; the full body stays in the database and in exports. */
export const DISPLAY_BODY_LIMIT = 131_072; // 128 KiB

export interface ApiRequest {
  id: number;
  method: string;
  path: string;
  query: { k: string; v: string }[];
  headers: { name: string; value: string }[];
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

function decodeBody(raw: Uint8Array | null): { body: string; bodyIsText: boolean } {
  if (!raw || raw.length === 0) return { body: '', bodyIsText: true };
  const buf = Buffer.from(raw);
  const text = buf.toString('utf8');
  // Round-trip check: if re-encoding differs, the payload is not valid UTF-8.
  const isText = Buffer.from(text, 'utf8').equals(buf) && !text.includes('\u0000');
  if (isText) return { body: text, bodyIsText: true };
  return { body: buf.toString('base64'), bodyIsText: false };
}

export function serializeRequest(r: RequestRow, opts: { fullBody?: boolean } = {}): ApiRequest {
  const decoded = decodeBody(r.raw_body);
  let { body } = decoded;
  let bodyTruncated = false;
  if (!opts.fullBody && body.length > DISPLAY_BODY_LIMIT) {
    body = body.slice(0, DISPLAY_BODY_LIMIT);
    bodyTruncated = true;
  }
  return {
    id: r.id,
    method: r.method,
    path: r.path,
    query: JSON.parse(r.query_json),
    headers: JSON.parse(r.headers_json),
    body,
    bodyIsText: decoded.bodyIsText,
    bodyTruncated,
    contentType: r.content_type,
    source: detectSource(r.user_agent),
    sourceIp: r.source_ip,
    userAgent: r.user_agent,
    bodySize: r.body_size,
    receivedAt: r.received_at,
    responseStatus: r.response_status,
    responseBody: r.response_body,
    responseDelayMs: r.response_delay_ms,
    durationMs: r.duration_ms
  };
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

export function serializeEndpoint(e: EndpointRow, requestCount: number): ApiEndpoint {
  return {
    slug: e.slug,
    createdAt: e.created_at,
    lastActivityAt: e.last_activity_at,
    responseStatus: e.response_status,
    responseBody: e.response_body,
    responseDelayMs: e.response_delay_ms,
    requestCount
  };
}
