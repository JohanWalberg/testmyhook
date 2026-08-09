import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface EndpointRow {
  id: number;
  slug: string;
  created_at: number;
  last_activity_at: number;
  response_status: number;
  response_body: string;
  response_delay_ms: number;
}

export interface RequestRow {
  id: number;
  endpoint_id: number;
  method: string;
  path: string;
  query_json: string;
  headers_json: string;
  raw_body: Uint8Array | null;
  content_type: string | null;
  source_ip: string | null;
  user_agent: string | null;
  body_size: number;
  received_at: number;
  response_status: number;
  response_body: string;
  response_delay_ms: number;
  duration_ms: number;
}

export type Db = ReturnType<typeof createDb>;

export function createDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      response_status INTEGER NOT NULL DEFAULT 200,
      response_body TEXT NOT NULL DEFAULT '{"ok": true}',
      response_delay_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint_id INTEGER NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      query_json TEXT NOT NULL DEFAULT '[]',
      headers_json TEXT NOT NULL DEFAULT '[]',
      raw_body BLOB,
      content_type TEXT,
      source_ip TEXT,
      user_agent TEXT,
      body_size INTEGER NOT NULL DEFAULT 0,
      received_at INTEGER NOT NULL,
      response_status INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_requests_endpoint ON requests(endpoint_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_endpoints_activity ON endpoints(last_activity_at);

    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS geo (
      lat INTEGER NOT NULL,
      lon INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (lat, lon)
    );
  `);
  db.prepare('INSERT OR IGNORE INTO counters (key, value) VALUES (?, ?)').run('since', Date.now());

  // Migrations for databases created before the per-request response snapshot.
  const requestColumns = (db.prepare('PRAGMA table_info(requests)').all() as { name: string }[]).map(c => c.name);
  if (!requestColumns.includes('response_body')) {
    db.exec("ALTER TABLE requests ADD COLUMN response_body TEXT NOT NULL DEFAULT ''");
  }
  if (!requestColumns.includes('response_delay_ms')) {
    db.exec('ALTER TABLE requests ADD COLUMN response_delay_ms INTEGER NOT NULL DEFAULT 0');
  }
  const geoColumns = (db.prepare('PRAGMA table_info(geo)').all() as { name: string }[]).map(c => c.name);
  if (!geoColumns.includes('country')) {
    db.exec('ALTER TABLE geo ADD COLUMN country TEXT');
  }

  return {
    createEndpoint(slug: string, now: number): EndpointRow {
      const info = db.prepare(
        'INSERT INTO endpoints (slug, created_at, last_activity_at) VALUES (?, ?, ?)'
      ).run(slug, now, now);
      return this.getEndpointById(Number(info.lastInsertRowid))!;
    },

    getEndpointBySlug(slug: string): EndpointRow | undefined {
      return db.prepare('SELECT * FROM endpoints WHERE slug = ?').get(slug) as EndpointRow | undefined;
    },

    getEndpointById(id: number): EndpointRow | undefined {
      return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as EndpointRow | undefined;
    },

    updateEndpoint(id: number, patch: Partial<EndpointRow>): void {
      const allowed = ['slug', 'last_activity_at', 'response_status', 'response_body', 'response_delay_ms'] as const;
      const keys = allowed.filter(k => patch[k] !== undefined);
      if (keys.length === 0) return;
      const sets = keys.map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE endpoints SET ${sets} WHERE id = ?`).run(...keys.map(k => patch[k] as string | number), id);
    },

    insertRequest(r: Omit<RequestRow, 'id'>): RequestRow {
      const info = db.prepare(`
        INSERT INTO requests (endpoint_id, method, path, query_json, headers_json, raw_body,
          content_type, source_ip, user_agent, body_size, received_at,
          response_status, response_body, response_delay_ms, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        r.endpoint_id, r.method, r.path, r.query_json, r.headers_json, r.raw_body,
        r.content_type, r.source_ip, r.user_agent, r.body_size, r.received_at,
        r.response_status, r.response_body, r.response_delay_ms, r.duration_ms
      );
      return db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(info.lastInsertRowid)) as RequestRow;
    },

    getRequest(endpointId: number, requestId: number): RequestRow | undefined {
      return db.prepare('SELECT * FROM requests WHERE id = ? AND endpoint_id = ?')
        .get(requestId, endpointId) as RequestRow | undefined;
    },

    listRequests(endpointId: number, limit = 500): RequestRow[] {
      return db.prepare('SELECT * FROM requests WHERE endpoint_id = ? ORDER BY id DESC LIMIT ?')
        .all(endpointId, limit) as unknown as RequestRow[];
    },

    countRequests(endpointId: number): number {
      const row = db.prepare('SELECT COUNT(*) AS n FROM requests WHERE endpoint_id = ?').get(endpointId) as { n: number };
      return row.n;
    },

    deleteRequest(endpointId: number, requestId: number): boolean {
      const info = db.prepare('DELETE FROM requests WHERE id = ? AND endpoint_id = ?').run(requestId, endpointId);
      return info.changes > 0;
    },

    clearRequests(endpointId: number): void {
      db.prepare('DELETE FROM requests WHERE endpoint_id = ?').run(endpointId);
    },

    deleteEndpoint(id: number): void {
      db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);
    },

    trimRequests(endpointId: number, max: number): void {
      db.prepare(`
        DELETE FROM requests WHERE endpoint_id = ? AND id NOT IN (
          SELECT id FROM requests WHERE endpoint_id = ? ORDER BY id DESC LIMIT ?
        )
      `).run(endpointId, endpointId, max);
    },

    purgeInactive(maxIdleMs: number, now: number): void {
      db.prepare('DELETE FROM endpoints WHERE last_activity_at + ? < ?').run(maxIdleMs, now);
    },

    bumpGeo(lat: number, lon: number, country: string | null = null): void {
      db.prepare(`
        INSERT INTO geo (lat, lon, count, country) VALUES (?, ?, 1, ?)
        ON CONFLICT(lat, lon) DO UPDATE SET count = count + 1, country = COALESCE(geo.country, excluded.country)
      `).run(lat, lon, country);
    },

    bumpCounter(key: string, delta = 1): void {
      db.prepare(`
        INSERT INTO counters (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = value + excluded.value
      `).run(key, delta);
    },

    /** Live + all-time usage numbers. Counters survive trimming and purging; the rest is queried live. */
    stats() {
      const counter = (key: string): number =>
        ((db.prepare('SELECT value FROM counters WHERE key = ?').get(key) as { value: number } | undefined)?.value ?? 0);
      const one = (sql: string): number =>
        Number((db.prepare(sql).get() as Record<string, number | null>)['n'] ?? 0);
      return {
        since: counter('since'),
        urlsCreated: counter('urls_created'),
        webhooksReceived: counter('webhooks_received'),
        pageVisits: counter('page_visits'),
        urlsActive: one('SELECT COUNT(*) AS n FROM endpoints'),
        webhooksStored: one('SELECT COUNT(*) AS n FROM requests'),
        bytesStored: one('SELECT COALESCE(SUM(body_size), 0) AS n FROM requests'),
        points: db.prepare('SELECT lat, lon, country, count AS n FROM geo ORDER BY count DESC LIMIT 800')
          .all() as unknown as { lat: number; lon: number; country: string | null; n: number }[]
      };
    },

    close(): void {
      db.close();
    }
  };
}
