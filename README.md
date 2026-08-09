# TestMyHook

See exactly what a webhook sends. Open the site and you already have a live URL — point any webhook or callback at it and inspect headers, body and query params the moment they land.

The UI is implemented from the design in [`design_prototype/TestMyHook.dc.html`](design_prototype/TestMyHook.dc.html) (imported from the "Webhook testing site design" Claude Design project), which is the visual source of truth.

## How it works

- Every URL gets a random readable slug: `testmyhook.dev/tiny-snow-k4d92h`
- Anything after the slug is captured as the request path: `POST /tiny-snow-k4d92h/orders/created` shows up as `/orders/created`
- Requests stream into the sidebar in real time (SSE), grouped by day, with the sender detected from the user-agent (`shopify · 200 · 1.4 kB`)
- Configure the response returned to the sender: status code, body, delay
- Multiple URLs as tabs · regenerate · copy · export as JSON · dark mode · shareable inbox links (`/view/<slug>` opens the same live inbox on any device)
- No accounts. URLs are deleted after 7 days of inactivity. 500 webhooks kept per URL, 10 MB body max, 50 MB total payload per URL, 6 GB global cap with oldest-first eviction.

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

## Testing

**Automated** — `npm test` runs the server suite (29 tests): slug generation, receiving all methods with subpaths/headers/query, JSON and raw payloads, unknown slugs, 10 MB limit, display truncation, 500-request trimming, custom responses (status/body/delay clamp), regeneration, JSON export, 7-day inactivity purge, rate limiting, CORS, health check and source detection.

**Manually, end to end** — start the app, open it in a browser (a URL is created for you), then send requests from a terminal:

```bash
curl -X POST http://localhost:8787/<your-slug>/orders/created \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'
```

The request appears in the sidebar instantly. Also try GET/PUT/DELETE, query strings (`?source=pos`), non-JSON bodies, and a second URL via the `+` tab.

**With a real webhook sender (Shopify, Stripe, GitHub…)** — those services can't reach your laptop, so put a tunnel in front while developing:

```bash
cloudflared tunnel --url http://localhost:8787   # or: ngrok http 8787
```

Paste `https://<tunnel-host>/<your-slug>` into the service's webhook settings. Because the app builds all displayed/copied URLs from the address you're browsing on, open the app through the tunnel URL and the copied webhook URLs will be tunnel URLs too.

## Deployment

Nothing is hardcoded to localhost — the client derives every URL from the browser's own address (`window.location`), and the server binds `PORT` (default 8787) and stores data at `DB_PATH`. Deploying behind `testmyhook.dev` automatically makes every displayed and copied URL `https://testmyhook.dev/<slug>`.

The repo ships a complete production stack — app + Caddy (automatic HTTPS) — as one command. On a fresh Ubuntu VPS:

```bash
# 1. Point DNS: an A record for your domain → the server's IP (do this first)
# 2. Install Docker: curl -fsSL https://get.docker.com | sh
# 3. Get the code onto the server (git clone or scp), then:
sed -i 's/testmyhook.dev/yourdomain.tld/' Caddyfile   # if your domain differs
docker compose up -d --build
```

That's live: Caddy fetches TLS certificates automatically and proxies to the app; the SQLite data lives in the `app_data` volume and survives redeploys. To deploy an update: `git pull && docker compose up -d --build`.

Running without the bundled Caddy also works — `docker build -t testmyhook . && docker run -d -p 8787:8787 -v testmyhook-data:/data testmyhook` behind any TLS-terminating proxy or platform ingress. `trust proxy` is enabled, so client IPs come from `X-Forwarded-For`, and the SSE stream sends `X-Accel-Buffering: no` so nginx won't buffer it. `/healthz` is available for load-balancer checks; SIGTERM triggers a graceful shutdown. Single instance only — SQLite and the in-process event stream don't scale horizontally (by design, for this size of product).
