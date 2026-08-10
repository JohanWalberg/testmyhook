import type { Request, Response, Router } from 'express';
import express from 'express';
import type { Db, EndpointRow } from './db.js';
import type { EventHub } from './events.js';
import { newSlug, SLUG_PATTERN } from './slugs.js';
import { serializeEndpoint, serializeRequest } from './serialize.js';
import { RateLimiter } from './ratelimit.js';
import { sendFeedbackMail } from './mailer.js';
import { timingSafeEqual } from 'node:crypto';

const MAX_RESPONSE_BODY = 16_384;
const MAX_DELAY_MS = 5_000;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function endpointOr404(db: Db, req: Request, res: Response): EndpointRow | undefined {
  const slug = req.params.slug;
  const endpoint = SLUG_PATTERN.test(slug) ? db.getEndpointBySlug(slug) : undefined;
  if (!endpoint) res.status(404).json({ error: 'not_found' });
  return endpoint;
}

const MAX_STREAMS_PER_IP = 20;

export function createApi(db: Db, hub: EventHub): Router {
  const router = express.Router();
  const createLimiter = new RateLimiter(30, 60_000);
  const feedbackLimiter = new RateLimiter(5, 3_600_000);
  const streamsPerIp = new Map<string, number>();
  router.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  router.use(express.json({ limit: '64kb' }));

  function freshSlug(): string {
    for (let i = 0; i < 20; i++) {
      const slug = newSlug();
      if (!db.getEndpointBySlug(slug)) return slug;
    }
    throw new Error('could not allocate slug');
  }

  // Create a new URL
  router.post('/urls', (req, res) => {
    if (!createLimiter.hit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }
    const endpoint = db.createEndpoint(freshSlug(), Date.now());
    db.bumpCounter('urls_created');
    res.status(201).json(serializeEndpoint(endpoint, 0));
  });

  // Feedback: stored always, emailed when SMTP is configured
  router.post('/feedback', async (req, res) => {
    if (!feedbackLimiter.hit(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'rate_limit_exceeded' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mood = typeof body.mood === 'number' ? Math.floor(body.mood) : NaN;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      res.status(400).json({ error: 'mood_required' });
      return;
    }
    if (text.length > 2000 || email.length > 200 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      res.status(400).json({ error: 'invalid_input' });
      return;
    }
    db.insertFeedback(mood, text, email, Date.now());
    const mailed = await sendFeedbackMail({ mood, text, email });
    res.status(201).json({ ok: true, mailed });
  });

  // Owner-only admin reads, enabled by setting ADMIN_TOKEN in the environment.
  // Off (404) when unset; token compared in constant time.
  const adminAuth = (req: Request, res: Response): boolean => {
    const token = process.env.ADMIN_TOKEN;
    if (!token) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    const given = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const a = Buffer.from(given);
    const b = Buffer.from(token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'unauthorized' });
      return false;
    }
    return true;
  };

  router.get('/admin/overview', (req, res) => {
    if (!adminAuth(req, res)) return;
    res.json({ endpoints: db.listEndpointsOverview() });
  });

  router.get('/admin/requests', (req, res) => {
    if (!adminAuth(req, res)) return;
    const hours = clampInt(req.query.hours, 1, 24 * 30, 24);
    const rows = db.listRecentRequestsAcrossEndpoints(Date.now() - hours * 3_600_000);
    res.json(rows.map(r => ({ slug: r.slug, ...serializeRequest(r) })));
  });

  router.get('/admin/feedback', (req, res) => {
    if (!adminAuth(req, res)) return;
    res.json(db.listFeedback());
  });

  // Public usage stats for the /stats page
  router.get('/stats', (_req, res) => {
    res.json(db.stats());
  });

  // Read URL metadata
  router.get('/urls/:slug', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.json(serializeEndpoint(endpoint, db.countRequests(endpoint.id)));
  });

  // Update the response returned to senders
  router.patch('/urls/:slug', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<EndpointRow> = {};
    if (body.responseStatus !== undefined) patch.response_status = clampInt(body.responseStatus, 100, 599, 200);
    if (typeof body.responseBody === 'string') patch.response_body = body.responseBody.slice(0, MAX_RESPONSE_BODY);
    if (body.responseDelayMs !== undefined) patch.response_delay_ms = clampInt(body.responseDelayMs, 0, MAX_DELAY_MS, 0);
    db.updateEndpoint(endpoint.id, patch);
    const updated = db.getEndpointById(endpoint.id)!;
    hub.publish(endpoint.slug, { type: 'endpoint', endpoint: serializeEndpoint(updated, db.countRequests(endpoint.id)) });
    res.json(serializeEndpoint(updated, db.countRequests(endpoint.id)));
  });

  // Regenerate the slug (old URL stops working, requests are kept)
  router.post('/urls/:slug/regenerate', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const slug = freshSlug();
    db.updateEndpoint(endpoint.id, { slug, last_activity_at: Date.now() });
    res.json(serializeEndpoint(db.getEndpointById(endpoint.id)!, db.countRequests(endpoint.id)));
  });

  // List captured requests
  router.get('/urls/:slug/requests', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.json(db.listRequests(endpoint.id).map(serializeRequest));
  });

  // Read one request with the full (untruncated) body
  router.get('/urls/:slug/requests/:id', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const row = db.getRequest(endpoint.id, clampInt(req.params.id, 1, Number.MAX_SAFE_INTEGER, 0));
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(serializeRequest(row, { fullBody: true }));
  });

  // Delete one captured request
  router.delete('/urls/:slug/requests/:id', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const id = clampInt(req.params.id, 1, Number.MAX_SAFE_INTEGER, 0);
    if (!db.deleteRequest(endpoint.id, id)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    hub.publish(endpoint.slug, { type: 'request_deleted', id });
    res.status(204).end();
  });

  // Clear all captured requests for a URL
  router.delete('/urls/:slug/requests', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    db.clearRequests(endpoint.id);
    hub.publish(endpoint.slug, { type: 'requests_cleared' });
    res.status(204).end();
  });

  // Delete the URL itself (requests cascade away)
  router.delete('/urls/:slug', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    hub.publish(endpoint.slug, { type: 'url_deleted' });
    db.deleteEndpoint(endpoint.id);
    res.status(204).end();
  });

  // Export all requests (full bodies) as a JSON download
  router.get('/urls/:slug/export', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    res.setHeader('Content-Disposition', `attachment; filename="${endpoint.slug}.json"`);
    res.json({
      url: endpoint.slug,
      exportedAt: new Date().toISOString(),
      requests: db.listRequests(endpoint.id).map(r => serializeRequest(r, { fullBody: true }))
    });
  });

  // Realtime stream
  router.get('/urls/:slug/stream', (req, res) => {
    const endpoint = endpointOr404(db, req, res);
    if (!endpoint) return;
    const ip = req.ip ?? 'unknown';
    const open = streamsPerIp.get(ip) ?? 0;
    if (open >= MAX_STREAMS_PER_IP) {
      res.status(429).json({ error: 'too_many_streams' });
      return;
    }
    streamsPerIp.set(ip, open + 1);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no' // keep nginx from buffering the event stream
    });
    res.write(': connected\n\n');
    const unsubscribe = hub.subscribe(endpoint.slug, res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
      const left = (streamsPerIp.get(ip) ?? 1) - 1;
      if (left <= 0) streamsPerIp.delete(ip);
      else streamsPerIp.set(ip, left);
    });
  });

  return router;
}
