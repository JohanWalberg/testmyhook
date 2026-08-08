interface LogoProps {
  cursor?: boolean;
  onClick?: () => void;
}

export function Logo({ cursor, onClick }: LogoProps) {
  return (
    <div
      onClick={onClick}
      className="mono"
      style={{
        display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 19, fontWeight: 700,
        color: 'var(--ink)', letterSpacing: '-0.02em', cursor: onClick ? 'pointer' : undefined
      }}
    >
      <span style={{ color: 'var(--accent)' }}>&gt;</span>
      <span style={{ marginLeft: 6 }}>TestMyHook</span>
      {cursor && (
        <span style={{ width: 9, height: 17, background: 'var(--accent)', display: 'inline-block', marginLeft: 5, animation: 'blink 1.1s step-end infinite' }} />
      )}
    </div>
  );
}
