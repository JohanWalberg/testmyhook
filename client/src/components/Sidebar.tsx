import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiEndpoint, ApiRequest } from '../types';
import { fullUrl } from '../api';
import type { Theme } from '../lib/storage';
import { Logo } from './Logo';
import { RequestList } from './RequestList';
import { UrlMenu } from './UrlMenu';

interface SidebarProps {
  theme: Theme;
  onToggleTheme: () => void;
  slugs: string[];
  active: string | null;
  endpoint: ApiEndpoint | null;
  requests: ApiRequest[];
  selectedId: number | null;
  search: string;
  live: boolean;
  onSearch: (value: string) => void;
  onSelect: (id: number) => void;
  onActivate: (slug: string) => void;
  onAdd: () => void;
  onClose: (slug: string) => void;
  onRegenerate: () => void;
  onUpdateResponse: (input: { responseStatus?: number; responseBody?: string; responseDelayMs?: number }) => void;
}

export function Sidebar(props: SidebarProps) {
  const { theme, onToggleTheme, slugs, active, endpoint, requests, selectedId, search, live } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const copyUrl = () => {
    if (!active) return;
    navigator.clipboard?.writeText(fullUrl(active)).catch(() => {});
    clearTimeout(copyTimer.current);
    setCopied(true);
    copyTimer.current = setTimeout(() => setCopied(false), 1200);
  };

  // "/" focuses search from anywhere outside an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = search.trim()
    ? requests.filter(r =>
        `${r.path} ${r.method} ${r.source} ${r.bodyIsText ? r.body : ''}`.toLowerCase().includes(search.trim().toLowerCase())
      )
    : requests;

  return (
    <div
      style={{
        width: 392, flex: 'none', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--sidebar)', position: 'relative'
      }}
    >
      <div style={{ padding: '22px 22px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo cursor />
        <div
          className="mono hoverInk clickable"
          onClick={() => navigate('/how')}
          title="How to use"
          style={{ fontSize: 16, color: 'var(--muted)', padding: '2px 8px', border: '1px solid var(--border-strong)', borderRadius: 6 }}
        >
          ···
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 22px 12px', overflow: 'hidden', width: 392 }}>
        {slugs.map(slug => {
          const isActive = slug === active;
          return (
            <div
              key={slug}
              onClick={() => props.onActivate(slug)}
              className="clickable"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 7px', borderRadius: 7,
                minWidth: 0, flex: isActive ? 'none' : '0 1 auto',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: isActive ? 'var(--card)' : 'transparent'
              }}
            >
              {isActive && (
                <span style={{ width: 5, height: 5, flex: 'none', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              )}
              <span
                className="mono"
                style={{
                  fontSize: 11, color: isActive ? 'var(--ink)' : 'var(--muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              >
                {slug}
              </span>
              <span
                className="mono hoverInk"
                onClick={e => {
                  e.stopPropagation();
                  props.onClose(slug);
                }}
                style={{ fontSize: 12, color: 'var(--faint)', flex: 'none' }}
              >
                ×
              </span>
            </div>
          );
        })}
        <div
          className="mono hoverInk clickable"
          onClick={props.onAdd}
          title="New URL"
          style={{
            fontSize: 13, color: 'var(--muted)', border: '1px dashed var(--border-strong)',
            borderRadius: 7, padding: '5px 9px', flex: 'none', marginLeft: 'auto'
          }}
        >
          +
        </div>
      </div>

      <div style={{ padding: '0 22px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)',
            border: `1px solid ${menuOpen ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 8, padding: '11px 12px'
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            <span style={{ color: 'var(--muted-2)' }}>{window.location.host}/</span>
            {active ?? '…'}
          </span>
          <button className="copyBtn" onClick={copyUrl}>{copied ? 'COPIED' : 'COPY'}</button>
          <span
            className="clickable"
            onClick={() => setMenuOpen(o => !o)}
            style={{ color: menuOpen ? 'var(--accent)' : 'var(--muted-2)', fontSize: 11 }}
          >
            {menuOpen ? '▴' : '▾'}
          </span>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '9px 12px',
            border: `1px solid ${search ? 'var(--border-strong)' : 'var(--border)'}`,
            background: search ? 'var(--card)' : 'var(--card-alt)'
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: search ? 'var(--accent)' : 'var(--faint)' }}>/</span>
          <input
            ref={searchRef}
            className="searchInput"
            placeholder="search requests"
            value={search}
            onChange={e => props.onSearch(e.target.value)}
          />
          {search && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)', flex: 'none' }}>
              {filtered.length} of {requests.length}
            </span>
          )}
        </div>
      </div>

      <RequestList requests={filtered} total={requests.length} selectedId={selectedId} onSelect={props.onSelect} />

      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          className="mono"
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: live ? 'var(--green)' : 'var(--muted)' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? 'var(--green)' : 'var(--muted)', display: 'inline-block' }} />
          {live ? 'LIVE' : 'OFFLINE'}
        </div>
        <div
          className="mono hoverInk clickable"
          onClick={onToggleTheme}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}
        >
          {theme === 'dark' ? '☀ light' : '☾ dark'}
        </div>
      </div>

      {menuOpen && active && endpoint && (
        <UrlMenu
          slug={active}
          endpoint={endpoint}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onCopy={copyUrl}
          onRegenerate={props.onRegenerate}
          onUpdateResponse={props.onUpdateResponse}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
