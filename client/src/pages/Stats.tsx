import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { formatSize } from '../lib/format';

interface StatsPayload {
  since: number;
  urlsCreated: number;
  webhooksReceived: number;
  pageVisits: number;
  urlsActive: number;
  webhooksStored: number;
  bytesStored: number;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function Stats() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const sinceLabel = stats
    ? new Date(stats.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '…';

  const blocks = stats
    ? [
        { label: 'URLS CREATED', value: formatCount(stats.urlsCreated), sub: `${formatCount(stats.urlsActive)} active right now` },
        { label: 'WEBHOOKS RECEIVED', value: formatCount(stats.webhooksReceived), sub: 'all requests ever accepted' },
        { label: 'WEBHOOKS STORED', value: formatCount(stats.webhooksStored), sub: 'currently kept, max 500 per URL' },
        { label: 'DATA STORED', value: formatSize(stats.bytesStored), sub: 'payload bytes on disk right now' },
        { label: 'PAGE VISITS', value: formatCount(stats.pageVisits), sub: 'homepage loads' },
        { label: 'COUNTING SINCE', value: sinceLabel, sub: 'when this instance first started' }
      ]
    : [];

  return (
    <div style={{ minHeight: '100%', background: 'var(--main-bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1264, margin: '0 auto', padding: '64px 88px 72px', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
          <Logo onClick={() => navigate('/')} />
          <h2 className="mono" style={{ margin: 0, fontSize: 32, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Stats
          </h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--ink-3)' }}>
            Live usage numbers for this instance, straight from the database. Old requests are trimmed and idle URLs expire,
            so the all-time counters keep growing while the stored numbers stay small on purpose.
          </p>
        </div>

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
            {blocks.map(block => (
              <div key={block.label} style={{ display: 'flex', flexDirection: 'column', gap: 11, borderTop: '2px solid var(--ink)', paddingTop: 16 }}>
                <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.14em', color: 'var(--accent)' }}>{block.label}</div>
                <div className="mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{block.value}</div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--ink-3)' }}>{block.sub}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 13, color: 'var(--muted-2)' }}>loading…</div>
        )}
      </div>
    </div>
  );
}
