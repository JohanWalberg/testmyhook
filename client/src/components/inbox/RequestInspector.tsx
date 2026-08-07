import { useState } from 'react';
import type { ApiEndpoint, ApiRequest } from '../../types';
import {
  formatSize, fullTimestamp, isSensitiveHeader, maskValue, methodColors,
  rawRequestText, statusColors, statusFull, toCurl
} from '../../lib/format';
import { KeyValueTable, MethodBadge, SectionLabel } from '../ui';
import { useCopy } from '../Toast';
import { PayloadViewer } from './PayloadViewer';

const TABS = [
  ['body', 'Body'],
  ['headers', 'Headers'],
  ['query', 'Query parameters'],
  ['raw', 'Raw request'],
  ['response', 'Response']
] as const;

type Tab = (typeof TABS)[number][0];

interface RequestInspectorProps {
  endpoint: ApiEndpoint;
  request: ApiRequest;
  isMobile: boolean;
  onBackToList: () => void;
  onOpenReplay: () => void;
  onOpenResponseSettings: () => void;
  onAskDelete: () => void;
}

export function RequestInspector({ endpoint, request, isMobile, onBackToList, onOpenReplay, onOpenResponseSettings, onAskDelete }: RequestInspectorProps) {
  const [tab, setTab] = useState<Tab>('body');
  const [reveal, setReveal] = useState(false);
  const copy = useCopy();

  const mc = methodColors(request.method);
  const sc = statusColors(request.responseStatus);
  const host = window.location.host;
  const headerValue = (h: { name: string; value: string }) =>
    isSensitiveHeader(h.name) && !reveal ? maskValue() : h.value;

  const download = () => {
    const blob = new Blob([JSON.stringify(request, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `request-${request.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F1F5' }}>
        {isMobile && (
          <span onClick={onBackToList} style={{ display: 'inline-block', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#6D4AFF', cursor: 'pointer' }}>
            ← All requests
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <MethodBadge method={request.method} colors={mc} large />
          <span className="mono" style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{request.path}</span>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: sc[0], background: sc[1], borderRadius: 5, padding: '3px 8px' }}>
            {statusFull(request.responseStatus)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 20px' }}>
          <div>
            <SectionLabel>Received</SectionLabel>
            <div className="mono" style={{ fontSize: 13 }}>{fullTimestamp(request.receivedAt)}</div>
          </div>
          <div>
            <SectionLabel>Duration</SectionLabel>
            <div className="mono" style={{ fontSize: 13 }}>{request.durationMs} ms</div>
          </div>
          <div>
            <SectionLabel>Size</SectionLabel>
            <div className="mono" style={{ fontSize: 13 }}>{formatSize(request.bodySize)}</div>
          </div>
          <div>
            <SectionLabel>Source IP</SectionLabel>
            <div className="mono" style={{ fontSize: 13 }}>{request.sourceIp ?? '—'}</div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <SectionLabel>User agent</SectionLabel>
            <div className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{request.userAgent ?? '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F1F5', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#FCFCFD' }}>
        <button className="btnSecondary" onClick={() => copy(rawRequestText(request, host, h => h.value), 'Request copied')} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
          Copy request
        </button>
        <button className="btnSecondary" onClick={() => copy(toCurl(request, window.location.origin), 'Copied as cURL')} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
          Copy as cURL
        </button>
        <button className="btnSecondary" onClick={onOpenReplay} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
          Replay
        </button>
        <button className="btnSecondary" onClick={download} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
          Download
        </button>
        <button className="btnDangerOutline" onClick={onAskDelete} style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12.5 }}>
          Delete
        </button>
      </div>

      <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid #F1F1F5', overflowX: 'auto' }}>
        {TABS.map(([key, label]) => (
          <span
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '11px 13px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: `2px solid ${tab === key ? '#6D4AFF' : 'transparent'}`,
              color: tab === key ? '#16161D' : '#9A9AAB'
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {tab === 'body' && <PayloadViewer key={request.id} request={request} />}

      {tab === 'headers' && (
        <div style={{ padding: '8px 20px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0' }}>
            <span onClick={() => setReveal(!reveal)} style={{ fontSize: 12.5, fontWeight: 600, color: '#6D4AFF', cursor: 'pointer' }}>
              {reveal ? 'Hide sensitive values' : 'Reveal sensitive values'}
            </span>
          </div>
          <KeyValueTable rows={request.headers.map(h => ({ k: h.name, v: headerValue(h) }))} />
        </div>
      )}

      {tab === 'query' && (
        <div style={{ padding: 20 }}>
          <KeyValueTable rows={request.query.map(({ k, v }) => ({ k, v }))} />
        </div>
      )}

      {tab === 'raw' && (
        <div className="mono" style={{ padding: 20, fontSize: 12.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#16161D' }}>
          {rawRequestText(request, host, headerValue)}
        </div>
      )}

      {tab === 'response' && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 4 }}>Status</div>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: sc[0], background: sc[1], borderRadius: 5, padding: '3px 8px' }}>
                {statusFull(request.responseStatus)}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 4 }}>Response time</div>
              <div className="mono" style={{ fontSize: 13 }}>{request.durationMs} ms</div>
            </div>
            <button className="btnSecondary" onClick={onOpenResponseSettings} style={{ marginLeft: 'auto', borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
              Edit custom response
            </button>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 8 }}>Response headers</div>
            <KeyValueTable
              rows={[
                ...(request.responseStatus !== 204 && endpoint.responseBody ? [{ k: 'content-type', v: endpoint.responseContentType }] : []),
                { k: 'x-testmyhook-id', v: endpoint.token },
                { k: 'cache-control', v: 'no-store' }
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 8 }}>Response body</div>
            <div className="mono" style={{ border: '1px solid #EFEFF3', borderRadius: 9, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#FCFCFD' }}>
              {request.responseStatus === 204 ? '(empty)' : endpoint.responseBody || '(empty)'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
