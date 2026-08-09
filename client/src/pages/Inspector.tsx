import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiEndpoint, ApiRequest } from '../types';
import { api } from '../api';
import { loadActiveSlug, loadSlugs, saveActiveSlug, saveSlugs, type Theme } from '../lib/storage';
import { usePageMeta } from '../lib/meta';
import { Sidebar } from '../components/Sidebar';
import { EmptyHero } from '../components/EmptyHero';
import { RequestDetail } from '../components/RequestDetail';

interface InspectorProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function Inspector({ theme, onToggleTheme }: InspectorProps) {
  usePageMeta();
  const [slugs, setSlugs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<ApiEndpoint | null>(null);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const [mobileDetail, setMobileDetail] = useState(false);
  const booted = useRef(false);
  const isMobile = width < 700;

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persist = useCallback((nextSlugs: string[], nextActive: string | null) => {
    setSlugs(nextSlugs);
    saveSlugs(nextSlugs);
    if (nextActive) {
      setActive(nextActive);
      saveActiveSlug(nextActive);
    }
  }, []);

  // Boot: validate stored URLs, drop dead ones, ensure at least one exists.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const stored = loadSlugs();
      const alive: string[] = [];
      for (const slug of stored) {
        const ok = await api.getUrl(slug).then(() => true).catch(() => false);
        if (ok) alive.push(slug);
      }
      if (alive.length === 0) {
        try {
          const created = await api.createUrl();
          alive.push(created.slug);
        } catch {
          return;
        }
      }
      const storedActive = loadActiveSlug();
      persist(alive, storedActive && alive.includes(storedActive) ? storedActive : alive[0]);
    })();
  }, [persist]);

  // Load data and keep a realtime stream open for the active URL. The stream
  // auto-reconnects (EventSource default), and every (re)connect refetches the
  // endpoint and request list so a server restart or a tab opened while the
  // server was down heals itself and misses nothing.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setEndpoint(null);
    setRequests([]);
    setSelectedId(null);
    setSearch('');

    const refetch = () => {
      Promise.all([api.getUrl(active), api.listRequests(active)])
        .then(([ep, reqs]) => {
          if (cancelled) return;
          setEndpoint(ep);
          setRequests(reqs);
          setSelectedId(prev => (prev && reqs.some(r => r.id === prev) ? prev : reqs[0]?.id ?? null));
        })
        .catch(() => {});
    };
    refetch();

    const source = new EventSource(`/api/urls/${active}/stream`);
    source.onopen = () => {
      setLive(true);
      refetch();
    };
    source.onerror = () => setLive(false);
    source.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'request') {
          const incoming = data.request as ApiRequest;
          setRequests(prev => (prev.some(r => r.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 500)));
          setSelectedId(prev => prev ?? incoming.id);
        } else if (data.type === 'endpoint') {
          setEndpoint(data.endpoint as ApiEndpoint);
        } else if (data.type === 'request_deleted') {
          setRequests(prev => prev.filter(r => r.id !== data.id));
          setSelectedId(prev => (prev === data.id ? null : prev));
        } else if (data.type === 'requests_cleared') {
          setRequests([]);
          setSelectedId(null);
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      cancelled = true;
      source.close();
      setLive(false);
    };
  }, [active]);

  const addUrl = async () => {
    try {
      const created = await api.createUrl();
      persist([...slugs, created.slug], created.slug);
    } catch {
      // creation rate-limited; ignore
    }
  };

  const closeUrl = async (slug: string) => {
    const remaining = slugs.filter(s => s !== slug);
    if (remaining.length === 0) {
      try {
        const created = await api.createUrl();
        persist([created.slug], created.slug);
      } catch {
        persist([], null);
      }
      return;
    }
    persist(remaining, active === slug ? remaining[0] : active);
  };

  const regenerate = async () => {
    if (!active) return;
    try {
      const updated = await api.regenerate(active);
      persist(slugs.map(s => (s === active ? updated.slug : s)), updated.slug);
    } catch {
      // ignore
    }
  };

  const updateResponse = async (input: { responseStatus?: number; responseBody?: string; responseDelayMs?: number }) => {
    if (!active) return;
    try {
      setEndpoint(await api.updateResponse(active, input));
    } catch {
      // ignore
    }
  };

  const deleteRequest = async (id: number) => {
    if (!active) return;
    try {
      await api.deleteRequest(active, id);
      setRequests(prev => {
        const left = prev.filter(r => r.id !== id);
        setSelectedId(sel => (sel === id ? left[0]?.id ?? null : sel));
        return left;
      });
    } catch {
      // ignore
    }
  };

  const clearRequests = async () => {
    if (!active) return;
    try {
      await api.clearRequests(active);
      setRequests([]);
      setSelectedId(null);
    } catch {
      // ignore
    }
  };

  const deleteUrl = async () => {
    if (!active) return;
    try {
      await api.deleteUrl(active);
    } catch {
      // a dead URL should still disappear from the tabs
    }
    await closeUrl(active);
  };

  const selected = useMemo(() => requests.find(r => r.id === selectedId) ?? null, [requests, selectedId]);

  const showSidebar = !isMobile || !mobileDetail || !selected;
  const showMain = !isMobile || (mobileDetail && !!selected);

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--canvas)', overflow: 'hidden' }}>
      {showSidebar && (
      <Sidebar
        isMobile={isMobile}
        theme={theme}
        onToggleTheme={onToggleTheme}
        slugs={slugs}
        active={active}
        endpoint={endpoint}
        requests={requests}
        selectedId={selectedId}
        search={search}
        live={live}
        onSearch={setSearch}
        onSelect={id => {
          setSelectedId(id);
          setMobileDetail(true);
        }}
        onActivate={slug => persist(slugs, slug)}
        onAdd={addUrl}
        onClose={closeUrl}
        onRegenerate={regenerate}
        onUpdateResponse={updateResponse}
        onClearRequests={clearRequests}
        onDeleteUrl={deleteUrl}
      />
      )}
      {showMain && (
      <main
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: selected
            ? 'var(--main-bg)'
            : 'linear-gradient(180deg, var(--main-grad-top) 0%, var(--canvas) 100%)'
        }}
      >
        {selected && active && endpoint ? (
          <RequestDetail
            request={selected}
            slug={active}
            onDelete={() => deleteRequest(selected.id)}
            onBack={isMobile ? () => setMobileDetail(false) : undefined}
          />
        ) : (
          <EmptyHero slug={active} />
        )}
      </main>
      )}
    </div>
  );
}
