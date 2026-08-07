# TestMyHook

A lightweight developer tool for receiving and inspecting webhooks/callbacks.

**Create endpoint → copy URL → send callback → see request instantly → inspect payload**

The UI is implemented from the design prototype in [`design_prototype/`](design_prototype/), which is the visual source of truth for this project.

## Stack

- **Server** — Express 5 + the built-in `node:sqlite` (no native deps), Server-Sent Events for realtime. Requires Node ≥ 22.5 (developed on Node 26).
- **Client** — React 18 + Vite + TypeScript, React Router.

```text
Webhook receiver (/h/:token)  →  SQLite persistence  →  SSE  →  Inbox  →  Request inspector
```

## Development

```bash
npm install
npm run dev        # server on :8787, Vite dev server on :5173 (proxies /api and /h)
```

Open http://localhost:5173.

## Production

```bash
npm run build      # builds client into client/dist
npm start          # server on :8787, serves the built client
```

## Tests

```bash
npm test           # server test suite (vitest + supertest)
```

Covers endpoint creation, receiving all methods, JSON/text/XML payload capture, headers/query capture, unknown/expired endpoints, oversized payloads, pause, trimming, custom responses, HMAC signature validation, deletion, token regeneration, rate limiting and replay SSRF protections.

## Features

- Unguessable, URL-safe endpoint tokens (crypto-random, 62^10)
- Accepts GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD with any payload (JSON, form, XML, plain text, binary, empty)
- Realtime inbox via SSE — no refresh needed
- Request inspector: pretty/raw body, headers (sensitive values masked by default), query parameters, raw request, response
- Copy URL / body / request / as-cURL, download as JSON
- Replay captured requests to another URL with server-side SSRF protection (blocks localhost, private ranges, link-local/cloud-metadata, NAT64, IPv4-mapped addresses; re-validates on redirects)
- Custom responses (status, content type, body, artificial delay)
- Endpoint lifecycle: 15 min / 1 h / 24 h / 7 d expiry, pause/resume, regenerate token, delete; expired endpoints stop accepting callbacks and are purged 24 h after expiry
- Optional HMAC-SHA256 signature validation (`x-webhook-signature`) against the endpoint secret
- Abuse protection: 1 MB body cap (configurable per endpoint, lower only), per-endpoint and per-IP rate limits, endpoint-creation rate limit, max stored requests per endpoint
- `noindex` on all responses; payloads are never written to server logs

## Notes

- The "History" page lists endpoints created in the current browser (localStorage) — no accounts in this version.
- `data/testmyhook.db` (SQLite) is created on first run and is gitignored.
