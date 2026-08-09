import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { WorldMap, type GeoPoint } from '../components/WorldMap';
import { formatSize } from '../lib/format';
import { usePageMeta } from '../lib/meta';

interface StatsPayload {
  since: number;
  urlsCreated: number;
  webhooksReceived: number;
  pageVisits: number;
  urlsActive: number;
  webhooksStored: number;
  bytesStored: number;
  points: GeoPoint[];
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function Stats() {
  usePageMeta('Stats', 'Live usage numbers for TestMyHook: URLs created, webhooks received, data stored, and a world map of where activity comes from.');
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () =>
      fetch('/api/stats')
        .then(r => r.json())
        .then(setStats)
        .catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
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
      <div style={{ maxWidth: 1264, margin: '0 auto', padding: '64px clamp(20px, 6vw, 88px) 72px', display: 'flex', flexDirection: 'column', gap: 48 }}>
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

        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '2px solid var(--ink)', paddingTop: 16 }}>
            <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.14em', color: 'var(--accent)' }}>
              WHERE ACTIVITY COMES FROM
            </div>
            <WorldMap points={stats.points} />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--muted-2)', maxWidth: 720 }}>
              Each dot is a region that sent webhooks or visited the site. Locations are approximate and aggregated to a
              ~200 km grid — no IP addresses are stored. {stats.points.length === 0 && 'Nothing to show yet: local traffic has no public location.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
