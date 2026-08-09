import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createDb, type Db } from '../src/db.js';
import { createApp } from '../src/app.js';
import { detectSource } from '../src/serialize.js';
import { newSlug, SLUG_PATTERN } from '../src/slugs.js';

let db: Db;
let app: ReturnType<typeof createApp>['app'];

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db).app;
});

afterEach(() => {
  db.close();
});

async function createUrl() {
  const res = await request(app).post('/api/urls');
  expect(res.status).toBe(201);
  return res.body as { slug: string };
}

describe('slugs', () => {
  it('generates readable word-number slugs', () => {
    for (let i = 0; i < 50; i++) {
      expect(newSlug()).toMatch(SLUG_PATTERN);
    }
  });

  it('creates a URL with a fresh slug', async () => {
    const { slug } = await createUrl();
    expect(slug).toMatch(SLUG_PATTERN);
  });
});

describe('receiving webhooks', () => {
  it('captures a POST with JSON body, headers, query and subpath', async () => {
    const { slug } = await createUrl();
    const res = await request(app)
      .post(`/${slug}/orders/created?source=pos&retry=0`)
      .set('Content-Type', 'application/json')
      .set('User-Agent', 'Shopify-Captain-Hook')
      .set('X-Shopify-Topic', 'orders/create')
      .send({ id: 8812, currency: 'EUR' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body).toHaveLength(1);
    const r = list.body[0];
    expect(r.method).toBe('POST');
    expect(r.path).toBe('/orders/created');
    expect(r.source).toBe('shopify');
    expect(r.query).toEqual(expect.arrayContaining([
      { k: 'source', v: 'pos' },
      { k: 'retry', v: '0' }
    ]));
    expect(r.headers).toEqual(expect.arrayContaining([{ name: 'x-shopify-topic', value: 'orders/create' }]));
    expect(JSON.parse(r.body)).toEqual({ id: 8812, currency: 'EUR' });
  });

  it('captures requests to the bare slug with path "/"', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({ hello: 'world' });
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body[0].path).toBe('/');
  });

  it('accepts GET, PUT, PATCH, DELETE, OPTIONS and HEAD', async () => {
    const { slug } = await createUrl();
    for (const method of ['get', 'put', 'patch', 'delete', 'options', 'head'] as const) {
      const res = await request(app)[method](`/${slug}/ping`);
      expect(res.status).toBe(200);
    }
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body).toHaveLength(6);
  });

  it('captures raw non-JSON payloads', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).set('Content-Type', 'text/plain').send('event=paid&id=7');
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body[0].body).toBe('event=paid&id=7');
    expect(list.body[0].bodyIsText).toBe(true);
  });

  it('returns 404 for unknown slugs', async () => {
    const res = await request(app).post('/void-void-99').send({ a: 1 });
    expect(res.status).toBe(404);
  });

  it('does not intercept non-slug paths', async () => {
    const res = await request(app).get('/api/urls/not-a-slug');
    expect(res.status).toBe(404); // API 404, not receiver capture
  });

  it('accepts payloads up to 10 MB and rejects larger with 413', async () => {
    const { slug } = await createUrl();
    const ok = await request(app)
      .post(`/${slug}`)
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(2_000_000));
    expect(ok.status).toBe(200);

    const res = await request(app)
      .post(`/${slug}`)
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(10_600_000));
    expect(res.status).toBe(413);
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body).toHaveLength(1);
  });

  it('truncates large bodies for display but keeps the full body in exports', async () => {
    const { slug } = await createUrl();
    const big = 'y'.repeat(300_000);
    await request(app).post(`/${slug}`).set('Content-Type', 'text/plain').send(big);

    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body[0].bodyTruncated).toBe(true);
    expect(list.body[0].body.length).toBe(131_072);
    expect(list.body[0].bodySize).toBe(300_000);

    const single = await request(app).get(`/api/urls/${slug}/requests/${list.body[0].id}`);
    expect(single.body.bodyTruncated).toBe(false);
    expect(single.body.body.length).toBe(300_000);

    const exported = await request(app).get(`/api/urls/${slug}/export`);
    expect(exported.body.requests[0].body.length).toBe(300_000);
  });

  it('keeps only the most recent 500 requests per URL', async () => {
    const { slug } = await createUrl();
    const endpoint = db.getEndpointBySlug(slug)!;
    for (let i = 0; i < 510; i++) {
      db.insertRequest({
        endpoint_id: endpoint.id, method: 'POST', path: `/n/${i}`,
        query_json: '[]', headers_json: '[]', raw_body: null, content_type: null,
        source_ip: null, user_agent: null, body_size: 0, received_at: Date.now(),
        response_status: 200, response_body: '{"ok": true}', response_delay_ms: 0, duration_ms: 0
      });
    }
    db.trimRequests(endpoint.id, 500);
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body).toHaveLength(500);
    expect(list.body[0].path).toBe('/n/509');
    expect(list.body[499].path).toBe('/n/10');
  });

  it('updates last activity on each request', async () => {
    const { slug } = await createUrl();
    const before = db.getEndpointBySlug(slug)!;
    db.updateEndpoint(before.id, { last_activity_at: 1000 });
    await request(app).post(`/${slug}`).send({});
    const after = db.getEndpointBySlug(slug)!;
    expect(after.last_activity_at).toBeGreaterThan(1000);
  });
});

describe('custom responses', () => {
  it('returns the configured status and body', async () => {
    const { slug } = await createUrl();
    await request(app).patch(`/api/urls/${slug}`).send({ responseStatus: 404, responseBody: '{"error": "nope"}' });
    const res = await request(app).post(`/${slug}`).send({ a: 1 });
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ error: 'nope' });
  });

  it('serves non-JSON response bodies as text', async () => {
    const { slug } = await createUrl();
    await request(app).patch(`/api/urls/${slug}`).send({ responseStatus: 200, responseBody: 'plain text reply' });
    const res = await request(app).post(`/${slug}`).send({});
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe('plain text reply');
  });

  it('snapshots the response per request — changing settings later does not rewrite history', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({ n: 1 });
    await request(app).patch(`/api/urls/${slug}`).send({ responseStatus: 404, responseBody: '{"error": "gone"}' });
    await request(app).post(`/${slug}`).send({ n: 2 });

    const list = await request(app).get(`/api/urls/${slug}/requests`);
    expect(list.body[0].responseStatus).toBe(404);
    expect(list.body[0].responseBody).toBe('{"error": "gone"}');
    expect(list.body[1].responseStatus).toBe(200);
    expect(list.body[1].responseBody).toBe('{"ok": true}');
  });

  it('clamps the delay to 5 seconds', async () => {
    const { slug } = await createUrl();
    const patched = await request(app).patch(`/api/urls/${slug}`).send({ responseDelayMs: 99999 });
    expect(patched.body.responseDelayMs).toBe(5000);
  });
});

describe('regenerate', () => {
  it('invalidates the old slug and keeps requests', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({ a: 1 });
    const regen = await request(app).post(`/api/urls/${slug}/regenerate`);
    expect(regen.status).toBe(200);
    const next = regen.body.slug;
    expect(next).not.toBe(slug);
    expect((await request(app).post(`/${slug}`).send({})).status).toBe(404);
    const list = await request(app).get(`/api/urls/${next}/requests`);
    expect(list.body).toHaveLength(1);
  });
});

describe('export', () => {
  it('exports all requests as JSON', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}/a`).send({ n: 1 });
    await request(app).post(`/${slug}/b`).send({ n: 2 });
    const res = await request(app).get(`/api/urls/${slug}/export`);
    expect(res.headers['content-disposition']).toContain(`${slug}.json`);
    expect(res.body.requests).toHaveLength(2);
    expect(res.body.url).toBe(slug);
  });
});

describe('deletion', () => {
  it('deletes a single request', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}/a`).send({ n: 1 });
    await request(app).post(`/${slug}/b`).send({ n: 2 });
    const list = await request(app).get(`/api/urls/${slug}/requests`);
    const del = await request(app).delete(`/api/urls/${slug}/requests/${list.body[0].id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/urls/${slug}/requests`);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].path).toBe('/a');
  });

  it('clears all requests for a URL', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({ n: 1 });
    await request(app).post(`/${slug}`).send({ n: 2 });
    expect((await request(app).delete(`/api/urls/${slug}/requests`)).status).toBe(204);
    const after = await request(app).get(`/api/urls/${slug}/requests`);
    expect(after.body).toHaveLength(0);
  });

  it('deletes the URL itself, after which webhooks 404', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({ n: 1 });
    expect((await request(app).delete(`/api/urls/${slug}`)).status).toBe(204);
    expect((await request(app).get(`/api/urls/${slug}`)).status).toBe(404);
    expect((await request(app).post(`/${slug}`).send({})).status).toBe(404);
  });
});

describe('retention', () => {
  it('purges URLs after 7 days of inactivity', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).send({});
    const endpoint = db.getEndpointBySlug(slug)!;
    db.updateEndpoint(endpoint.id, { last_activity_at: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    db.purgeInactive(7 * 24 * 60 * 60 * 1000, Date.now());
    expect(db.getEndpointBySlug(slug)).toBeUndefined();
    expect((await request(app).post(`/${slug}`).send({})).status).toBe(404);
  });

  it('keeps URLs active within the window', async () => {
    const { slug } = await createUrl();
    db.purgeInactive(7 * 24 * 60 * 60 * 1000, Date.now());
    expect(db.getEndpointBySlug(slug)).toBeDefined();
  });
});

describe('abuse protection', () => {
  it('rate limits URL creation', async () => {
    let lastStatus = 201;
    for (let i = 0; i < 40; i++) {
      lastStatus = (await request(app).post('/api/urls')).status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it('rate limits incoming webhooks per URL', async () => {
    const { slug } = await createUrl();
    let lastStatus = 200;
    for (let i = 0; i < 130; i++) {
      lastStatus = (await request(app).post(`/${slug}`).send({ i })).status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('operations', () => {
  it('exposes a health check', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('sends CORS headers on receiver responses so browser senders can read them', async () => {
    const { slug } = await createUrl();
    const res = await request(app)
      .post(`/${slug}`)
      .set('Origin', 'https://example.com')
      .send({ a: 1 });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('answers CORS preflight with the requested headers allowed', async () => {
    const { slug } = await createUrl();
    const res = await request(app)
      .options(`/${slug}/orders`)
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-custom');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-headers']).toBe('content-type,x-custom');
  });
});

describe('stats', () => {
  it('tracks all-time counters and live numbers', async () => {
    const before = await request(app).get('/api/stats');
    expect(before.body.urlsCreated).toBe(0);
    expect(before.body.webhooksReceived).toBe(0);
    expect(before.body.since).toBeGreaterThan(0);

    const { slug } = await createUrl();
    await request(app).post(`/${slug}/a`).send({ n: 1 });
    await request(app).post(`/${slug}/b`).send({ n: 2 });

    const after = await request(app).get('/api/stats');
    expect(after.body.urlsCreated).toBe(1);
    expect(after.body.urlsActive).toBe(1);
    expect(after.body.webhooksReceived).toBe(2);
    expect(after.body.webhooksStored).toBe(2);
    expect(after.body.bytesStored).toBeGreaterThan(0);
  });
});

describe('geo aggregation', () => {
  it('records coarse locations for public IPs and skips private ones', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).set('X-Forwarded-For', '8.8.8.8').send({ a: 1 });
    await request(app).post(`/${slug}`).set('X-Forwarded-For', '8.8.8.8').send({ a: 2 });
    await request(app).post(`/${slug}`).set('X-Forwarded-For', '192.168.1.7').send({ a: 3 });

    const stats = await request(app).get('/api/stats');
    expect(stats.body.points).toHaveLength(1);
    expect(stats.body.points[0].n).toBe(2);
    expect(Math.abs(stats.body.points[0].lat % 2)).toBe(0); // snapped to the 2° grid
    expect(Math.abs(stats.body.points[0].lon % 2)).toBe(0);
  });
});

describe('source detection', () => {
  it.each([
    ['Shopify-Captain-Hook', 'shopify'],
    ['Stripe/1.0 (+https://stripe.com/docs/webhooks)', 'stripe'],
    ['GitHub-Hookshot/044aadd', 'github'],
    ['Atlassian Webhook HTTP Client', 'jira'],
    ['curl/8.4.0', 'curl'],
    [null, 'unknown']
  ])('maps %s to %s', (ua, expected) => {
    expect(detectSource(ua)).toBe(expected);
  });
});
