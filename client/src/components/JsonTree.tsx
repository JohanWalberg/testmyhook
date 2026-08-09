import { useState, type ReactNode } from 'react';
import { inlineSpans, type CodeSpan } from '../lib/format';

const SPAN_COLORS: Record<CodeSpan['kind'], string> = {
  plain: 'inherit',
  key: 'var(--json-key)',
  str: 'var(--json-str)',
  num: 'var(--json-num)',
  lit: 'var(--json-num)'
};

function Spans({ spans }: { spans: CodeSpan[] }) {
  return (
    <>
      {spans.map((span, i) => (
        <span key={i} style={{ color: SPAN_COLORS[span.kind] }}>{span.text}</span>
      ))}
    </>
  );
}

function primitiveSpan(value: unknown): CodeSpan {
  if (typeof value === 'string') return { text: JSON.stringify(value), kind: 'str' };
  if (typeof value === 'number') return { text: String(value), kind: 'num' };
  return { text: String(value), kind: 'lit' };
}

interface LineProps {
  indent: number;
  chevron?: '▾' | '▸';
  onToggle?: () => void;
  children: ReactNode;
}

function Line({ indent, chevron, onToggle, children }: LineProps) {
  return (
    <div style={{ position: 'relative', paddingLeft: indent * 20, whiteSpace: 'pre' }}>
      {chevron && (
        <span
          onClick={onToggle}
          style={{
            position: 'absolute', left: indent * 20 - 16, top: 0, width: 16,
            color: 'var(--faint)', cursor: 'pointer', userSelect: 'none', fontSize: 10, lineHeight: '24px'
          }}
        >
          {chevron}
        </span>
      )}
      {children}
    </div>
  );
}

interface NodeProps {
  k: string | null;
  value: unknown;
  indent: number;
  last: boolean;
}

function Node({ k, value, indent, last }: NodeProps) {
  const [open, setOpen] = useState(true);
  const comma = last ? '' : ',';
  const keySpans: CodeSpan[] =
    k !== null ? [{ text: JSON.stringify(k), kind: 'key' }, { text: ': ', kind: 'plain' }] : [];

  if (value === null || typeof value !== 'object') {
    return (
      <Line indent={indent}>
        <Spans spans={[...keySpans, primitiveSpan(value), ...(comma ? [{ text: comma, kind: 'plain' as const }] : [])]} />
      </Line>
    );
  }

  // Short objects/arrays render inline, exactly as the design's
  // `{ "sku": "TS-BLK-M", "qty": 2 },` rows — nothing to fold there.
  const inline = indent > 0 ? inlineSpans(value) : null;
  if (inline) {
    return (
      <Line indent={indent}>
        <Spans spans={[...keySpans, ...inline, ...(comma ? [{ text: comma, kind: 'plain' as const }] : [])]} />
      </Line>
    );
  }

  const isArray = Array.isArray(value);
  const entries: [string | null, unknown][] = isArray
    ? (value as unknown[]).map(v => [null, v] as [null, unknown])
    : Object.entries(value as Record<string, unknown>);
  const openCh = isArray ? '[' : '{';
  const closeCh = isArray ? ']' : '}';

  if (!open) {
    return (
      <Line indent={indent} chevron="▸" onToggle={() => setOpen(true)}>
        <Spans spans={keySpans} />
        {openCh}
        <span onClick={() => setOpen(true)} style={{ color: 'var(--faint)', cursor: 'pointer' }}>
          {` … ${entries.length} ${isArray ? (entries.length === 1 ? 'item' : 'items') : entries.length === 1 ? 'key' : 'keys'} `}
        </span>
        {closeCh + comma}
      </Line>
    );
  }

  return (
    <>
      <Line indent={indent} chevron="▾" onToggle={() => setOpen(false)}>
        <Spans spans={keySpans} />
        {openCh}
      </Line>
      {entries.map(([childKey, childValue], i) => (
        <Node key={childKey ?? i} k={childKey} value={childValue} indent={indent + 1} last={i === entries.length - 1} />
      ))}
      <Line indent={indent}>{closeCh + comma}</Line>
    </>
  );
}

/** Editor-style JSON viewer: syntax colors plus fold/unfold on every multi-line object and array. */
export function JsonTree({ value }: { value: unknown }) {
  return <Node k={null} value={value} indent={0} last />;
}
