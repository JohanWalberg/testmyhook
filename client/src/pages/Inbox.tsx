import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ApiEndpoint, ApiRequest, RejectedNotice } from '../types';
import { api, webhookUrl } from '../api';
import { expiryLabel, formatSize } from '../lib/format';
import { forgetEndpoint, rememberEndpoint, renameStoredEndpoint } from '../lib/storage';
import { Logo } from '../components/ui';
import { useToast } from '../components/Toast';
import { Banner } from '../components/inbox/Banner';
import { WebhookUrlCard } from '../components/inbox/WebhookUrlCard';
import { RequestList } from '../components/inbox/RequestList';
import { RequestInspector } from '../components/inbox/RequestInspector';
import { CreateEndpointModal } from '../modals/CreateEndpointModal';
import { SettingsModal } from '../modals/SettingsModal';
import { ResponseModal } from '../modals/ResponseModal';
import { ReplayModal } from '../modals/ReplayModal';
import { QrModal } from '../modals/QrModal';
import { ConfirmModal } from '../modals/ConfirmModal';

type ModalKind = null | 'create' | 'settings' | 'response' | 'replay' | 'qr' | 'confirm-request' | 'confirm-endpoint';

export function Inbox() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [endpoint, setEndpoint] = useState<ApiEndpoint | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [notice, setNotice] = useState<RejectedNotice | null>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const [, setTick] = useState(0);
  const newTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isMobile = width < 860;
  const url = webhookUrl(token);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setEndpoint(null);
    setNotFound(false);
    setRequests([]);
    setSelectedId(null);
    Promise.all([api.getEndpoint(token), api.listRequests(token)])
      .then(([ep, reqs]) => {
        if (cancelled) return;
        setEndpoint(ep);
        setRequests(reqs);
        setSelectedId(reqs[0]?.id ?? null);
        rememberEndpoint({ token: ep.token, name: ep.name, createdAt: ep.createdAt });
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Realtime stream
  useEffect(() => {
    if (!endpoint) return;
    const source = new EventSource(`/api/endpoints/${token}/stream`);
    source.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'request') {
          const incoming = { ...(data.request as ApiRequest), isNew: true };
          setRequests(prev => {
            if (prev.some(r => r.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
          setSelectedId(prev => prev ?? incoming.id);
          const timer = setTimeout(() => {
            setRequests(prev => prev.map(r => (r.id === incoming.id ? { ...r, isNew: false } : r)));
          }, 4000);
          newTimers.current.push(timer);
        } else if (data.type === 'rejected') {
          if (data.reason === 'too_large') setNotice({ type: 'too_large', limit: Number(data.limit) });
          if (data.reason === 'rate_limit') setNotice({ type: 'rate_limit', limit: Number(data.limit) });
        } else if (data.type === 'endpoint') {
          setEndpoint(data.endpoint as ApiEndpoint);
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => {
      source.close();
      newTimers.current.forEach(clearTimeout);
      newTimers.current = [];
    };
  }, [endpoint?.token, token]);

  // Responsive + expiry countdown refresh
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(timer);
    };
  }, []);

  const selected = useMemo(() => requests.find(r => r.id === selectedId) ?? null, [requests, selectedId]);

  const selectRequest = useCallback((id: number) => {
    setSelectedId(id);
    setMobileDetail(true);
    setRequests(prev => prev.map(r => (r.id === id ? { ...r, isNew: false } : r)));
  }, []);

  const clearAll = async () => {
    try {
      await api.clearRequests(token);
      setRequests([]);
      setSelectedId(null);
      setMobileDetail(false);
      toast('Requests cleared');
    } catch {
      toast('Could not clear requests');
    }
  };

  const togglePause = async () => {
    if (!endpoint) return;
    try {
      const updated = await api.updateEndpoint(token, { paused: !endpoint.paused });
      setEndpoint(updated);
      toast(updated.paused ? 'Endpoint paused' : 'Receiving resumed');
    } catch {
      toast('Could not update endpoint');
    }
  };

  const regenerate = async () => {
    try {
      const updated = await api.regenerate(token);
      renameStoredEndpoint(token, { token: updated.token, name: updated.name });
      toast('New callback URL generated');
      navigate(`/inbox/${updated.token}`, { replace: true });
    } catch {
      toast('Could not regenerate URL');
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    try {
      await api.deleteRequest(token, selected.id);
      setRequests(prev => {
        const left = prev.filter(r => r.id !== selected.id);
        setSelectedId(left[0]?.id ?? null);
        return left;
      });
      setModal(null);
      toast('Request deleted');
    } catch {
      toast('Could not delete request');
    }
  };

  const deleteEndpoint = async () => {
    try {
      await api.deleteEndpoint(token);
      forgetEndpoint(token);
      setModal(null);
      toast('Endpoint deleted');
      navigate('/history');
    } catch {
      toast('Could not delete endpoint');
    }
  };

  const duplicateSettings = async () => {
    if (!endpoint) return;
    try {
      const created = await api.createEndpoint({
        name: endpoint.name,
        expiry: '24 hours',
        maxRequests: endpoint.maxRequests,
        responseStatus: endpoint.responseStatus,
        responseBody: endpoint.responseBody
      });
      rememberEndpoint({ token: created.token, name: created.name, createdAt: created.createdAt });
      toast('Endpoint created');
      navigate(`/inbox/${created.token}`);
    } catch {
      toast('Could not create endpoint');
    }
  };

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Logo />
        <div style={{ fontSize: 17, fontWeight: 600 }}>This endpoint does not exist or has been deleted.</div>
        <p style={{ margin: 0, fontSize: 14, color: '#6B6B7B' }}>Endpoints expire automatically and are removed together with their requests.</p>
        <button className="btnPrimary" onClick={() => setModal('create')} style={{ padding: '10px 18px', fontSize: 14 }}>
          Create a new endpoint
        </button>
        {modal === 'create' && <CreateEndpointModal onClose={() => setModal(null)} />}
      </div>
    );
  }

  if (!endpoint) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9A9AAB', fontSize: 14 }}>Loading…</div>;
  }

  const statusLabel = endpoint.expired ? 'Expired' : endpoint.paused ? 'Paused' : 'Active';
  const statusStyles = endpoint.expired
    ? { color: '#DC2626', tint: '#FEF2F2', border: '#F2D4D4' }
    : endpoint.paused
      ? { color: '#C2410C', tint: '#FFF4EC', border: '#F6DCC8' }
      : { color: '#15803D', tint: '#ECFDF3', border: '#CFF0DC' };

  const showList = !isMobile || !mobileDetail;
  const showDetail = !isMobile || mobileDetail;

  return (
    <div>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid #E7E7EC' }}>
        <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Logo size={20} onClick={() => navigate('/')} />
          <div style={{ width: 1, height: 20, background: '#E7E7EC' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{endpoint.name || 'Untitled endpoint'}</span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              padding: '3px 9px', borderRadius: 999,
              border: `1px solid ${statusStyles.border}`, background: statusStyles.tint, color: statusStyles.color
            }}
          >
            {statusLabel}
          </span>
          <span className="mono" style={{ fontSize: 12.5, color: '#9A9AAB' }}>{expiryLabel(endpoint.expiresAt)}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 13.5, color: '#6B6B7B' }}>
            <span className="linkMuted" onClick={() => setModal('settings')}>Settings</span>
            <span className="linkMuted" onClick={() => navigate('/')}>Documentation</span>
            <span className="linkMuted" onClick={() => navigate('/history')}>History</span>
          </div>
        </div>
      </header>

      <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {endpoint.expired ? (
          <Banner
            title="This webhook endpoint has expired."
            body="Captured requests remain available until the retention window ends."
            color="#DC2626" tint="#FEF6F6" border="#F2D4D4"
            actions={[
              { label: 'Create a new endpoint', onClick: () => setModal('create') },
              { label: 'Duplicate settings', onClick: duplicateSettings }
            ]}
          />
        ) : endpoint.paused ? (
          <Banner
            title="This endpoint is currently paused."
            body="Incoming requests will not be stored while the endpoint is paused."
            color="#C2410C" tint="#FDF7F2" border="#F6DCC8"
            actions={[{ label: 'Resume receiving', onClick: togglePause }]}
          />
        ) : notice ? (
          <Banner
            title={notice.type === 'too_large' ? 'Request too large.' : 'Rate limit reached.'}
            body={
              notice.type === 'too_large'
                ? `A request exceeded the ${formatSize(notice.limit)} body limit and was rejected with 413 Payload Too Large.`
                : `${notice.limit} requests per minute exceeded. Further requests are rejected with 429 until the window resets.`
            }
            color="#DC2626" tint="#FEF6F6" border="#F2D4D4"
            actions={[
              ...(notice.type === 'too_large' ? [{ label: 'Increase body size', onClick: () => setModal('settings') }] : []),
              { label: 'Dismiss', onClick: () => setNotice(null) }
            ]}
          />
        ) : null}

        <WebhookUrlCard
          endpoint={endpoint}
          url={url}
          requestCount={requests.length}
          onRegenerate={regenerate}
          onOpenQr={() => setModal('qr')}
          onOpenSettings={() => setModal('settings')}
          onClearAll={clearAll}
          onTogglePause={togglePause}
        />

        <section style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {showList && (
            <div style={{ flex: `0 0 ${isMobile ? '100%' : '340px'}`, width: isMobile ? '100%' : 340, maxWidth: '100%', background: '#fff', border: '1px solid #E7E7EC', borderRadius: 12, overflow: 'hidden' }}>
              <RequestList
                requests={requests}
                selectedId={selectedId}
                search={search}
                filter={filter}
                autoScroll={autoScroll}
                onSearch={setSearch}
                onFilter={setFilter}
                onToggleAutoScroll={() => setAutoScroll(v => !v)}
                onSelect={selectRequest}
                onClearAll={clearAll}
              />
            </div>
          )}

          {showDetail && (
            <div style={{ flex: '1 1 420px', minWidth: 0, background: '#fff', border: '1px solid #E7E7EC', borderRadius: 12, overflow: 'hidden' }}>
              {selected ? (
                <RequestInspector
                  endpoint={endpoint}
                  request={selected}
                  isMobile={isMobile}
                  onBackToList={() => setMobileDetail(false)}
                  onOpenReplay={() => setModal('replay')}
                  onOpenResponseSettings={() => setModal('response')}
                  onAskDelete={() => setModal('confirm-request')}
                />
              ) : (
                <div style={{ padding: '72px 30px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Waiting for your first webhook</div>
                  <p style={{ margin: '0 auto 20px', maxWidth: '34em', fontSize: 14, lineHeight: 1.6, color: '#6B6B7B' }}>
                    Send a request to your callback URL. It will appear here instantly.
                  </p>
                  <div className="mono" style={{ maxWidth: 520, margin: '0 auto', border: '1px solid #E7E7EC', borderRadius: 9, background: '#FCFCFD', padding: '12px 14px', textAlign: 'left', fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto' }}>
                    {`curl -X POST ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"payment.completed"}'`}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {modal === 'create' && <CreateEndpointModal onClose={() => setModal(null)} />}
      {modal === 'settings' && (
        <SettingsModal
          endpoint={endpoint}
          onClose={() => setModal(null)}
          onSaved={updated => {
            setEndpoint(updated);
            renameStoredEndpoint(token, { name: updated.name });
          }}
          onAskDelete={() => setModal('confirm-endpoint')}
        />
      )}
      {modal === 'response' && <ResponseModal endpoint={endpoint} onClose={() => setModal(null)} onSaved={setEndpoint} />}
      {modal === 'replay' && selected && <ReplayModal token={token} request={selected} onClose={() => setModal(null)} />}
      {modal === 'qr' && <QrModal url={url} onClose={() => setModal(null)} />}
      {modal === 'confirm-request' && (
        <ConfirmModal
          title="Delete request"
          body="Delete this request? This action cannot be undone."
          onConfirm={deleteSelected}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'confirm-endpoint' && (
        <ConfirmModal
          title="Delete endpoint"
          body="Delete this endpoint and all captured requests? This action cannot be undone."
          onConfirm={deleteEndpoint}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
