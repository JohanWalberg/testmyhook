import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiEndpoint } from '../types';
import { api, webhookUrl } from '../api';
import { expiryLabel, shortDate, timeOfDay } from '../lib/format';
import { forgetEndpoint, listStoredEndpoints } from '../lib/storage';
import { Logo, pillStyle } from '../components/ui';
import { useToast } from '../components/Toast';
import { CreateEndpointModal } from '../modals/CreateEndpointModal';
import { ConfirmModal } from '../modals/ConfirmModal';

const FILTERS = ['Active', 'Expired', 'All'];

export function History() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[] | null>(null);
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const stored = listStoredEndpoints();
    Promise.all(
      stored.map(entry =>
        api.getEndpoint(entry.token).catch(() => {
          forgetEndpoint(entry.token);
          return null;
        })
      )
    ).then(results => setEndpoints(results.filter((e): e is ApiEndpoint => e !== null)));
  }, []);

  const remove = async (token: string) => {
    try {
      await api.deleteEndpoint(token);
      forgetEndpoint(token);
      setEndpoints(prev => (prev ? prev.filter(e => e.token !== token) : prev));
      toast('Endpoint deleted');
    } catch {
      toast('Could not delete endpoint');
    } finally {
      setConfirmToken(null);
    }
  };

  const visible = (endpoints ?? []).filter(e => {
    if (filter === 'All') return true;
    return filter === 'Expired' ? e.expired : !e.expired;
  });

  return (
    <div>
      <header style={{ background: '#fff', borderBottom: '1px solid #E7E7EC' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ marginRight: 'auto' }}>
            <Logo size={20} onClick={() => navigate('/')} />
          </div>
          <button className="btnPrimary" onClick={() => setShowCreate(true)} style={{ border: 'none', padding: '8px 14px', fontSize: 13.5 }}>
            Create webhook URL
          </button>
        </div>
      </header>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>Endpoints</h1>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: '#6B6B7B' }}>Previous and active endpoints created in this browser.</p>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {FILTERS.map(f => (
            <span key={f} style={pillStyle(filter === f, false)} onClick={() => setFilter(f)}>
              {f}
            </span>
          ))}
        </div>
        {endpoints !== null && visible.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #E7E7EC', borderRadius: 11, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No endpoints yet</div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#6B6B7B' }}>Create a webhook URL to see it listed here.</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(endpoint => (
            <div key={endpoint.token} style={{ background: '#fff', border: '1px solid #E7E7EC', borderRadius: 11, padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{endpoint.name || 'Untitled endpoint'}</span>
                  <span
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      color: endpoint.expired ? '#6B6B7B' : '#15803D',
                      background: endpoint.expired ? '#F4F4F7' : '#ECFDF3'
                    }}
                  >
                    {endpoint.expired ? 'Expired' : 'Active'}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: 12.5, color: '#6B6B7B', overflowWrap: 'anywhere' }}>{webhookUrl(endpoint.token)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 14, flex: '1 1 320px' }}>
                {[
                  ['Created', shortDate(endpoint.createdAt)],
                  ['Expires', endpoint.expired ? shortDate(endpoint.expiresAt) : expiryLabel(endpoint.expiresAt)],
                  ['Requests', String(endpoint.requestCount)],
                  ['Last received', endpoint.lastReceivedAt ? timeOfDay(endpoint.lastReceivedAt) : '—']
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12.5 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btnSecondary" onClick={() => navigate(`/inbox/${endpoint.token}`)} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 12.5 }}>
                  Open
                </button>
                <button className="btnDangerOutline" onClick={() => setConfirmToken(endpoint.token)} style={{ padding: '7px 12px', fontSize: 12.5 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {showCreate && <CreateEndpointModal onClose={() => setShowCreate(false)} />}
      {confirmToken && (
        <ConfirmModal
          title="Delete endpoint"
          body="Delete this endpoint and all captured requests? This action cannot be undone."
          onConfirm={() => remove(confirmToken)}
          onClose={() => setConfirmToken(null)}
        />
      )}
    </div>
  );
}
