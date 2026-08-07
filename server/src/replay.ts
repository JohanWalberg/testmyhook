import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

export interface ReplayInput {
  url: string;
  method: string;
  headers: { name: string; value: string }[];
  body: string;
  timeoutMs?: number;
  followRedirects?: boolean;
}

export interface ReplayResult {
  ok: boolean;
  status?: number;
  statusText?: string;
  headers?: { name: string; value: string }[];
  body?: string;
  timeMs: number;
  error?: string;
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const MAX_RESPONSE_BYTES = 65_536;
const MAX_REDIRECTS = 3;

/** Returns true when the address belongs to a private, loopback, link-local or otherwise internal range. */
export function isForbiddenAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 special use
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast + reserved + broadcast
    return false;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('::ffff:')) return isForbiddenAddress(lower.slice(7)); // IPv4-mapped
    if (lower.startsWith('64:ff9b')) return true; // NAT64
    return false;
  }
  return true; // not an IP literal
}

/** Validates a destination URL and resolves its host, rejecting internal targets. Throws with a user-facing message. */
export async function validateDestination(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid destination URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https destinations are allowed.');
  }
  if (url.username || url.password) {
    throw new Error('Credentials in the destination URL are not allowed.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host.toLowerCase() === 'localhost' || host.toLowerCase().endsWith('.localhost') || host.toLowerCase().endsWith('.internal')) {
    throw new Error('Destination resolves to a private address and was blocked.');
  }
  if (isIP(host)) {
    if (isForbiddenAddress(host)) throw new Error('Destination resolves to a private address and was blocked.');
    return url;
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve host ${host}.`);
  }
  if (addresses.length === 0) throw new Error(`Could not resolve host ${host}.`);
  for (const { address } of addresses) {
    if (isForbiddenAddress(address)) {
      throw new Error('Destination resolves to a private address and was blocked.');
    }
  }
  return url;
}

const SKIPPED_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'expect', 'upgrade', 'keep-alive']);

function performRequest(url: URL, input: ReplayInput, signal: AbortSignal): Promise<{
  status: number; statusText: string; headers: { name: string; value: string }[]; body: string; location?: string;
}> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = {};
    for (const h of input.headers) {
      const name = h.name.trim();
      if (!name || SKIPPED_HEADERS.has(name.toLowerCase())) continue;
      headers[name] = h.value;
    }
    // Pin the connection to an address that was already validated against internal ranges.
    const req = mod.request(url, {
      method: input.method,
      headers,
      signal,
      lookup: (hostname, options, callback) => {
        lookup(hostname, { all: true }).then(addresses => {
          const safe = addresses.filter(a => !isForbiddenAddress(a.address));
          if (safe.length === 0) {
            callback(new Error('blocked_address'), '', 4);
            return;
          }
          if ((options as { all?: boolean }).all) {
            callback(null, safe as never, safe[0].family);
          } else {
            callback(null, safe[0].address as never, safe[0].family);
          }
        }).catch(err => callback(err, '', 4));
      }
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        if (size < MAX_RESPONSE_BYTES) {
          chunks.push(chunk.subarray(0, MAX_RESPONSE_BYTES - size));
        }
        size += chunk.length;
      });
      res.on('end', () => {
        const headerList: { name: string; value: string }[] = [];
        for (const [name, value] of Object.entries(res.headers)) {
          headerList.push({ name, value: Array.isArray(value) ? value.join(', ') : String(value ?? '') });
        }
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: headerList,
          body: Buffer.concat(chunks).toString('utf8') + (size > MAX_RESPONSE_BYTES ? '\n… (truncated)' : ''),
          location: res.headers.location
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (input.body && input.method !== 'GET' && input.method !== 'HEAD') req.write(input.body);
    req.end();
  });
}

export async function replayRequest(input: ReplayInput): Promise<ReplayResult> {
  const started = Date.now();
  const method = input.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return { ok: false, error: 'Unsupported HTTP method.', timeMs: 0 };
  }
  const timeout = Math.min(Math.max(input.timeoutMs ?? 10_000, 1_000), 10_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    let url = await validateDestination(input.url);
    let redirects = 0;
    for (;;) {
      const result = await performRequest(url, { ...input, method }, controller.signal);
      const isRedirect = result.status >= 301 && result.status <= 308 && result.location;
      if (isRedirect && input.followRedirects !== false && redirects < MAX_REDIRECTS) {
        redirects++;
        url = await validateDestination(new URL(result.location!, url).toString());
        continue;
      }
      return {
        ok: true,
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body,
        timeMs: Date.now() - started
      };
    }
  } catch (err) {
    const timeMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { ok: false, error: `Timed out after ${timeout} ms.`, timeMs };
    }
    if (message === 'blocked_address' || message.includes('blocked')) {
      return { ok: false, error: 'Destination resolves to a private address and was blocked.', timeMs };
    }
    return { ok: false, error: message.includes('ECONNREFUSED') ? 'Connection refused — check that the destination is reachable.' : message, timeMs };
  } finally {
    clearTimeout(timer);
  }
}
