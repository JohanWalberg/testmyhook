import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? join(__dirname, '../../data/testmyhook.db');
const MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // URLs are deleted after 7 days of inactivity

const db = createDb(DB_PATH);
const { app } = createApp(db);

const purge = setInterval(() => db.purgeInactive(MAX_IDLE_MS, Date.now()), 10 * 60 * 1000);
purge.unref();

// Serve the built client in production. Slug-shaped paths never reach here —
// the receiver route in app.ts is registered first.
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\b).*/, (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TestMyHook server listening on http://localhost:${PORT}`);
});
