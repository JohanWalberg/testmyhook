# TestMyHook

See exactly what a webhook sends. Open the site and you already have a live URL — point any webhook or callback at it and inspect headers, body and query params the moment they land.

The UI is implemented from the design in [`design_prototype/TestMyHook.dc.html`](design_prototype/TestMyHook.dc.html) (imported from the "Webhook testing site design" Claude Design project), which is the visual source of truth.

## How it works

- Every URL gets a random readable slug: `testmyhook.dev/tiny-snow-27`
- Anything after the slug is captured as the request path: `POST /tiny-snow-27/orders/created` shows up as `/orders/created`
- Requests stream into the sidebar in real time (SSE), grouped by day, with the sender detected from the user-agent (`shopify · 200 · 1.4 kB`)
- Configure the response returned to the sender: status code, body, delay
- Multiple URLs as tabs · regenerate · copy · export as JSON · dark mode
- No accounts. URLs are deleted after 7 days of inactivity. 100 webhooks kept per URL, 1 MB body max.

## Stack

- **Server** — Express 5 + built-in `node:sqlite`, SSE for realtime. Node ≥ 22.5 (developed on Node 26).
- **Client** — React 18 + Vite + TypeScript, CSS-variable theming (light/dark).

## Development

```bash
npm install
npm run dev        # server on :8787, Vite dev server on :5173 (proxies /api and slug URLs)
```

## Production

```bash
npm run build      # builds client into client/dist
npm start          # server on :8787, serves the built client
```

## Tests

```bash
npm test
```

Covers slug generation, receiving all methods with subpaths/headers/query, JSON and raw payloads, unknown slugs, 1 MB limit, 100-request trimming, custom responses (status/body/delay clamp), regeneration, JSON export, 7-day inactivity purge, rate limiting and source detection.
