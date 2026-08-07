import { useEffect, useRef } from 'react';
import type { ApiRequest } from '../../types';
import { formatSize, methodColors, requestPreview, statusColors, timeOfDay } from '../../lib/format';
import { MethodBadge, Toggle, pillStyle } from '../ui';

const FILTERS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface RequestListProps {
  requests: ApiRequest[];
  selectedId: number | null;
  search: string;
  filter: string;
  autoScroll: boolean;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onToggleAutoScroll: () => void;
  onSelect: (id: number) => void;
  onClearAll: () => void;
}

export function RequestList({ requests, selectedId, search, filter, autoScroll, onSearch, onFilter, onToggleAutoScroll, onSelect, onClearAll }: RequestListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const newestId = requests[0]?.id;

  useEffect(() => {
    if (autoScroll && listRef.current) listRef.current.scrollTop = 0;
  }, [newestId, autoScroll]);

  const q = search.trim().toLowerCase();
  const visible = requests.filter(r => {
    if (filter !== 'ALL' && r.method !== filter) return false;
    if (!q) return true;
    const haystack = `${requestPreview(r)} ${r.method} ${r.sourceIp ?? ''} ${r.contentType ?? ''} ${r.bodyIsText ? r.body : ''}`.toLowerCase();
    return haystack.includes(q);
  });

  return (
    <>
      <div style={{ padding: 12, borderBottom: '1px solid #F1F1F5', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          className="tmInput tmInputGray"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search requests"
          style={{ width: '100%', padding: '8px 11px', fontSize: 13.5 }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map(m => (
            <span key={m} style={pillStyle(filter === m)} onClick={() => onFilter(m)}>
              {m === 'ALL' ? 'All' : m}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={onToggleAutoScroll} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#6B6B7B', cursor: 'pointer' }}>
            <Toggle on={autoScroll} onClick={() => {}} size="small" />
            Auto-scroll
          </span>
          <span className="linkDanger" onClick={onClearAll} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#9A9AAB' }}>
            Clear all
          </span>
        </div>
      </div>

      {visible.length > 0 ? (
        <div ref={listRef} style={{ maxHeight: 620, overflowY: 'auto' }}>
          {visible.map(r => (
            <RequestListItem key={r.id} request={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 34, height: 34, margin: '0 auto 14px', borderRadius: '50%', border: '2px dashed #DDD5FF' }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {requests.length === 0 ? 'Waiting for your first webhook' : 'No matching requests'}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#6B6B7B' }}>
            {requests.length === 0
              ? 'Send a request to your callback URL. It will appear here instantly.'
              : 'Adjust the search or method filter to see more requests.'}
          </p>
        </div>
      )}
    </>
  );
}

function RequestListItem({ request, selected, onSelect }: { request: ApiRequest; selected: boolean; onSelect: (id: number) => void }) {
  const mc = methodColors(request.method);
  const sc = statusColors(request.responseStatus);
  return (
    <div
      className={request.isNew ? 'flashRow' : undefined}
      onClick={() => onSelect(request.id)}
      style={{
        padding: '12px 14px', borderBottom: '1px solid #F5F5F8', cursor: 'pointer',
        borderLeft: `3px solid ${selected ? '#6D4AFF' : 'transparent'}`,
        background: selected ? '#FAF9FF' : request.isNew ? '#F7F5FF' : '#fff'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <MethodBadge method={request.method} colors={mc} />
        <span className="mono" style={{ fontSize: 12, color: '#6B6B7B' }}>{timeOfDay(request.receivedAt)}</span>
        <span className="mono" style={{ fontSize: 11.5, color: '#9A9AAB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {request.contentType ?? '—'}
        </span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: sc[0] }}>
          {request.responseStatus}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12.5, color: '#16161D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
        {requestPreview(request)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: '#9A9AAB' }}>
        <span className="mono">{request.sourceIp ?? '—'}</span>
        <span>{formatSize(request.bodySize)}</span>
        {request.isNew && (
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 600, color: '#5B36F0', background: '#F2EFFF', borderRadius: 4, padding: '1px 6px' }}>
            NEW
          </span>
        )}
      </div>
    </div>
  );
}
