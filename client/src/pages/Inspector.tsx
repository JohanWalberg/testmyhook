import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiEndpoint, ApiRequest } from '../types';
import { api } from '../api';
import { loadActiveSlug, loadSlugs, saveActiveSlug, saveSlugs, type Theme } from '../lib/storage';
import { Sidebar } from '../components/Sidebar';
import { EmptyHero } from '../components/EmptyHero';
import { RequestDetail } from '../components/RequestDetail';

interface InspectorProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function Inspector({ theme, onToggleTheme }: InspectorProps) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<ApiEndpoint | null>(null);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(false);
  const booted = useRef(false);

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

  // Load endpoint + requests when the active URL changes.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setEndpoint(null);
    setRequests([]);
    setSelectedId(null);
    setSearch('');
    Promise.all([api.getUrl(active), api.listRequests(active)])
      .then(([ep, reqs]) => {
        if (cancelled) return;
        setEndpoint(ep);
        setRequests(reqs);
        setSelectedId(reqs[0]?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Realtime stream for the active URL.
  useEffect(() => {
    if (!active || !endpoint) return;
    const source = new EventSource(`/api/urls/${active}/stream`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'request') {
          const incoming = data.request as ApiRequest;
          setRequests(prev => (prev.some(r => r.id === incoming.id) ? prev : [incoming, ...prev].slice(0, 100)));
          setSelectedId(prev => prev ?? incoming.id);
        } else if (data.type === 'endpoint') {
          setEndpoint(data.endpoint as ApiEndpoint);
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => {
      source.close();
      setLive(false);
    };
  }, [active, endpoint?.slug]);

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

  const selected = useMemo(() => requests.find(r => r.id === selectedId) ?? null, [requests, selectedId]);

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--canvas)', overflow: 'hidden' }}>
      <Sidebar
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
        onSelect={setSelectedId}
        onActivate={slug => persist(slugs, slug)}
        onAdd={addUrl}
        onClose={closeUrl}
        onRegenerate={regenerate}
        onUpdateResponse={updateResponse}
      />
      <main
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: selected
            ? 'var(--main-bg)'
            : 'linear-gradient(180deg, var(--main-grad-top) 0%, var(--canvas) 100%)'
        }}
      >
        {selected && active && endpoint ? (
          <RequestDetail request={selected} slug={active} endpoint={endpoint} />
        ) : (
          <EmptyHero slug={active} />
        )}
      </main>
    </div>
  );
}
