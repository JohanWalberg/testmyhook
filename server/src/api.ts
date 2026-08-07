import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Db, EndpointRow } from './db.js';
import type { EventHub } from './events.js';
import { newSecret, newToken } from './tokens.js';
import { serializeEndpoint, serializeRequest } from './serialize.js';
import { replayRequest } from './replay.js';
import { RateLimiter } from './ratelimit.js';
import { GLOBAL_MAX_BODY } from './receiver.js';

export const EXPIRY_PRESETS_MS: Record<string, number> = {
  '15 minutes': 15 * 60_000,
  '1 hour': 60 * 60_000,
  '24 hours': 24 * 60 * 60_000,
  '7 days': 7 * 24 * 60 * 60_000
};

const MAX_STORED_REQUESTS = 500;
const MAX_RESPONSE_BODY = 16_384;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function endpointOr404(db: Db, req: Request, res: Response): EndpointRow | undefined {
  const token = req.params.token;
  const endpoint = /^[A-Za-z0-9]{6,32}$/.test(token) ? db.getEndpointByToken(token) : undefined;
  if (!endpoint) res.status(404).json({ error: 'not_found' });
  return endpoint;
}

function applySettings(body: Record<string, unknown>, patch: Partial<EndpointRow>): void {
  if (typeof body.name === 'string') patch.name = body.name.slice(0, 80);
  if (typeof body.paused === 'boolean') patch.paused = body.paused ? 1 : 0;
  if (typeof body.sigRequired === 'boolean') patch.sig_required = body.sigRequired ? 1 : 0;
  if (body.expiresAt !== undefined) {
    const t = clampInt(body.expiresAt, Date.now(), Date.now() + EXPIRY_PRESETS_MS['7 days'], 0);
    if (t > 0) patch.expires_at = t;
  }
  if (body.maxRequests !== undefined) patch.max_requests = clampInt(body.maxRequests, 1, MAX_STORED_REQUESTS, 100);
  if (body.maxBodySize !== undefined) patch.max_body_size = clampInt(body.maxBodySize, 1024, GLOBAL_MAX_BODY, GLOBAL_MAX_BODY);
  if (body.responseStatus !== undefined) patch.response_status = clampInt(body.responseStatus, 100, 599, 200);
  if (typeof body.responseContentType === 'string' && body.responseContentType.length <= 120 && !/[\r\n]/.test(body.responseContentType)) {
    patch.response_content_type = body.responseContentType;
  }
  if (typeof body.responseBody === 'string') patch.response_body = body.responseBody.slice(0, MAX_RESPONSE_BODY);
  if (body.responseDelayMs !== undefined) patch.response_delay_ms = clampInt(body.responseDelayMs, 0, 5000, 0);
}

export function createApi(db: Db, hub: EventHub): Router {
  const router = express.Router();
  const createLimiter = new RateLimiter(30, 60_000);
  router.use(express.json({ limit: '2mb' }));

  function fullEndpoint(e: EndpointRow) {
    return serializeEndpoint(e, {
      requestCount: db.countRequests(e.id),
      lastReceivedAt: db.lastReceivedAt(e.id)
    });
  }

  // Create endpoint
  router.post('/endpoints', (req, res) => {
    if (!createLimiter.hit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const expiryMs = EXPIRY_PRESETS_MS[String(body.expiry)] ?? EXPIRY_PRESETS_MS['24 hours'];
    const now = Date.now();
    const patch: Partial<EndpointRow> = {};
    applySettings(body, patch);
    const endpoint = db.createEndpoint({
      token: newToken(),
      name: patch.name ?? '',
      secret: newSecret(),
      created_at: now,
      expires_at: now + expiryMs,
      max_requests: patch.max_requests ?? 100,
      max_body_size: patch.max_body_size ?? GLOBAL_MAX_BODY,
      response_status: patch.response_status ?? 200,
      response_content_type: patch.response_content_type ?? 'application/json',
      response_body: patch.response_body ?? '{\n  "received": true\n}',
      response_delay_ms: patch.response_delay_ms ?? 0
    });
    res.status(201).json(fullEndpoint(endpoint));
  });

  // Read endpoint
  router.get('/endpoints/:token', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.json(fullEndpoint(endpoint));
  });

  // Update endpoint settings / custom response
  router.patch('/endpoints/:token', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const patch: Partial<EndpointRow> = {};
    applySettings((req.body ?? {}) as Record<string, unknown>, patch);
    db.updateEndpoint(endpoint.id, patch);
    const updated = db.getEndpointById(endpoint.id)!;
    hub.publish(endpoint.token, { type: 'endpoint', endpoint: fullEndpoint(updated) });
    res.json(fullEndpoint(updated));
  });

  // Regenerate token (invalidates the old URL, keeps data)
  router.post('/endpoints/:token/regenerate', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const token = newToken();
    db.updateEndpoint(endpoint.id, { token });
    res.json(fullEndpoint(db.getEndpointById(endpoint.id)!));
  });

  // Delete endpoint
  router.delete('/endpoints/:token', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    db.deleteEndpoint(endpoint.id);
    res.status(204).end();
  });

  // List captured requests
  router.get('/endpoints/:token/requests', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.json(db.listRequests(endpoint.id).map(serializeRequest));
  });

  // Clear all requests
  router.delete('/endpoints/:token/requests', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    db.clearRequests(endpoint.id);
    res.status(204).end();
  });

  // Delete one request
  router.delete('/endpoints/:token/requests/:id', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const ok = db.deleteRequest(endpoint.id, clampInt(req.params.id, 1, Number.MAX_SAFE_INTEGER, 0));
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  });

  // Replay a captured request to another destination (SSRF-guarded)
  router.post('/endpoints/:token/replay', async (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const headers = Array.isArray(body.headers)
      ? (body.headers as { name?: unknown; value?: unknown }[])
          .filter(h => typeof h?.name === 'string' && typeof h?.value === 'string')
          .map(h => ({ name: String(h.name), value: String(h.value) }))
          .slice(0, 64)
      : [];
    const result = await replayRequest({
      url: String(body.url ?? ''),
      method: String(body.method ?? 'POST'),
      headers,
      body: typeof body.body === 'string' ? body.body.slice(0, GLOBAL_MAX_BODY) : '',
      timeoutMs: clampInt(body.timeoutMs, 1_000, 10_000, 10_000),
      followRedirects: body.followRedirects !== false
    });
    res.json(result);
  });

  // Realtime stream
  router.get('/endpoints/:token/stream', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    });
    res.write(': connected\n\n');
    const unsubscribe = hub.subscribe(endpoint.token, res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  return router;
}
