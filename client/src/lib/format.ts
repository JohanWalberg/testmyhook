import type { ApiRequest } from '../types';

/** "212 B", "1.4 kB", "2.9 kB", "1.2 MB" — SI units as in the design. */
export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "12s ago" / "2m ago" / "6h ago" for today, "18:04" for yesterday, "5 Aug, 14:02" beyond. */
export function listTime(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  if (sameDay(d, today)) {
    const diff = Math.max(0, now - ts);
    if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  const yesterday = new Date(now - 86_400_000);
  if (sameDay(d, yesterday)) return clock(d);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}, ${clock(d)}`;
}

/** Group label: "Today", "Yesterday", or "6 Aug 2026". */
export function dayLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  if (sameDay(d, new Date(now))) return 'Today';
  if (sameDay(d, new Date(now - 86_400_000))) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "8 Aug 2026, 01:38:49" for the detail header. */
export function detailTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  410: 'Gone', 413: 'Payload Too Large', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable'
};

export function statusFull(status: number): string {
  return STATUS_TEXT[status] ? `${status} ${STATUS_TEXT[status]}` : String(status);
}

export interface CodeSpan {
  text: string;
  kind: 'plain' | 'key' | 'str' | 'num' | 'lit';
}

export interface CodeLine {
  indent: number;
  spans: CodeSpan[];
}

const INLINE_LIMIT = 44;

function inlineSpans(value: unknown): CodeSpan[] | null {
  const compact = JSON.stringify(value);
  if (compact === undefined || compact.length > INLINE_LIMIT) return null;
  const spans: CodeSpan[] = [];
  const walk = (v: unknown, key: string | null): void => {
    if (key !== null) spans.push({ text: JSON.stringify(key), kind: 'key' }, { text: ': ', kind: 'plain' });
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v as object);
      spans.push({ text: keys.length ? '{ ' : '{', kind: 'plain' });
      keys.forEach((k, i) => {
        walk((v as Record<string, unknown>)[k], k);
        if (i < keys.length - 1) spans.push({ text: ', ', kind: 'plain' });
      });
      spans.push({ text: keys.length ? ' }' : '}', kind: 'plain' });
    } else if (Array.isArray(v)) {
      spans.push({ text: '[', kind: 'plain' });
      v.forEach((x, i) => {
        walk(x, null);
        if (i < v.length - 1) spans.push({ text: ', ', kind: 'plain' });
      });
      spans.push({ text: ']', kind: 'plain' });
    } else if (typeof v === 'string') {
      spans.push({ text: JSON.stringify(v), kind: 'str' });
    } else if (typeof v === 'number') {
      spans.push({ text: String(v), kind: 'num' });
    } else {
      spans.push({ text: String(v), kind: 'lit' });
    }
  };
  walk(value, null);
  return spans;
}

/**
 * Renders JSON as colorized lines, inlining objects/arrays that fit on one
 * short line — matching the design's `{ "sku": "TS-BLK-M", "qty": 2 },` rows.
 */
export function jsonToLines(value: unknown): CodeLine[] {
  const out: CodeLine[] = [];
  const walk = (v: unknown, indent: number, key: string | null, last: boolean): void => {
    const pre: CodeSpan[] = key !== null
      ? [{ text: JSON.stringify(key), kind: 'key' }, { text: ': ', kind: 'plain' }]
      : [];
    const tail = last ? '' : ',';
    const inline = indent > 0 ? inlineSpans(v) : null;
    if (inline && v !== null && typeof v === 'object') {
      out.push({ indent, spans: [...pre, ...inline, ...(tail ? [{ text: tail, kind: 'plain' as const }] : [])] });
      return;
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v as object);
      out.push({ indent, spans: [...pre, { text: '{', kind: 'plain' }] });
      keys.forEach((k, i) => walk((v as Record<string, unknown>)[k], indent + 1, k, i === keys.length - 1));
      out.push({ indent, spans: [{ text: '}' + tail, kind: 'plain' }] });
    } else if (Array.isArray(v)) {
      out.push({ indent, spans: [...pre, { text: '[', kind: 'plain' }] });
      v.forEach((x, i) => walk(x, indent + 1, null, i === v.length - 1));
      out.push({ indent, spans: [{ text: ']' + tail, kind: 'plain' }] });
    } else {
      const span: CodeSpan =
        typeof v === 'string'
          ? { text: JSON.stringify(v), kind: 'str' }
          : typeof v === 'number'
            ? { text: String(v), kind: 'num' }
            : { text: String(v), kind: 'lit' };
      out.push({ indent, spans: [...pre, span, ...(tail ? [{ text: tail, kind: 'plain' as const }] : [])] });
    }
  };
  walk(value, 0, null, true);
  return out;
}

/**
 * List-row title. Subpaths speak for themselves; for bare "/" requests we
 * surface the event name from a JSON body when there is one, else a short id
 * tag so rows remain distinguishable.
 */
export function requestTitle(req: ApiRequest): string {
  if (req.path !== '/') return req.path;
  if (req.bodyIsText && req.body.length > 0 && req.body.length < 4096) {
    try {
      const parsed = JSON.parse(req.body) as Record<string, unknown>;
      for (const key of ['event', 'type', 'action', 'event_type', 'topic']) {
        if (typeof parsed[key] === 'string' && parsed[key]) return parsed[key] as string;
      }
    } catch {
      // not JSON — fall through
    }
  }
  return `/ #${req.id.toString(36)}`;
}

export function parsedJson(req: ApiRequest): unknown | undefined {
  if (!req.bodyIsText || req.body.trim() === '') return undefined;
  try {
    return JSON.parse(req.body);
  } catch {
    return undefined;
  }
}

const CURL_SKIP = new Set(['host', 'content-length', 'connection', 'accept-encoding']);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(req: ApiRequest, origin: string, slug: string): string {
  const qs = req.query.length
    ? '?' + req.query.map(({ k, v }) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const target = `${origin}/${slug}${req.path === '/' ? '' : req.path}${qs}`;
  const lines = [`curl -X ${req.method} ${shellQuote(target)}`];
  for (const h of req.headers) {
    if (CURL_SKIP.has(h.name.toLowerCase())) continue;
    lines.push(`  -H ${shellQuote(`${h.name}: ${h.value}`)}`);
  }
  if (req.bodyIsText && req.body.length > 0) {
    lines.push(`  -d ${shellQuote(req.body)}`);
  }
  return lines.join(' \\\n');
}

export function rawRequestText(req: ApiRequest, host: string, slug: string): string {
  const qs = req.query.length
    ? '?' + req.query.map(({ k, v }) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const hasHost = req.headers.some(h => h.name.toLowerCase() === 'host');
  const headerLines = req.headers.map(h => `${h.name}: ${h.value}`).join('\n');
  const body = req.bodyIsText ? req.body : `(binary body, ${formatSize(req.bodySize)})`;
  const target = `/${slug}${req.path === '/' ? '' : req.path}${qs}`;
  return `${req.method} ${target} HTTP/1.1\n${hasHost ? '' : `host: ${host}\n`}${headerLines}\n\n${body}`;
}
