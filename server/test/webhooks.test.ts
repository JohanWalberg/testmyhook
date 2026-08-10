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

describe('storage budgets', () => {
  function insert(endpointId: number, size: number, path = '/x') {
    db.insertRequest({
      endpoint_id: endpointId, method: 'POST', path,
      query_json: '[]', headers_json: '[]', raw_body: new Uint8Array(size), content_type: null,
      source_ip: null, user_agent: null, body_size: size, received_at: Date.now(),
      response_status: 200, response_body: '', response_delay_ms: 0, duration_ms: 0
    });
  }

  it('trims oldest requests when a URL exceeds its byte budget, keeping the newest', async () => {
    const { slug } = await createUrl();
    const endpoint = db.getEndpointBySlug(slug)!;
    for (let i = 0; i < 10; i++) insert(endpoint.id, 100, `/n/${i}`);
    expect(db.endpointStoredBytes(endpoint.id)).toBe(1000);
    db.trimToByteBudget(endpoint.id, 350);
    expect(db.endpointStoredBytes(endpoint.id)).toBeLessThanOrEqual(350);
    const left = db.listRequests(endpoint.id);
    expect(left[0].path).toBe('/n/9'); // newest survives
  });

  it('never deletes the only remaining request even when over budget', async () => {
    const { slug } = await createUrl();
    const endpoint = db.getEndpointBySlug(slug)!;
    insert(endpoint.id, 500);
    db.trimToByteBudget(endpoint.id, 100);
    expect(db.countRequests(endpoint.id)).toBe(1);
  });

  it('evicts oldest requests globally across URLs to fit the global budget', async () => {
    const a = db.getEndpointBySlug((await createUrl()).slug)!;
    const b = db.getEndpointBySlug((await createUrl()).slug)!;
    for (let i = 0; i < 5; i++) insert(a.id, 100, `/a/${i}`);
    for (let i = 0; i < 5; i++) insert(b.id, 100, `/b/${i}`);
    expect(db.totalStoredBytes()).toBe(1000);
    const evicted = db.evictToGlobalBudget(400);
    expect(evicted).toBeGreaterThan(0);
    expect(db.totalStoredBytes()).toBeLessThanOrEqual(400);
    // oldest went first: endpoint A's early rows are gone, B's late rows remain
    expect(db.listRequests(b.id).some(r => r.path === '/b/4')).toBe(true);
  });

  it('exposes storedBytes on the health check', async () => {
    const { slug } = await createUrl();
    await request(app).post(`/${slug}`).set('Content-Type', 'text/plain').send('x'.repeat(1234));
    const res = await request(app).get('/healthz');
    expect(res.body.storedBytes).toBeGreaterThanOrEqual(1234);
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

  it('sends security headers', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('serves robots.txt and sitemap.xml, keeps API and webhooks unindexed', async () => {
    const robots = await request(app).get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.text).toContain('Disallow: /view/');
    expect(robots.text).toContain('/sitemap.xml');

    const sitemap = await request(app).get('/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain('/how');
    expect(sitemap.text).toContain('/stats');

    const apiRes = await request(app).get('/api/stats');
    expect(apiRes.headers['x-robots-tag']).toContain('noindex');

    const { slug } = await createUrl();
    const hook = await request(app).post(`/${slug}`).send({});
    expect(hook.headers['x-robots-tag']).toContain('noindex');
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

describe('coordinate country lookup', () => {
  it('resolves coordinates to country names offline', async () => {
    const { countryAt } = await import('../src/countries.js');
    expect(countryAt(60, 18)).toBe('Sweden');
    expect(countryAt(38, -98)).toBe('United States of America');
    expect(countryAt(56, 12)).toBeTruthy(); // Denmark/Sweden strait — nudge finds land
    expect(countryAt(0, -140)).toBeNull(); // open Pacific
  });

  it('backfills country for geo cells recorded without one', async () => {
    db.bumpGeo(60, 18, null);
    const { countryAt } = await import('../src/countries.js');
    for (const cell of db.listGeoMissingCountry()) {
      const name = countryAt(cell.lat, cell.lon);
      if (name) db.setGeoCountry(cell.lat, cell.lon, name);
    }
    const stats = await request(app).get('/api/stats');
    const cell = stats.body.points.find((p: { lat: number }) => p.lat === 60);
    expect(cell.country).toBe('Sweden');
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
    expect(stats.body.points[0].country).toBe('US');
    expect(Math.abs(stats.body.points[0].lat % 2)).toBe(0); // snapped to the 2° grid
    expect(Math.abs(stats.body.points[0].lon % 2)).toBe(0);
  });
});

describe('admin API', () => {
  it('is disabled (404) when ADMIN_TOKEN is unset', async () => {
    delete process.env.ADMIN_TOKEN;
    expect((await request(app).get('/api/admin/overview')).status).toBe(404);
  });

  it('rejects wrong tokens and serves cross-URL data with the right one', async () => {
    process.env.ADMIN_TOKEN = 'test-secret';
    try {
      expect((await request(app).get('/api/admin/overview')).status).toBe(401);
      expect((await request(app).get('/api/admin/overview').set('Authorization', 'Bearer nope')).status).toBe(401);

      const a = await createUrl();
      const b = await createUrl();
      await request(app).post(`/${a.slug}/one`).send({ n: 1 });
      await request(app).post(`/${b.slug}/two`).send({ n: 2 });

      const overview = await request(app).get('/api/admin/overview').set('Authorization', 'Bearer test-secret');
      expect(overview.status).toBe(200);
      expect(overview.body.endpoints).toHaveLength(2);

      const recent = await request(app).get('/api/admin/requests?hours=1').set('Authorization', 'Bearer test-secret');
      expect(recent.status).toBe(200);
      expect(recent.body).toHaveLength(2);
      const slugs = recent.body.map((r: { slug: string }) => r.slug).sort();
      expect(slugs).toEqual([a.slug, b.slug].sort());

      await request(app).post('/api/feedback').send({ mood: 4, text: 'admin test' });
      const fb = await request(app).get('/api/admin/feedback').set('Authorization', 'Bearer test-secret');
      expect(fb.body).toHaveLength(1);
      expect(fb.body[0].text).toBe('admin test');
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });
});

describe('feedback', () => {
  it('stores feedback and succeeds without SMTP configured', async () => {
    const res = await request(app).post('/api/feedback').send({ mood: 5, text: 'love it', email: 'nina@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.mailed).toBe(false); // no SMTP in tests — stored only
    expect(db.countFeedback()).toBe(1);
  });

  it('requires a valid mood and sane input sizes', async () => {
    expect((await request(app).post('/api/feedback').send({ text: 'no mood' })).status).toBe(400);
    expect((await request(app).post('/api/feedback').send({ mood: 6 })).status).toBe(400);
    expect((await request(app).post('/api/feedback').send({ mood: 3, text: 'x'.repeat(2001) })).status).toBe(400);
    expect((await request(app).post('/api/feedback').send({ mood: 3, email: 'not-an-email' })).status).toBe(400);
    expect(db.countFeedback()).toBe(0);
  });

  it('rate limits submissions', async () => {
    let last = 201;
    for (let i = 0; i < 7; i++) {
      last = (await request(app).post('/api/feedback').send({ mood: 4 })).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
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
