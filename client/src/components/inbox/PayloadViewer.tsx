import { useMemo, useState } from 'react';
import type { ApiRequest } from '../../types';
import { jsonLines, parsedJsonBody } from '../../lib/format';
import { useCopy } from '../Toast';

export function PayloadViewer({ request }: { request: ApiRequest }) {
  const [mode, setMode] = useState<'pretty' | 'raw'>('pretty');
  const [search, setSearch] = useState('');
  const [wrap, setWrap] = useState(true);
  const copy = useCopy();

  const parsed = useMemo(() => parsedJsonBody(request), [request]);
  const lines = useMemo(() => (parsed !== undefined ? jsonLines(parsed) : []), [parsed]);
  const rawBody = request.bodyIsText
    ? request.body || '(no body)'
    : `(binary body — base64)\n${request.body}`;
  const hasBody = request.bodyIsText && request.body.trim() !== '';
  const invalid = hasBody && parsed === undefined && (request.contentType ?? '').includes('json');
  const showPretty = mode === 'pretty' && parsed !== undefined;
  const q = search.trim().toLowerCase();

  return (
    <div>
      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #F5F5F8' }}>
        <div style={{ display: 'flex', background: '#F4F4F7', borderRadius: 7, padding: 2 }}>
          {(['pretty', 'raw'] as const).map(m => (
            <span
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '5px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 5, cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#16161D' : '#6B6B7B',
                boxShadow: mode === m ? '0 1px 2px rgba(22,22,29,0.1)' : 'none'
              }}
            >
              {m === 'pretty' ? 'Pretty' : 'Raw'}
            </span>
          ))}
        </div>
        <input
          className="tmInput tmInputGray"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search payload"
          style={{ flex: '0 1 200px', padding: '6px 10px', fontSize: 12.5, borderRadius: 7 }}
        />
        <span onClick={() => setWrap(!wrap)} style={{ fontSize: 12.5, color: wrap ? '#6D4AFF' : '#9A9AAB', cursor: 'pointer', fontWeight: 500 }}>
          Wrap lines
        </span>
        <span
          className="linkHoverPurple"
          onClick={() => copy(request.bodyIsText ? request.body : rawBody, 'Request body copied')}
          style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#6B6B7B' }}
        >
          Copy body
        </span>
      </div>

      {invalid && (
        <div style={{ margin: '14px 20px 0', border: '1px solid #F0E9D8', background: '#FDFBF4', borderRadius: 8, padding: '10px 13px', fontSize: 13, color: '#8A6D1F' }}>
          This payload is not valid JSON. Displaying raw content instead.
        </div>
      )}

      {showPretty ? (
        <div style={{ padding: '14px 20px 20px', overflowX: 'auto' }}>
          {lines.map(line => {
            const text = (line.indent + line.parts.map(p => p.t).join('')).toLowerCase();
            const hit = q !== '' && text.includes(q);
            return (
              <div
                key={line.n}
                className="mono"
                style={{ display: 'flex', gap: 14, fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre', background: hit ? '#F2EFFF' : undefined }}
              >
                <span style={{ color: '#C7C7D2', userSelect: 'none', textAlign: 'right', minWidth: 22 }}>{line.n}</span>
                <span>
                  {line.indent}
                  {line.parts.map((part, i) => (
                    <span key={i} style={{ color: part.c }}>{part.t}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="mono"
          style={{ padding: '14px 20px 20px', fontSize: 13, lineHeight: 1.75, color: '#16161D', whiteSpace: wrap ? 'pre-wrap' : 'pre', overflowX: 'auto', overflowWrap: wrap ? 'anywhere' : undefined }}
        >
          {rawBody}
        </div>
      )}
    </div>
  );
}
