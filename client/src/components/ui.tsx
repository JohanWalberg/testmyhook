import type { CSSProperties } from 'react';

export function Logo({ size = 22, onClick }: { size?: number; onClick?: () => void }) {
  const small = size <= 20;
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: small ? 8 : 9, cursor: onClick ? 'pointer' : undefined }}
    >
      <div
        className="mono"
        style={{
          width: size, height: size, borderRadius: small ? 5 : 6, background: '#6D4AFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          fontSize: small ? 11 : 12, fontWeight: 600
        }}
      >
        /h
      </div>
      <span style={{ fontSize: small ? 14.5 : 16, fontWeight: 600, letterSpacing: '-0.01em' }}>TestMyHook</span>
    </div>
  );
}

/** Small mono pill used for method filters, expiry choices and status presets. */
export function pillStyle(active: boolean, mono = true): CSSProperties {
  return {
    fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
    fontSize: mono ? 11.5 : 12.5,
    fontWeight: 600,
    padding: mono ? '4px 9px' : '6px 12px',
    borderRadius: mono ? 6 : 7,
    cursor: 'pointer',
    border: `1px solid ${active ? '#DDD5FF' : mono ? '#EFEFF3' : '#E7E7EC'}`,
    background: active ? '#F2EFFF' : '#fff',
    color: active ? '#5B36F0' : '#6B6B7B'
  };
}

export function Toggle({ on, onClick, size = 'large' }: { on: boolean; onClick: () => void; size?: 'small' | 'large' }) {
  const w = size === 'large' ? 32 : 28;
  const h = size === 'large' ? 18 : 16;
  const dot = size === 'large' ? 14 : 12;
  return (
    <span
      onClick={onClick}
      style={{ width: w, height: h, borderRadius: 999, background: on ? '#6D4AFF' : '#DEDEE6', position: 'relative', display: 'block', cursor: 'pointer', transition: 'background 120ms', flex: 'none' }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? w - dot - 2 : 2, width: dot, height: dot, borderRadius: '50%', background: '#fff', transition: 'left 120ms' }} />
    </span>
  );
}

export function MethodBadge({ method, colors, large }: { method: string; colors: [string, string]; large?: boolean }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: large ? 12 : 10.5, fontWeight: 600, letterSpacing: large ? undefined : '0.03em',
        padding: large ? '3px 8px' : '2px 6px', borderRadius: large ? 5 : 4,
        color: colors[0], background: colors[1]
      }}
    >
      {method}
    </span>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 3 }}>
      {children}
    </div>
  );
}

export function KeyValueTable({ rows, dense }: { rows: { k: string; v: string }[]; dense?: boolean }) {
  return (
    <div style={{ border: '1px solid #EFEFF3', borderRadius: 9, overflow: 'hidden' }}>
      {rows.length === 0 && (
        <div style={{ padding: '14px', fontSize: 13, color: '#9A9AAB' }}>None</div>
      )}
      {rows.map((row, i) => (
        <div
          key={i}
          className="mono"
          style={{
            display: 'grid',
            gridTemplateColumns: dense ? 'minmax(120px, 200px) 1fr' : 'minmax(140px, 220px) 1fr',
            gap: dense ? 14 : 16,
            padding: dense ? '9px 13px' : '10px 14px',
            borderBottom: i < rows.length - 1 ? '1px solid #F5F5F8' : 'none',
            fontSize: dense ? 12 : 12.5
          }}
        >
          <span style={{ color: '#6B6B7B' }}>{row.k}</span>
          <span style={{ color: '#16161D', overflowWrap: 'anywhere' }}>{row.v}</span>
        </div>
      ))}
    </div>
  );
}
