import { useEffect, useState } from 'react';
import type { ApiRequest } from '../types';
import { dayLabel, detailTime, formatSize, listTime, methodColor, requestTitle } from '../lib/format';

interface RequestListProps {
  requests: ApiRequest[];
  total: number;
  selectedId: number | null;
  freshId: number | null;
  onSelect: (id: number) => void;
}

export function RequestList({ requests, total, selectedId, freshId, onSelect }: RequestListProps) {
  // Re-render every 30 s so relative times ("12s ago") stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (total === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 40px', textAlign: 'center' }}>
        <div
          className="mono"
          style={{ width: 44, height: 44, border: '1.5px dashed var(--dash)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint-3)', fontSize: 18 }}
        >
          ◦
        </div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--muted-2)' }}>no requests yet</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--faint-2)' }}>
          Listening. Anything sent to your URL shows up here instantly.
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 40px', textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 13, color: 'var(--muted-2)' }}>no matching requests</div>
      </div>
    );
  }

  const groups: { label: string; items: ApiRequest[] }[] = [];
  for (const r of requests) {
    const label = dayLabel(r.receivedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {groups.map(group => (
        <div key={group.label}>
          <div
            className="mono"
            style={{ padding: '10px 22px 8px', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--faint-2)' }}
          >
            {group.label}
          </div>
          {group.items.map((r, i) => {
            const isSelected = r.id === selectedId;
            return (
              <div
                key={r.id}
                className={`${isSelected ? '' : 'listRow'} ${r.id === freshId ? 'flashNew' : ''}`.trim() || undefined}
                onClick={() => onSelect(r.id)}
                style={{
                  padding: '12px 22px',
                  borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                  background: isSelected ? 'var(--card)' : undefined,
                  display: 'flex', flexDirection: 'column', gap: 6,
                  borderBottom: !isSelected && i < group.items.length - 1 ? '1px solid var(--border-row)' : undefined
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    className="mono"
                    style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--badge-ink)', background: methodColor(r.method), padding: '3px 6px', borderRadius: 4 }}
                  >
                    {r.method}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13, color: isSelected ? 'var(--ink)' : 'var(--ink-2)',
                      fontWeight: isSelected ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}
                  >
                    {requestTitle(r)}
                  </span>
                  <span
                    className="mono"
                    title={detailTime(r.receivedAt)}
                    style={{ fontSize: 11, color: 'var(--muted-2)', marginLeft: 'auto', flex: 'none' }}
                  >
                    {listTime(r.receivedAt)}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[r.source, r.sourceIp, r.responseStatus, formatSize(r.bodySize)].filter(x => x !== null && x !== undefined).join(' · ')}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
