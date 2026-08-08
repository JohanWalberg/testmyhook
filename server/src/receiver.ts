import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Db } from './db.js';
import type { EventHub } from './events.js';
import { RateLimiter } from './ratelimit.js';
import { serializeRequest } from './serialize.js';

export const MAX_BODY_BYTES = 10 * 1_048_576; // 10 MB body max
export const MAX_REQUESTS_PER_URL = 100; // 100 webhooks kept per URL
export const ENDPOINT_RATE_LIMIT = 120; // per minute per URL
const IP_RATE_LIMIT = 600; // per minute per source IP
const MAX_DELAY_MS = 5_000;

/** Matches /<adjective>-<noun>-<nn> plus an optional captured subpath. */
export const RECEIVER_ROUTE = /^\/([a-z]+-[a-z]+-\d{2})(\/.*)?$/;

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

export function createReceiver(db: Db, hub: EventHub): Router {
  const router = express.Router();
  const endpointLimiter = new RateLimiter(ENDPOINT_RATE_LIMIT, 60_000);
  const ipLimiter = new RateLimiter(IP_RATE_LIMIT, 60_000);
  const sweeper = setInterval(() => {
    endpointLimiter.sweep();
    ipLimiter.sweep();
  }, 60_000);
  sweeper.unref?.();

  router.all(RECEIVER_ROUTE, async (req: Request, res: Response) => {
    const started = Date.now();
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    // Webhooks are usually server-to-server, but the docs show a browser
    // fetch() example — allow cross-origin senders to read the response.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', (req.headers['access-control-request-headers'] as string | undefined) ?? '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    const slug = req.params[0];
    const subpath = req.params[1] || '/';
    const endpoint = db.getEndpointBySlug(slug);
    if (!endpoint) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const sourceIp = req.ip ?? null;
    if (!ipLimiter.hit(sourceIp ?? 'unknown') || !endpointLimiter.hit(slug)) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }

    let body: Buffer;
    try {
      const result = await readRawBody(req, MAX_BODY_BYTES);
      if (result.tooLarge) {
        res.status(413).json({ error: 'payload_too_large', limit: MAX_BODY_BYTES });
        return;
      }
      body = result.body;
    } catch {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

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
      path: subpath,
      query_json: JSON.stringify(query),
      headers_json: JSON.stringify(headers),
      raw_body: body.length > 0 ? body : null,
      content_type: (req.headers['content-type'] as string | undefined) ?? null,
      source_ip: sourceIp,
      user_agent: (req.headers['user-agent'] as string | undefined) ?? null,
      body_size: body.length,
      received_at: started,
      response_status: endpoint.response_status,
      duration_ms: Date.now() - started
    });
    db.trimRequests(endpoint.id, MAX_REQUESTS_PER_URL);
    db.updateEndpoint(endpoint.id, { last_activity_at: started });
    hub.publish(slug, { type: 'request', request: serializeRequest(stored) });

    const send = () => {
      res.status(endpoint.response_status);
      if (endpoint.response_status !== 204 && endpoint.response_body.length > 0) {
        let isJson = true;
        try {
          JSON.parse(endpoint.response_body);
        } catch {
          isJson = false;
        }
        res.setHeader('Content-Type', isJson ? 'application/json' : 'text/plain; charset=utf-8');
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
