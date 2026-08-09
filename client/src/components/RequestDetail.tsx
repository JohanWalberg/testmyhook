import { useRef, useState } from 'react';
import type { ApiEndpoint, ApiRequest } from '../types';
import { api } from '../api';
import { detailTime, formatSize, parsedJson, rawRequestText, statusFull, toCurl } from '../lib/format';
import { JsonTree, type FoldSignal } from './JsonTree';

type Tab = 'body' | 'headers' | 'query' | 'raw';

interface RequestDetailProps {
  request: ApiRequest;
  slug: string;
  endpoint: ApiEndpoint;
  onDelete: () => void;
}

export function RequestDetail({ request, slug, endpoint, onDelete }: RequestDetailProps) {
  const [tab, setTab] = useState<Tab>('body');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  const copyCurl = () => {
    navigator.clipboard?.writeText(toCurl(request, window.location.origin, slug)).catch(() => {});
    clearTimeout(copyTimer.current);
    setCopied(true);
    copyTimer.current = setTimeout(() => setCopied(false), 1200);
  };

  const exportJson = async () => {
    // Fetch the full request — the listed copy may have a truncated body.
    const full = await api.getRequest(slug, request.id).catch(() => request);
    // Embed a JSON body as a real object rather than an escaped string, so
    // the exported file reads naturally.
    let body: unknown = full.body;
    if (full.bodyIsText) {
      try {
        body = JSON.parse(full.body);
      } catch {
        body = full.body;
      }
    }
    const blob = new Blob([JSON.stringify({ ...full, body }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-request-${request.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'body', label: 'Body' },
    { key: 'headers', label: 'Headers', count: request.headers.length },
    { key: 'query', label: 'Query', count: request.query.length },
    { key: 'raw', label: 'Raw' }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '22px 32px 0', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            className="mono"
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--badge-ink)', background: 'var(--green)', padding: '4px 8px', borderRadius: 4 }}
          >
            {request.method}
          </span>
          <span className="mono" style={{ fontSize: 17, fontWeight: 500, color: 'var(--ink)', overflowWrap: 'anywhere' }}>
            {request.path}
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--muted-2)' }}>
            · {detailTime(request.receivedAt)} · {formatSize(request.bodySize)} · replied in {Math.max(request.durationMs, 1)} ms
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="ghostBtn" onClick={copyCurl}>{copied ? 'copied!' : 'copy cURL'}</button>
            <button className="ghostBtn" onClick={exportJson}>export JSON</button>
            <button className="ghostBtn" onClick={onDelete} style={{ color: 'var(--accent)' }}>delete</button>
          </div>
        </div>
        <div className="mono" style={{ display: 'flex', gap: 26, fontSize: 12.5 }}>
          {tabs.map(t => (
            <div
              key={t.key}
              className="clickable"
              onClick={() => setTab(t.key)}
              style={{
                paddingBottom: 10,
                borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
                color: tab === t.key ? 'var(--ink)' : 'var(--muted)',
                fontWeight: tab === t.key ? 500 : 400
              }}
            >
              {t.label}
              {t.count !== undefined && <span style={{ color: 'var(--faint)' }}> {t.count}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'body' && <BodyTab request={request} endpoint={endpoint} slug={slug} />}
        {tab === 'headers' && <KvGrid label="Headers" rows={request.headers.map(h => [h.name, h.value])} />}
        {tab === 'query' && <KvGrid label="Query params" rows={request.query.map(q => [q.k, q.v])} />}
        {tab === 'raw' && (
          <div
            className="mono"
            style={{ fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--ink-2)' }}
          >
            {rawRequestText(request, window.location.host, slug)}
          </div>
        )}
      </div>
    </div>
  );
}

function BodyTab({ request, endpoint, slug }: { request: ApiRequest; endpoint: ApiEndpoint; slug: string }) {
  const parsed = parsedJson(request);
  const [fold, setFold] = useState<FoldSignal | undefined>(undefined);
  const foldAll = (open: boolean) => setFold(prev => ({ version: (prev?.version ?? 0) + 1, open }));
  const rawText = request.bodyIsText ? request.body : `(binary body — base64)\n${request.body}`;
  const lineCount = parsed !== undefined
    ? JSON.stringify(parsed, null, 2).split('\n').length
    : rawText === '' ? 0 : rawText.split('\n').length;
  const cardLabel = request.contentType ?? (request.body === '' ? 'no body' : 'unknown');

  const downloadBody = async () => {
    // The listed copy may be truncated — always download the full body.
    const full = request.bodyTruncated ? await api.getRequest(slug, request.id).catch(() => request) : request;
    // JSON payloads usually arrive minified; save them pretty-printed so the
    // file is readable the moment it is opened. Detected by parsing, not by
    // content-type — senders often ship JSON as text/plain.
    let pretty: string | null = null;
    if (full.bodyIsText) {
      try {
        pretty = JSON.stringify(JSON.parse(full.body), null, 2);
      } catch {
        pretty = null;
      }
    }
    const mime = pretty ? 'application/json' : full.contentType?.split(';')[0].trim() || (full.bodyIsText ? 'text/plain' : 'application/octet-stream');
    const ext = pretty || mime.includes('json') ? 'json'
      : mime.includes('xml') ? 'xml'
        : mime.includes('html') ? 'html'
          : full.bodyIsText ? 'txt'
            : (mime.split('/')[1] ?? 'bin').slice(0, 8);
    const blob = full.bodyIsText
      ? new Blob([pretty ?? full.body], { type: mime })
      : new Blob([Uint8Array.from(atob(full.body), c => c.charCodeAt(0))], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${request.id}-body.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
        <div
          className="mono"
          style={{
            padding: '9px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)'
          }}
        >
          <span>{cardLabel}</span>
          <span style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
            <span style={{ color: 'var(--faint)' }}>
              {request.bodyTruncated ? `showing first 128 kB of ${formatSize(request.bodySize)}` : `${lineCount} lines`}
            </span>
            {parsed !== undefined && (
              <>
                <span className="hoverAccent" onClick={() => foldAll(false)} style={{ color: 'var(--muted)', userSelect: 'none' }}>
                  COLLAPSE ALL
                </span>
                <span className="hoverAccent" onClick={() => foldAll(true)} style={{ color: 'var(--muted)', userSelect: 'none' }}>
                  EXPAND ALL
                </span>
              </>
            )}
            {request.body !== '' && (
              <span className="hoverAccent" onClick={downloadBody} style={{ color: 'var(--muted)', userSelect: 'none' }}>
                DOWNLOAD
              </span>
            )}
          </span>
        </div>
        <div className="mono" style={{ padding: '16px 18px 16px 24px', fontSize: 13, lineHeight: 1.85, color: 'var(--ink-2)', overflowX: 'auto' }}>
          {parsed !== undefined ? (
            <JsonTree key={request.id} value={parsed} fold={fold} />
          ) : rawText === '' ? (
            <span style={{ color: 'var(--faint)' }}>(empty body)</span>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{rawText}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Headers</div>
          <KvRows rows={request.headers.slice(0, 6).map(h => [h.name, h.value])} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>Query params</div>
          <KvRows rows={request.query.map(q => [q.k, q.v])} />
          <div className="mono" style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Response sent
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>
            {statusFull(request.responseStatus)} ·{' '}
            <span style={{ color: 'var(--muted)' }}>
              {request.responseStatus === 204 ? '(no body)' : endpoint.responseBody.replace(/\s+/g, ' ') || '(no body)'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function KvRows({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) {
    return <div className="mono" style={{ fontSize: 12.5, color: 'var(--faint)' }}>none</div>;
  }
  return (
    <div
      className="mono"
      style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12.5, lineHeight: 1.5 }}
    >
      {rows.map(([k, v], i) => (
        <FragmentRow key={i} k={k} v={v} />
      ))}
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>{v}</span>
    </>
  );
}

function KvGrid({ label, rows }: { label: string; rows: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 720 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</div>
      <KvRows rows={rows} />
    </div>
  );
}
