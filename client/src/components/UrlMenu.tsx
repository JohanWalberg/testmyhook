import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ApiEndpoint } from '../types';
import { api } from '../api';
import type { Theme } from '../lib/storage';

const STATUS_PRESETS = [200, 201, 301, 404, 500];

interface UrlMenuProps {
  slug: string;
  endpoint: ApiEndpoint;
  theme: Theme;
  onToggleTheme: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onUpdateResponse: (input: { responseStatus?: number; responseBody?: string; responseDelayMs?: number }) => void;
  onClearRequests: () => void;
  onDeleteUrl: () => void;
  onClose: () => void;
  /** The button that opened the menu — its clicks toggle, so outside-click must ignore it. */
  anchorRef?: RefObject<HTMLElement | null>;
}

export function UrlMenu({ slug, endpoint, theme, onToggleTheme, onCopy, onRegenerate, onUpdateResponse, onClearRequests, onDeleteUrl, onClose, anchorRef }: UrlMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState<'clear' | 'delete' | null>(null);
  const [shared, setShared] = useState(false);
  const shareTimer = useRef<ReturnType<typeof setTimeout>>();

  const copyShareLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/view/${slug}`).catch(() => {});
    clearTimeout(shareTimer.current);
    setShared(true);
    shareTimer.current = setTimeout(() => setShared(false), 1200);
  };
  const isPreset = STATUS_PRESETS.includes(endpoint.responseStatus);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customStatus, setCustomStatus] = useState(String(endpoint.responseStatus));
  const [body, setBody] = useState(endpoint.responseBody);
  const [delay, setDelay] = useState(String(endpoint.responseDelayMs));
  const bodyTimer = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click / Escape; ⌘R regenerates, ⌘C copies while open.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef?.current?.contains(target)) return; // the toggle button handles itself
      if (ref.current && !ref.current.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onRegenerate();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        onCopy();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, onCopy, onRegenerate]);

  const setStatus = (status: number) => {
    setCustomMode(false);
    onUpdateResponse({ responseStatus: status });
  };

  const applyCustomStatus = () => {
    const n = parseInt(customStatus, 10);
    if (Number.isFinite(n) && n >= 100 && n <= 599) onUpdateResponse({ responseStatus: n });
  };

  const changeBody = (value: string) => {
    setBody(value);
    clearTimeout(bodyTimer.current);
    bodyTimer.current = setTimeout(() => onUpdateResponse({ responseBody: value }), 500);
  };

  const applyDelay = () => {
    const n = parseInt(delay.replace(/[^\d]/g, ''), 10);
    onUpdateResponse({ responseDelayMs: Number.isFinite(n) ? n : 0 });
  };

  const sectionLabel = (text: string, topBorder = false) => (
    <div
      className="mono"
      style={{
        padding: topBorder ? '14px 18px 10px' : '14px 18px',
        borderTop: topBorder ? '1px solid var(--border-soft)' : undefined,
        borderBottom: topBorder ? undefined : '1px solid var(--border-soft)',
        fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)'
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: window.innerWidth < 700 ? 12 : 414,
        top: window.innerWidth < 700 ? 150 : 118,
        width: 412, maxWidth: 'calc(100vw - 24px)', zIndex: 40,
        background: 'var(--card)', border: '1px solid var(--frame-border)', borderRadius: 11,
        boxShadow: 'var(--pop-shadow)', overflow: 'hidden'
      }}
    >
      {sectionLabel('Webhook URL')}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className="mono menuRow"
          onClick={() => {
            onRegenerate();
            onClose();
          }}
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ink)' }}
        >
          ↻ <span>Regenerate URL</span>
          <span className="mono" style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 11 }}>⌘R</span>
        </div>
        <div
          className="mono menuRow"
          onClick={onCopy}
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ink)' }}
        >
          ⧉ <span>Copy URL</span>
          <span className="mono" style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 11 }}>⌘C</span>
        </div>
        <div
          className="mono menuRow"
          onClick={copyShareLink}
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: shared ? 'var(--green)' : 'var(--ink)' }}
        >
          ⇪ <span>{shared ? 'Link copied — anyone with it sees this inbox' : 'Share inbox link'}</span>
        </div>
        <a
          className="mono menuRow"
          href={api.exportAllUrl(slug)}
          download
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}
        >
          ⇩ <span>Export all requests as JSON</span>
        </a>
        <div
          className="mono menuRow"
          onClick={() => {
            if (confirming !== 'clear') {
              setConfirming('clear');
              return;
            }
            onClearRequests();
            setConfirming(null);
            onClose();
          }}
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--accent)' }}
        >
          ⌫ <span>{confirming === 'clear' ? 'Click again to clear all requests' : 'Clear all requests'}</span>
        </div>
        <div
          className="mono menuRow"
          onClick={() => {
            if (confirming !== 'delete') {
              setConfirming('delete');
              return;
            }
            onDeleteUrl();
            setConfirming(null);
            onClose();
          }}
          style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--accent)' }}
        >
          ✕ <span>{confirming === 'delete' ? 'Click again to delete this URL' : 'Delete this URL'}</span>
        </div>
      </div>

      {sectionLabel('Response returned to sender', true)}
      <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_PRESETS.map(status => {
            const isActive = !customMode && endpoint.responseStatus === status;
            return (
              <div
                key={status}
                className="mono clickable"
                onClick={() => setStatus(status)}
                style={{
                  fontSize: 12, padding: '6px 11px', borderRadius: 6,
                  background: isActive ? 'var(--ink)' : 'transparent',
                  color: isActive ? 'var(--canvas)' : 'var(--ink-3)',
                  border: isActive ? '1px solid var(--ink)' : '1px solid var(--border-strong)'
                }}
              >
                {status}
              </div>
            );
          })}
          {customMode ? (
            <input
              className="mono"
              autoFocus
              value={customStatus}
              onChange={e => setCustomStatus(e.target.value)}
              onBlur={applyCustomStatus}
              onKeyDown={e => e.key === 'Enter' && applyCustomStatus()}
              style={{
                fontSize: 12, padding: '6px 11px', borderRadius: 6, width: 64,
                border: '1px solid var(--accent)', background: 'transparent', color: 'var(--ink)', outline: 'none'
              }}
            />
          ) : (
            <div
              className="mono clickable"
              onClick={() => {
                setCustomMode(true);
                setCustomStatus(String(endpoint.responseStatus));
              }}
              style={{ fontSize: 12, padding: '6px 11px', borderRadius: 6, border: '1px dashed var(--border-strong)', color: 'var(--faint)' }}
            >
              custom
            </div>
          )}
        </div>
        <textarea
          className="popInput"
          rows={2}
          value={body}
          onChange={e => changeBody(e.target.value)}
          spellCheck={false}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Delay response</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              className="mono"
              value={delay}
              onChange={e => setDelay(e.target.value)}
              onBlur={applyDelay}
              onKeyDown={e => e.key === 'Enter' && applyDelay()}
              style={{
                fontSize: 12.5, color: 'var(--muted)', background: 'transparent', border: 'none',
                outline: 'none', width: 48, textAlign: 'right'
              }}
            />
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>ms</span>
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '13px 18px', borderTop: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <span className="mono" style={{ fontSize: 13, color: 'var(--ink)' }}>Dark mode</span>
        <span
          className="clickable"
          onClick={onToggleTheme}
          style={{
            width: 36, height: 20, borderRadius: 11,
            background: theme === 'dark' ? 'var(--accent)' : 'var(--skeleton)',
            display: 'flex', alignItems: 'center', padding: 2,
            justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start'
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
        </span>
      </div>
    </div>
  );
}
