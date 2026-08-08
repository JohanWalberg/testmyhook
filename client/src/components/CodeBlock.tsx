import { useRef, useState, type ReactNode } from 'react';

interface CodeBlockProps {
  /** Clean, single-line command placed on the clipboard — no prompt symbols, no line continuations. */
  copyText: string;
  label?: string;
  children: ReactNode;
}

/** Dark terminal card with a copy button. The rendered `children` are display-only. */
export function CodeBlock({ copyText, label, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copy = () => {
    navigator.clipboard?.writeText(copyText).catch(() => {});
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="mono" style={{ position: 'relative', background: '#16130F', borderRadius: 9, padding: '18px 20px', fontSize: 13, lineHeight: 1.9, color: '#E6E0D4', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: label ? 10 : 0 }}>
        {label && <div style={{ color: '#8C8377', fontSize: 11, letterSpacing: '0.14em' }}>{label}</div>}
        <span
          onClick={copy}
          style={{
            position: 'absolute', top: 12, right: 14, fontSize: 11, letterSpacing: '0.06em',
            color: copied ? '#7E9C86' : '#8C8377', cursor: 'pointer', userSelect: 'none'
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Prompt symbol that never ends up on the clipboard when text is selected manually. */
export function Prompt() {
  return <span style={{ color: '#7E9C86', userSelect: 'none' }}>$ </span>;
}
