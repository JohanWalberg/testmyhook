import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Db, EndpointRow } from './db.js';
import type { EventHub } from './events.js';
import { RateLimiter } from './ratelimit.js';
import { serializeRequest } from './serialize.js';

export const GLOBAL_MAX_BODY = 1_048_576; // 1 MB
export const ENDPOINT_RATE_LIMIT = 120; // requests per minute per endpoint
const IP_RATE_LIMIT = 600; // requests per minute per source IP across all endpoints
const MAX_DELAY_MS = 5_000;

function readRawBody(req: Request, limit: number): Promise<{ body: Buffer; tooLarge: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        req.removeAllListeners('data');
        req.on('data', () => {}); // drain
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve({ body: Buffer.concat(chunks), tooLarge }));
    req.on('error', reject);
  });
}

function validSignature(endpoint: EndpointRow, req: Request, body: Buffer): boolean {
  const header = req.headers['x-webhook-signature'];
  if (typeof header !== 'string') return false;
  const provided = header.startsWith('sha256=') ? header.slice(7) : header;
  const expected = createHmac('sha256', endpoint.secret).update(body).digest('hex');
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createReceiver(db: Db, hub: EventHub): Router {
  const router = express.Router();
  const endpointLimiter = new RateLimiter(ENDPOINT_RATE_LIMIT, 60_000);
  const ipLimiter = new RateLimiter(IP_RATE_LIMIT, 60_000);
  const sweeper = setInterval(() => {
    endpointLimiter.sweep();
    ipLimiter.sweep();
  }, 60_000);
  sweeper.unref?.();

  router.all('/h/:token', async (req: Request, res: Response) => {
    const started = Date.now();
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');

    const token = req.params.token;
    const endpoint = /^[A-Za-z0-9]{6,32}$/.test(token) ? db.getEndpointByToken(token) : undefined;
    if (!endpoint) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (endpoint.expires_at <= started) {
      res.status(410).json({ error: 'endpoint_expired' });
      return;
    }

    const sourceIp = req.ip ?? null;
    if (!ipLimiter.hit(sourceIp ?? 'unknown') || !endpointLimiter.hit(token)) {
      hub.publish(token, { type: 'rejected', reason: 'rate_limit', limit: ENDPOINT_RATE_LIMIT });
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }

    const limit = Math.min(endpoint.max_body_size, GLOBAL_MAX_BODY);
    let body: Buffer;
    try {
      const result = await readRawBody(req, limit);
      if (result.tooLarge) {
        hub.publish(token, { type: 'rejected', reason: 'too_large', limit });
        res.status(413).json({ error: 'payload_too_large', limit });
        return;
      }
      body = result.body;
    } catch {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    if (endpoint.sig_required && !validSignature(endpoint, req, body)) {
      hub.publish(token, { type: 'rejected', reason: 'invalid_signature' });
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    const responseStatus = endpoint.response_status;
    const isPaused = endpoint.paused === 1;

    if (!isPaused) {
      const query = Object.entries(req.query).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : [v]).map(x => ({ k, v: typeof x === 'string' ? x : JSON.stringify(x) }))
      );
      const headers: { name: string; value: string }[] = [];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers.push({ name: req.rawHeaders[i].toLowerCase(), value: req.rawHeaders[i + 1] });
      }
      const stored = db.insertRequest({
        endpoint_id: endpoint.id,
        method: req.method,
        path: req.originalUrl,
        query_json: JSON.stringify(query),
        headers_json: JSON.stringify(headers),
        raw_body: body.length > 0 ? body : null,
        content_type: (req.headers['content-type'] as string | undefined) ?? null,
        source_ip: sourceIp,
        user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
        body_size: body.length,
        received_at: started,
        response_status: responseStatus,
        duration_ms: Date.now() - started
      });
      db.trimRequests(endpoint.id, endpoint.max_requests);
      hub.publish(token, { type: 'request', request: serializeRequest(stored) });
    }

    const send = () => {
      res.status(responseStatus);
      res.setHeader('X-TestMyHook-Id', token);
      if (responseStatus !== 204 && endpoint.response_body.length > 0) {
        res.setHeader('Content-Type', endpoint.response_content_type);
        res.send(endpoint.response_body);
      } else {
        res.end();
      }
    };
    const delay = Math.min(Math.max(endpoint.response_delay_ms, 0), MAX_DELAY_MS);
    if (delay > 0) setTimeout(send, delay);
    else send();
  });

  return router;
}
