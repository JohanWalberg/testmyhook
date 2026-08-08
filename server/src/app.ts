import express from 'express';
import type { Db } from './db.js';
import { EventHub } from './events.js';
import { createReceiver } from './receiver.js';
import { createApi } from './api.js';

export function createApp(db: Db) {
  const app = express();
  const hub = new EventHub();

  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use('/api', createApi(db, hub));

  // Public webhook receiver — /<slug> and /<slug>/<subpath>, isolated from app routes.
  app.use(createReceiver(db, hub));

  return { app, hub };
}
