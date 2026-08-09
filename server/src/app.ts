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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // The app displays attacker-controlled webhook payloads; lock down what a
    // page may load or do. Inline styles are required (React style props),
    // fonts come from Google Fonts, everything else is same-origin.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  });

  // Public pages (/, /how, /stats) are indexable; robots.txt keeps crawlers
  // out of shared-inbox links. Webhook slugs are unguessable and noindexed.
  app.get('/robots.txt', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(`User-agent: *\nDisallow: /view/\n\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const urls = ['/', '/how', '/stats']
      .map(path => `  <url><loc>${origin}${path}</loc></url>`)
      .join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.use('/api', createApi(db, hub));

  // Public webhook receiver — /<slug> and /<slug>/<subpath>, isolated from app routes.
  app.use(createReceiver(db, hub));

  return { app, hub };
}
