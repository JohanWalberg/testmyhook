import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../data/testmyhook.db');
const RETENTION_GRACE_MS = 24 * 60 * 60 * 1000; // expired endpoints stay readable for 24 h

const db = createDb(DB_PATH);
const { app } = createApp(db);

// Purge endpoints (and their requests, via cascade) once past expiry + retention grace.
const purge = setInterval(() => db.purgeExpired(RETENTION_GRACE_MS, Date.now()), 10 * 60 * 1000);
purge.unref();

// Serve the built client in production.
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|h\/).*/, (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TestMyHook server listening on http://localhost:${PORT}`);
});
