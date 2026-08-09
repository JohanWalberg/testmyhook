import { useEffect, useState, type ReactNode } from 'react';
import { inlineSpans, type CodeSpan } from '../lib/format';

const SPAN_COLORS: Record<CodeSpan['kind'], string> = {
  plain: 'inherit',
  key: 'var(--json-key)',
  str: 'var(--json-str)',
  num: 'var(--json-num)',
  lit: 'var(--json-num)'
};

/** Broadcast from the expand/collapse-all buttons; version bumps force every node to `open`. */
export interface FoldSignal {
  version: number;
  open: boolean;
}

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
          className="hoverAccent"
          onClick={onToggle}
          title={chevron === '▾' ? 'Collapse section' : 'Expand section'}
          style={{
            position: 'absolute', left: indent * 20 - 22, top: 0, width: 22, height: 24,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--muted)', cursor: 'pointer', userSelect: 'none', fontSize: 13
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
  fold?: FoldSignal;
}

function Node({ k, value, indent, last, fold }: NodeProps) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    // Collapse-all folds nested sections but keeps the root open, so the
    // top-level keys stay visible as an overview.
    if (fold) setOpen(fold.open || indent === 0);
  }, [fold?.version]);

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
        <span onClick={() => setOpen(true)} style={{ cursor: 'pointer' }} title="Expand section">
          <Spans spans={keySpans} />
          {openCh}
          <span style={{ color: 'var(--faint)' }}>
            {` … ${entries.length} ${isArray ? (entries.length === 1 ? 'item' : 'items') : entries.length === 1 ? 'key' : 'keys'} `}
          </span>
          {closeCh + comma}
        </span>
      </Line>
    );
  }

  return (
    <>
      <Line indent={indent} chevron="▾" onToggle={() => setOpen(false)}>
        <span onClick={() => setOpen(false)} style={{ cursor: 'pointer' }} title="Collapse section">
          <Spans spans={keySpans} />
          {openCh}
        </span>
      </Line>
      {entries.map(([childKey, childValue], i) => (
        <Node key={childKey ?? i} k={childKey} value={childValue} indent={indent + 1} last={i === entries.length - 1} fold={fold} />
      ))}
      <Line indent={indent}>{closeCh + comma}</Line>
    </>
  );
}

/** Editor-style JSON viewer: syntax colors plus fold/unfold on every multi-line object and array. */
export function JsonTree({ value, fold }: { value: unknown; fold?: FoldSignal }) {
  return <Node k={null} value={value} indent={0} last fold={fold} />;
}
