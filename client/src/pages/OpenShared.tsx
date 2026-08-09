import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { addSlug } from '../lib/storage';
import { Logo } from '../components/Logo';

/**
 * Landing point for shared inbox links (/view/<slug>): adds the URL to this
 * browser's tabs and drops the visitor into the live inbox.
 */
export function OpenShared() {
  const { slug = '' } = useParams();
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.getUrl(slug)
      .then(() => {
        if (cancelled) return;
        addSlug(slug);
        navigate('/', { replace: true });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  return (
    <div style={{ minHeight: '100%', background: 'var(--main-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 480, textAlign: 'center', alignItems: 'center' }}>
        <Logo onClick={() => navigate('/')} />
        {failed ? (
          <>
            <div className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
              This URL does not exist or has expired.
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--ink-3)' }}>
              Shared inboxes disappear after 7 days without webhooks. Ask for a fresh link, or open your own inbox instead.
            </p>
            <span
              className="mono hoverAccent clickable"
              onClick={() => navigate('/')}
              style={{ fontSize: 13, color: 'var(--accent)' }}
            >
              → go to your inbox
            </span>
          </>
        ) : (
          <div className="mono" style={{ fontSize: 13, color: 'var(--muted-2)' }}>opening shared inbox…</div>
        )}
      </div>
    </div>
  );
}
