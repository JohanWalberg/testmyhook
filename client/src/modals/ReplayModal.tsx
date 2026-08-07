import { useState } from 'react';
import type { ApiRequest, ReplayResult } from '../types';
import { api } from '../api';
import { isSensitiveHeader, maskValue, statusFull } from '../lib/format';
import { Modal, ModalFooter, Field } from '../components/Modal';
import { KeyValueTable, Toggle } from '../components/ui';
import { useToast } from '../components/Toast';

const METHODS = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];
const REPLAY_SKIP = new Set(['host', 'content-length', 'connection', 'accept-encoding']);

interface ReplayModalProps {
  token: string;
  request: ApiRequest;
  onClose: () => void;
}

export function ReplayModal({ token, request, onClose }: ReplayModalProps) {
  const [method, setMethod] = useState(request.method === 'HEAD' || request.method === 'OPTIONS' ? 'POST' : request.method);
  const [url, setUrl] = useState('');
  const [body, setBody] = useState(request.bodyIsText ? request.body : '');
  const [timeout_, setTimeout_] = useState('10s');
  const [redirects, setRedirects] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const toast = useToast();

  const replayHeaders = request.headers.filter(h => !REPLAY_SKIP.has(h.name.toLowerCase()));
  const hasCredentials = request.headers.some(h => isSensitiveHeader(h.name));

  const send = async () => {
    if (busy) return;
    if (!url.trim()) {
      toast('Enter a destination URL');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const timeoutSec = parseFloat(timeout_.replace(/[^\d.]/g, '')) || 10;
      const res = await api.replay(token, {
        url: url.trim(),
        method,
        headers: replayHeaders,
        body,
        timeoutMs: Math.round(timeoutSec * 1000),
        followRedirects: redirects
      });
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Replay failed', timeMs: 0 });
    } finally {
      setBusy(false);
    }
  };

  const ok = result?.ok && (result.status ?? 0) < 400;

  return (
    <Modal title="Replay request" subtitle={`${request.method} ${request.path}`} width={640} onClose={onClose}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {hasCredentials && (
          <div style={{ border: '1px solid #F0E9D8', background: '#FDFBF4', borderRadius: 9, padding: '12px 14px', fontSize: 13, lineHeight: 1.55, color: '#8A6D1F' }}>
            This request contains an authorization header or a signature. Replaying it will send those credentials to the destination URL.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
          <select className="tmInput mono" value={method} onChange={e => setMethod(e.target.value)} style={{ padding: 10, fontSize: 13.5 }}>
            {METHODS.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            className="tmInput mono"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/payments"
            style={{ width: '100%', padding: '10px 12px', fontSize: 13.5 }}
          />
        </div>
        <Field label="Headers">
          <KeyValueTable dense rows={replayHeaders.map(h => ({ k: h.name, v: isSensitiveHeader(h.name) ? maskValue() : h.value }))} />
        </Field>
        <Field label="Query parameters">
          <KeyValueTable dense rows={request.query.map(({ k, v }) => ({ k, v }))} />
        </Field>
        <Field label="Request body">
          <textarea className="tmInput mono" rows={5} value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 12.5, lineHeight: 1.7, resize: 'vertical' }} />
        </Field>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Timeout</span>
            <input className="tmInput mono" value={timeout_} onChange={e => setTimeout_(e.target.value)} style={{ width: 76, padding: '7px 10px', fontSize: 13 }} />
          </div>
          <span onClick={() => setRedirects(!redirects)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <Toggle on={redirects} onClick={() => {}} />
            Follow redirects
          </span>
        </div>

        {result && (
          <div style={{ border: `1px solid ${ok ? '#CFF0DC' : '#F2D4D4'}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', background: ok ? '#F4FCF7' : '#FEF6F6', borderBottom: `1px solid ${ok ? '#CFF0DC' : '#F2D4D4'}`, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803D' : '#DC2626' }}>
                {result.ok ? statusFull(result.status ?? 0) : result.error?.startsWith('Timed out') ? 'Timed out' : 'Request failed'}
              </span>
              <span className="mono" style={{ fontSize: 12.5, color: '#6B6B7B' }}>
                {result.ok ? `${result.timeMs} ms` : `after ${result.timeMs} ms`}
              </span>
            </div>
            <div className="mono" style={{ padding: '12px 14px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 260, overflowY: 'auto' }}>
              {result.ok
                ? `${(result.headers ?? [])
                    .filter(h => h.name === 'content-type')
                    .map(h => `content-type: ${h.value}`)
                    .join('\n')}\n\n${result.body || '(empty body)'}`.trim()
                : `Replay failed: ${result.error}`}
            </div>
          </div>
        )}
      </div>
      <ModalFooter>
        <button className="btnSecondary" onClick={onClose} style={{ marginLeft: 'auto', padding: '9px 15px', fontSize: 13.5 }}>Cancel</button>
        <button className="btnPrimary" onClick={send} disabled={busy} style={{ padding: '9px 17px', fontSize: 13.5, border: 'none' }}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
