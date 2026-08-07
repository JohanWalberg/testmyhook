import type { ApiRequest, Header } from '../types';

export const METHOD_COLORS: Record<string, [string, string]> = {
  GET: ['#2563EB', '#EFF4FF'],
  POST: ['#15803D', '#ECFDF3'],
  PUT: ['#C2410C', '#FFF4EC'],
  PATCH: ['#7C3AED', '#F5F1FF'],
  DELETE: ['#DC2626', '#FEF2F2'],
  OPTIONS: ['#6B6B7B', '#F4F4F7'],
  HEAD: ['#6B6B7B', '#F4F4F7']
};

export function methodColors(method: string): [string, string] {
  return METHOD_COLORS[method] ?? METHOD_COLORS.GET;
}

export function statusColors(status: number): [string, string] {
  if (status >= 200 && status < 300 && status !== 204) return ['#15803D', '#ECFDF3'];
  if (status === 204) return ['#6B6B7B', '#F4F4F7'];
  if (status >= 400) return ['#DC2626', '#FEF2F2'];
  return ['#6B6B7B', '#F4F4F7'];
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
};

export function statusFull(status: number): string {
  return STATUS_TEXT[status] ? `${status} ${STATUS_TEXT[status]}` : String(status);
}

export function timeOfDay(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fullTimestamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

export function shortDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function expiryLabel(expiresAt: number, now = Date.now()): string {
  const remaining = expiresAt - now;
  if (remaining <= 0) return shortDate(expiresAt);
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `in ${days} d ${hours} h`;
  if (hours > 0) return `in ${hours} h ${minutes} m`;
  return `in ${Math.max(minutes, 1)} m`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export function parseSize(input: string): number | undefined {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(b|kb|mb)?\s*$/i.exec(input);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = (m[2] ?? 'b').toLowerCase();
  return Math.round(n * (unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1));
}

const SENSITIVE_HEADER = /authorization|signature|secret|cookie|token|api[-_]?key/i;

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER.test(name);
}

export function maskValue(): string {
  return '••••••••••••';
}

export function parsedJsonBody(req: ApiRequest): unknown | undefined {
  if (!req.bodyIsText || req.body.trim() === '') return undefined;
  try {
    return JSON.parse(req.body);
  } catch {
    return undefined;
  }
}

export function requestPreview(req: ApiRequest): string {
  const parsed = parsedJsonBody(req);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    for (const key of ['event', 'type', 'action', 'id']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
  }
  if (req.bodyIsText && req.body.trim() !== '') {
    return req.body.replace(/\s+/g, ' ').slice(0, 80);
  }
  if (!req.bodyIsText) return `(binary body, ${formatSize(req.bodySize)})`;
  const qs = req.path.includes('?') ? req.path.slice(req.path.indexOf('?')) : '';
  return qs ? `${req.method.toLowerCase()} ${qs}` : '(no body)';
}

const CURL_SKIP = new Set(['host', 'content-length', 'connection', 'accept-encoding']);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(req: ApiRequest, origin: string): string {
  const lines = [`curl -X ${req.method} ${shellQuote(origin + req.path)}`];
  for (const h of req.headers) {
    if (CURL_SKIP.has(h.name.toLowerCase())) continue;
    lines.push(`  -H ${shellQuote(`${h.name}: ${h.value}`)}`);
  }
  if (req.bodyIsText && req.body.length > 0) {
    lines.push(`  -d ${shellQuote(req.body)}`);
  }
  return lines.join(' \\\n');
}

export function rawRequestText(req: ApiRequest, host: string, headerValue: (h: Header) => string): string {
  const hasHost = req.headers.some(h => h.name.toLowerCase() === 'host');
  const headerLines = req.headers.map(h => `${h.name}: ${headerValue(h)}`).join('\n');
  const body = req.bodyIsText ? req.body : `(binary body, ${formatSize(req.bodySize)})`;
  return `${req.method} ${req.path} HTTP/1.1\n${hasHost ? '' : `host: ${host}\n`}${headerLines}\n\n${body}`;
}

export interface JsonLinePart {
  t: string;
  c: string;
}

export interface JsonLine {
  n: number;
  indent: string;
  parts: JsonLinePart[];
}

const JSON_COLORS = { p: '#9A9AAB', k: '#5B36F0', s: '#0F766E', n: '#B45309', b: '#2563EB' };

/** Port of the prototype's jsonLines renderer: syntax-colored, line-numbered JSON. */
export function jsonLines(value: unknown): JsonLine[] {
  const c = JSON_COLORS;
  const out: JsonLine[] = [];
  const push = (ind: number, parts: JsonLinePart[]) =>
    out.push({ n: out.length + 1, indent: '  '.repeat(ind), parts });
  const walk = (val: unknown, ind: number, key: string | null, last: boolean): void => {
    const pre: JsonLinePart[] = key !== null ? [{ t: JSON.stringify(key), c: c.k }, { t: ': ', c: c.p }] : [];
    const tail = last ? '' : ',';
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const ks = Object.keys(val as object);
      if (ks.length === 0) {
        push(ind, pre.concat([{ t: '{}' + tail, c: c.p }]));
        return;
      }
      push(ind, pre.concat([{ t: '{', c: c.p }]));
      ks.forEach((k, i) => walk((val as Record<string, unknown>)[k], ind + 1, k, i === ks.length - 1));
      push(ind, [{ t: '}' + tail, c: c.p }]);
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        push(ind, pre.concat([{ t: '[]' + tail, c: c.p }]));
        return;
      }
      push(ind, pre.concat([{ t: '[', c: c.p }]));
      val.forEach((x, i) => walk(x, ind + 1, null, i === val.length - 1));
      push(ind, [{ t: ']' + tail, c: c.p }]);
    } else {
      let t: string;
      let col: string;
      if (typeof val === 'string') {
        t = JSON.stringify(val);
        col = c.s;
      } else if (typeof val === 'number') {
        t = String(val);
        col = c.n;
      } else {
        t = String(val);
        col = c.b;
      }
      push(ind, pre.concat([{ t, c: col }], tail ? [{ t: tail, c: c.p }] : []));
    }
  };
  walk(value, 0, null, true);
  return out;
}
