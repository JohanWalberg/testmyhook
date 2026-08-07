import type { ApiEndpoint } from '../../types';
import { expiryLabel } from '../../lib/format';
import { useCopy } from '../Toast';

interface WebhookUrlCardProps {
  endpoint: ApiEndpoint;
  url: string;
  requestCount: number;
  onRegenerate: () => void;
  onOpenQr: () => void;
  onOpenSettings: () => void;
  onClearAll: () => void;
  onTogglePause: () => void;
}

export function WebhookUrlCard({ endpoint, url, requestCount, onRegenerate, onOpenQr, onOpenSettings, onClearAll, onTogglePause }: WebhookUrlCardProps) {
  const copy = useCopy();
  const statusLabel = endpoint.expired ? 'Expired' : endpoint.paused ? 'Paused' : 'Active';
  const statusColor = endpoint.expired ? '#DC2626' : endpoint.paused ? '#C2410C' : '#15803D';
  const curlExample = `curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"payment.completed"}'`;

  return (
    <section style={{ background: '#fff', border: '1px solid #E7E7EC', borderRadius: 12 }}>
      <div style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', borderBottom: '1px solid #F1F1F5' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 8 }}>
            Callback URL
          </div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{url}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btnPrimary" onClick={() => copy(url, 'Callback URL copied')} style={{ padding: '9px 16px', fontSize: 13.5 }}>
            Copy URL
          </button>
          <button className="btnSecondary" onClick={onRegenerate} style={{ padding: '9px 14px', fontSize: 13.5 }}>
            Regenerate
          </button>
          <button className="btnSecondary" onClick={onOpenQr} style={{ padding: '9px 14px', fontSize: 13.5 }}>
            QR code
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', borderBottom: '1px solid #F1F1F5', background: '#FCFCFD' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#6B6B7B' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'block' }} />
          <span style={{ color: '#16161D', fontWeight: 500 }}>{statusLabel}</span>
        </div>
        <div style={{ fontSize: 13, color: '#6B6B7B', whiteSpace: 'nowrap' }}>
          Expires <span style={{ color: '#16161D', fontWeight: 500 }}>{expiryLabel(endpoint.expiresAt)}</span>
        </div>
        <div style={{ fontSize: 13, color: '#6B6B7B' }}>
          Requests <span style={{ color: '#16161D', fontWeight: 500 }}>{requestCount}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btnGhost" onClick={onClearAll} style={{ padding: '6px 11px', fontSize: 12.5 }}>Clear requests</button>
          <button className="btnGhost" onClick={onTogglePause} style={{ padding: '6px 11px', fontSize: 12.5 }}>
            {endpoint.paused ? 'Resume receiving' : 'Pause receiving'}
          </button>
          <button className="btnGhost" onClick={onOpenSettings} style={{ padding: '6px 11px', fontSize: 12.5 }}>Endpoint settings</button>
        </div>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: '#16161D', fontWeight: 500 }}>
            Send any HTTP request to this URL. Incoming requests will appear below in real time.
          </p>
          <div style={{ border: '1px solid #E7E7EC', borderRadius: 9, background: '#FCFCFD', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #F1F1F5' }}>
              <span className="mono" style={{ fontSize: 11.5, color: '#9A9AAB' }}>bash</span>
              <span
                className="linkHoverPurple"
                onClick={() => copy(curlExample, 'cURL example copied')}
                style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#6B6B7B' }}
              >
                Copy cURL example
              </span>
            </div>
            <div className="mono" style={{ padding: 12, fontSize: 12.5, lineHeight: 1.7, color: '#16161D', overflowX: 'auto', whiteSpace: 'pre' }}>
              {'curl -X POST ' + url + ' \\\n  -H '}
              <span style={{ color: '#0F766E' }}>"Content-Type: application/json"</span>
              {' \\\n  -d '}
              <span style={{ color: '#0F766E' }}>{`'{"event":"payment.completed"}'`}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: '0 1 320px', minWidth: 260, border: '1px solid #F0E9D8', background: '#FDFBF4', borderRadius: 9, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8A6D1F', marginBottom: 6 }}>Privacy notice</div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6B6B7B' }}>
            Avoid sending passwords, production secrets or sensitive personal data. Temporary endpoints and captured requests are automatically deleted.
          </p>
        </div>
      </div>
    </section>
  );
}
