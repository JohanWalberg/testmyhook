import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface EndpointRow {
  id: number;
  token: string;
  name: string;
  secret: string;
  created_at: number;
  expires_at: number;
  paused: number;
  sig_required: number;
  max_requests: number;
  max_body_size: number;
  response_status: number;
  response_content_type: string;
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
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      secret TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paused INTEGER NOT NULL DEFAULT 0,
      sig_required INTEGER NOT NULL DEFAULT 0,
      max_requests INTEGER NOT NULL DEFAULT 100,
      max_body_size INTEGER NOT NULL DEFAULT 1048576,
      response_status INTEGER NOT NULL DEFAULT 200,
      response_content_type TEXT NOT NULL DEFAULT 'application/json',
      response_body TEXT NOT NULL DEFAULT '{\n  "received": true\n}',
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
    CREATE INDEX IF NOT EXISTS idx_endpoints_expires ON endpoints(expires_at);
  `);

  return {
    raw: db,

    createEndpoint(e: Omit<EndpointRow, 'id' | 'paused' | 'sig_required'> & Partial<Pick<EndpointRow, 'paused' | 'sig_required'>>): EndpointRow {
      const stmt = db.prepare(`
        INSERT INTO endpoints (token, name, secret, created_at, expires_at, paused, sig_required,
          max_requests, max_body_size, response_status, response_content_type, response_body, response_delay_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        e.token, e.name, e.secret, e.created_at, e.expires_at, e.paused ?? 0, e.sig_required ?? 0,
        e.max_requests, e.max_body_size, e.response_status, e.response_content_type, e.response_body, e.response_delay_ms
      );
      return this.getEndpointById(Number(info.lastInsertRowid))!;
    },

    getEndpointByToken(token: string): EndpointRow | undefined {
      return db.prepare('SELECT * FROM endpoints WHERE token = ?').get(token) as EndpointRow | undefined;
    },

    getEndpointById(id: number): EndpointRow | undefined {
      return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as EndpointRow | undefined;
    },

    updateEndpoint(id: number, patch: Partial<EndpointRow>): void {
      const allowed = [
        'token', 'name', 'expires_at', 'paused', 'sig_required', 'max_requests', 'max_body_size',
        'response_status', 'response_content_type', 'response_body', 'response_delay_ms'
      ] as const;
      const keys = allowed.filter(k => patch[k] !== undefined);
      if (keys.length === 0) return;
      const sets = keys.map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE endpoints SET ${sets} WHERE id = ?`).run(...keys.map(k => patch[k] as string | number), id);
    },

    deleteEndpoint(id: number): void {
      db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);
    },

    insertRequest(r: Omit<RequestRow, 'id'>): RequestRow {
      const info = db.prepare(`
        INSERT INTO requests (endpoint_id, method, path, query_json, headers_json, raw_body,
          content_type, source_ip, user_agent, body_size, received_at, response_status, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        r.endpoint_id, r.method, r.path, r.query_json, r.headers_json, r.raw_body,
        r.content_type, r.source_ip, r.user_agent, r.body_size, r.received_at, r.response_status, r.duration_ms
      );
      return this.getRequestById(Number(info.lastInsertRowid))!;
    },

    getRequestById(id: number): RequestRow | undefined {
      return db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as RequestRow | undefined;
    },

    listRequests(endpointId: number, limit = 200): RequestRow[] {
      return db.prepare('SELECT * FROM requests WHERE endpoint_id = ? ORDER BY id DESC LIMIT ?')
        .all(endpointId, limit) as unknown as RequestRow[];
    },

    countRequests(endpointId: number): number {
      const row = db.prepare('SELECT COUNT(*) AS n FROM requests WHERE endpoint_id = ?').get(endpointId) as { n: number };
      return row.n;
    },

    lastReceivedAt(endpointId: number): number | null {
      const row = db.prepare('SELECT MAX(received_at) AS t FROM requests WHERE endpoint_id = ?').get(endpointId) as { t: number | null };
      return row.t;
    },

    deleteRequest(endpointId: number, requestId: number): boolean {
      const info = db.prepare('DELETE FROM requests WHERE id = ? AND endpoint_id = ?').run(requestId, endpointId);
      return info.changes > 0;
    },

    clearRequests(endpointId: number): void {
      db.prepare('DELETE FROM requests WHERE endpoint_id = ?').run(endpointId);
    },

    trimRequests(endpointId: number, max: number): void {
      db.prepare(`
        DELETE FROM requests WHERE endpoint_id = ? AND id NOT IN (
          SELECT id FROM requests WHERE endpoint_id = ? ORDER BY id DESC LIMIT ?
        )
      `).run(endpointId, endpointId, max);
    },

    purgeExpired(graceMs: number, now: number): void {
      db.prepare('DELETE FROM endpoints WHERE expires_at + ? < ?').run(graceMs, now);
    },

    close(): void {
      db.close();
    }
  };
}
