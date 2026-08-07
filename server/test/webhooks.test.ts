import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createDb, type Db } from '../src/db.js';
import { createApp } from '../src/app.js';
import { isForbiddenAddress } from '../src/replay.js';

let db: Db;
let app: ReturnType<typeof createApp>['app'];

beforeEach(() => {
  db = createDb(':memory:');
  app = createApp(db).app;
});

afterEach(() => {
  db.close();
});

async function createEndpoint(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/endpoints').send({ name: 'Test', ...overrides });
  expect(res.status).toBe(201);
  return res.body as { token: string; secret: string; expiresAt: number };
}

describe('endpoint creation', () => {
  it('creates an endpoint with an unguessable URL-safe token', async () => {
    const ep = await createEndpoint();
    expect(ep.token).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(ep.expiresAt).toBeGreaterThan(Date.now());
  });

  it('honors expiry presets', async () => {
    const ep = await createEndpoint({ expiry: '15 minutes' });
    expect(ep.expiresAt - Date.now()).toBeLessThanOrEqual(15 * 60_000 + 1_000);
  });
});

describe('receiving callbacks', () => {
  it('captures a POST with JSON body, headers and query parameters', async () => {
    const ep = await createEndpoint();
    const res = await request(app)
      .post(`/h/${ep.token}?environment=sandbox&source=payments`)
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Id', 'evt_123')
      .send({ event: 'payment.completed', amount: 1499 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(res.headers['x-testmyhook-id']).toBe(ep.token);

    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(1);
    const req0 = list.body[0];
    expect(req0.method).toBe('POST');
    expect(req0.query).toEqual(expect.arrayContaining([
      { k: 'environment', v: 'sandbox' },
      { k: 'source', v: 'payments' }
    ]));
    expect(req0.headers).toEqual(expect.arrayContaining([{ name: 'x-webhook-id', value: 'evt_123' }]));
    expect(JSON.parse(req0.body)).toEqual({ event: 'payment.completed', amount: 1499 });
    expect(req0.contentType).toContain('application/json');
    expect(req0.bodySize).toBeGreaterThan(0);
  });

  it('captures GET requests with empty bodies', async () => {
    const ep = await createEndpoint();
    const res = await request(app).get(`/h/${ep.token}?ping=1`);
    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body[0].method).toBe('GET');
    expect(list.body[0].body).toBe('');
    expect(list.body[0].query).toEqual([{ k: 'ping', v: '1' }]);
  });

  it('accepts PUT, PATCH, DELETE, OPTIONS and HEAD', async () => {
    const ep = await createEndpoint();
    for (const method of ['put', 'patch', 'delete', 'options', 'head'] as const) {
      const res = await request(app)[method](`/h/${ep.token}`);
      expect(res.status).toBe(200);
    }
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(5);
  });

  it('captures raw non-JSON payloads without rejecting them', async () => {
    const ep = await createEndpoint();
    await request(app)
      .post(`/h/${ep.token}`)
      .set('Content-Type', 'text/plain')
      .send('event=payment.failed&id=evt_7723');
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body[0].body).toBe('event=payment.failed&id=evt_7723');
    expect(list.body[0].bodyIsText).toBe(true);
  });

  it('captures XML payloads', async () => {
    const ep = await createEndpoint();
    const xml = '<?xml version="1.0"?><order id="1"><status>shipped</status></order>';
    await request(app).post(`/h/${ep.token}`).set('Content-Type', 'application/xml').send(xml);
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body[0].body).toBe(xml);
  });

  it('returns 404 for unknown endpoints and stores nothing', async () => {
    const res = await request(app).post('/h/doesNotExist00').send({ a: 1 });
    expect(res.status).toBe(404);
  });

  it('rejects callbacks to expired endpoints with 410', async () => {
    const ep = await createEndpoint();
    const row = db.getEndpointByToken(ep.token)!;
    db.updateEndpoint(row.id, { expires_at: Date.now() - 1000 });
    const res = await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    expect(res.status).toBe(410);
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(0);
  });

  it('rejects oversized payloads with 413', async () => {
    const ep = await createEndpoint({ maxBodySize: 2048 });
    const res = await request(app)
      .post(`/h/${ep.token}`)
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(5000));
    expect(res.status).toBe(413);
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(0);
  });

  it('does not store requests while the endpoint is paused', async () => {
    const ep = await createEndpoint();
    await request(app).patch(`/api/endpoints/${ep.token}`).send({ paused: true });
    const res = await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    expect(res.status).toBe(200);
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(0);
  });

  it('trims stored requests to maxRequests', async () => {
    const ep = await createEndpoint({ maxRequests: 3 });
    for (let i = 0; i < 5; i++) {
      await request(app).post(`/h/${ep.token}`).send({ i });
    }
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(list.body).toHaveLength(3);
    expect(JSON.parse(list.body[0].body).i).toBe(4);
  });
});

describe('custom responses', () => {
  it('returns the configured status, content type and body', async () => {
    const ep = await createEndpoint({
      responseStatus: 201,
      responseContentType: 'text/plain',
      responseBody: 'created!'
    });
    const res = await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe('created!');
  });

  it('can be changed after creation', async () => {
    const ep = await createEndpoint();
    await request(app).patch(`/api/endpoints/${ep.token}`).send({ responseStatus: 204, responseBody: '' });
    const res = await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    expect(res.status).toBe(204);
  });
});

describe('signature validation', () => {
  it('rejects invalid signatures when enabled and accepts valid ones', async () => {
    const { createHmac } = await import('node:crypto');
    const ep = await createEndpoint();
    await request(app).patch(`/api/endpoints/${ep.token}`).send({ sigRequired: true });

    const bad = await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    expect(bad.status).toBe(401);

    const body = JSON.stringify({ a: 1 });
    const sig = createHmac('sha256', ep.secret).update(body).digest('hex');
    const good = await request(app)
      .post(`/h/${ep.token}`)
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Signature', `sha256=${sig}`)
      .send(body);
    expect(good.status).toBe(200);
  });
});

describe('deletion', () => {
  it('deletes a single request', async () => {
    const ep = await createEndpoint();
    await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    const list = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    const id = list.body[0].id;
    const del = await request(app).delete(`/api/endpoints/${ep.token}/requests/${id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(after.body).toHaveLength(0);
  });

  it('clears all requests', async () => {
    const ep = await createEndpoint();
    await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    await request(app).post(`/h/${ep.token}`).send({ b: 2 });
    await request(app).delete(`/api/endpoints/${ep.token}/requests`);
    const after = await request(app).get(`/api/endpoints/${ep.token}/requests`);
    expect(after.body).toHaveLength(0);
  });

  it('deletes the endpoint and its requests, after which callbacks 404', async () => {
    const ep = await createEndpoint();
    await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    const del = await request(app).delete(`/api/endpoints/${ep.token}`);
    expect(del.status).toBe(204);
    expect((await request(app).get(`/api/endpoints/${ep.token}`)).status).toBe(404);
    expect((await request(app).post(`/h/${ep.token}`).send({})).status).toBe(404);
  });
});

describe('token regeneration', () => {
  it('invalidates the old URL and keeps captured requests', async () => {
    const ep = await createEndpoint();
    await request(app).post(`/h/${ep.token}`).send({ a: 1 });
    const regen = await request(app).post(`/api/endpoints/${ep.token}/regenerate`);
    expect(regen.status).toBe(200);
    const newToken = regen.body.token;
    expect(newToken).not.toBe(ep.token);
    expect((await request(app).post(`/h/${ep.token}`).send({})).status).toBe(404);
    const list = await request(app).get(`/api/endpoints/${newToken}/requests`);
    expect(list.body).toHaveLength(1);
  });
});

describe('replay SSRF protection', () => {
  const forbidden = [
    '127.0.0.1', '127.8.8.8', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1'
  ];
  it.each(forbidden)('classifies %s as forbidden', address => {
    expect(isForbiddenAddress(address)).toBe(true);
  });

  it.each(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])('allows public address %s', address => {
    expect(isForbiddenAddress(address)).toBe(false);
  });

  it('blocks replay to localhost', async () => {
    const ep = await createEndpoint();
    const res = await request(app).post(`/api/endpoints/${ep.token}/replay`).send({
      url: 'http://localhost:3000/webhooks',
      method: 'POST',
      headers: [],
      body: '{}'
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('blocked');
  });

  it('blocks replay to the cloud metadata address', async () => {
    const ep = await createEndpoint();
    const res = await request(app).post(`/api/endpoints/${ep.token}/replay`).send({
      url: 'http://169.254.169.254/latest/meta-data/',
      method: 'GET',
      headers: [],
      body: ''
    });
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('blocked');
  });

  it('blocks non-http protocols', async () => {
    const ep = await createEndpoint();
    const res = await request(app).post(`/api/endpoints/${ep.token}/replay`).send({
      url: 'file:///etc/passwd',
      method: 'GET',
      headers: [],
      body: ''
    });
    expect(res.body.ok).toBe(false);
  });
});

describe('abuse protection', () => {
  it('rate limits endpoint creation', async () => {
    let lastStatus = 201;
    for (let i = 0; i < 40; i++) {
      lastStatus = (await request(app).post('/api/endpoints').send({})).status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it('rate limits incoming callbacks per endpoint', async () => {
    const ep = await createEndpoint();
    let lastStatus = 200;
    for (let i = 0; i < 130; i++) {
      lastStatus = (await request(app).post(`/h/${ep.token}`).send({ i })).status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
