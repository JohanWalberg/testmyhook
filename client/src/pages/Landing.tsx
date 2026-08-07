import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { rememberEndpoint } from '../lib/storage';
import { Logo } from '../components/ui';
import { useToast } from '../components/Toast';
import { CreateEndpointModal } from '../modals/CreateEndpointModal';

const FEATURES = [
  { title: 'Real-time request updates', desc: 'Requests stream into the inbox as they arrive.' },
  { title: 'All common methods', desc: 'GET, POST, PUT, PATCH and DELETE.' },
  { title: 'Any payload format', desc: 'JSON, form data, XML and plain text.' },
  { title: 'Headers and query parameters', desc: 'Every header and parameter, captured verbatim.' },
  { title: 'Copy as cURL', desc: 'Reproduce any captured request from your terminal.' },
  { title: 'Replay requests', desc: 'Send a captured request to your local server.' },
  { title: 'Custom response', desc: 'Return your own status code, headers and body.' },
  { title: 'Temporary and private URLs', desc: 'Unguessable endpoints, never publicly indexed.' },
  { title: 'Automatic expiration', desc: 'Endpoints and captured requests are deleted on schedule.' }
];

const STEPS = [
  { n: '01', title: 'Create a URL', desc: 'Generate a unique callback endpoint.' },
  { n: '02', title: 'Send a webhook', desc: 'Use the URL in any service, integration or application.' },
  { n: '03', title: 'Inspect the payload', desc: 'View headers, query parameters and request body instantly.' }
];

export function Landing() {
  const [showCreate, setShowCreate] = useState(false);
  const [busyExample, setBusyExample] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const viewExample = async () => {
    if (busyExample) return;
    setBusyExample(true);
    try {
      const endpoint = await api.createEndpoint({ name: 'Example', expiry: '1 hour' });
      rememberEndpoint({ token: endpoint.token, name: endpoint.name, createdAt: endpoint.createdAt });
      await api.sendExample(endpoint.token);
      navigate(`/inbox/${endpoint.token}`);
    } catch {
      toast('Could not create example endpoint');
      setBusyExample(false);
    }
  };

  return (
    <div>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E7E7EC' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ marginRight: 'auto' }}>
            <Logo />
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 14, color: '#6B6B7B' }}>
            <a href="#how-it-works" className="linkMuted" style={{ color: 'inherit', textDecoration: 'none' }}>Documentation</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="linkMuted" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
            <span className="linkMuted" onClick={() => navigate('/history')}>History</span>
          </nav>
          <button className="btnPrimary" onClick={() => setShowCreate(true)} style={{ padding: '9px 15px', fontSize: 14 }}>
            Create webhook URL
          </button>
        </div>
      </header>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '96px 24px 72px', display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center' }}>
        <div style={{ flex: '1 1 380px', minWidth: 300 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px', border: '1px solid #DDD5FF', background: '#F5F2FF', borderRadius: 999, fontSize: 12.5, color: '#5B36F0', fontWeight: 500, marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6D4AFF', display: 'block' }} />
            No account required
          </div>
          <h1 style={{ margin: '0 0 18px', fontSize: 52, lineHeight: 1.06, letterSpacing: '-0.035em', fontWeight: 600, textWrap: 'balance' }}>
            Test, inspect and debug webhooks instantly.
          </h1>
          <p style={{ margin: '0 0 30px', fontSize: 18, lineHeight: 1.55, color: '#6B6B7B', maxWidth: '30em', textWrap: 'pretty' }}>
            Generate a temporary callback URL, send a webhook to it and inspect the full payload in real time.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button className="btnPrimary" onClick={() => setShowCreate(true)} style={{ borderRadius: 9, padding: '13px 22px', fontSize: 15 }}>
              Create webhook URL
            </button>
            <button className="btnSecondary" onClick={viewExample} style={{ borderRadius: 9, padding: '13px 22px', fontSize: 15 }}>
              {busyExample ? 'Preparing example…' : 'View example'}
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 420px', minWidth: 300 }}>
          <div style={{ background: '#fff', border: '1px solid #E7E7EC', borderRadius: 12, boxShadow: '0 12px 40px -18px rgba(22,22,29,0.22)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid #EFEFF3', background: '#FCFCFD' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E4E4EA', display: 'block' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E4E4EA', display: 'block' }} />
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11.5, color: '#9A9AAB' }}>inbox</span>
            </div>
            <div style={{ padding: 14, borderBottom: '1px solid #EFEFF3', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ fontSize: 13, color: '#16161D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                https://testmyhook.dev/h/abc123xyz
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#6B6B7B', border: '1px solid #E7E7EC', borderRadius: 6, padding: '3px 8px' }}>Copy</span>
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #EFEFF3', background: '#FCFCFD' }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: '#15803D', background: '#ECFDF3', border: '1px solid #CFF0DC', borderRadius: 5, padding: '2px 7px' }}>POST</span>
              <span className="mono" style={{ fontSize: 12.5, color: '#6B6B7B' }}>23:42:16</span>
              <span className="mono" style={{ fontSize: 12.5, color: '#9A9AAB' }}>application/json</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#15803D', background: '#ECFDF3', borderRadius: 5, padding: '2px 7px' }}>200 OK</span>
            </div>
            <div className="mono" style={{ padding: '14px 16px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre', overflowX: 'auto' }}>
              <span style={{ color: '#9A9AAB' }}>{'{'}</span>{'\n  '}
              <span style={{ color: '#5B36F0' }}>"id"</span><span style={{ color: '#9A9AAB' }}>: </span><span style={{ color: '#0F766E' }}>"evt_8f31a2"</span><span style={{ color: '#9A9AAB' }}>,</span>{'\n  '}
              <span style={{ color: '#5B36F0' }}>"event"</span><span style={{ color: '#9A9AAB' }}>: </span><span style={{ color: '#0F766E' }}>"payment.completed"</span><span style={{ color: '#9A9AAB' }}>,</span>{'\n  '}
              <span style={{ color: '#5B36F0' }}>"data"</span><span style={{ color: '#9A9AAB' }}>: {'{'}</span>{'\n    '}
              <span style={{ color: '#5B36F0' }}>"amount"</span><span style={{ color: '#9A9AAB' }}>: </span><span style={{ color: '#B45309' }}>1499</span><span style={{ color: '#9A9AAB' }}>,</span>{'\n    '}
              <span style={{ color: '#5B36F0' }}>"currency"</span><span style={{ color: '#9A9AAB' }}>: </span><span style={{ color: '#0F766E' }}>"SEK"</span>{'\n  '}
              <span style={{ color: '#9A9AAB' }}>{'}\n}'}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 88px' }}>
        <h2 style={{ margin: '0 0 26px', fontSize: 13, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9A9AAB' }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {STEPS.map(step => (
            <div key={step.n} style={{ background: '#fff', border: '1px solid #E7E7EC', borderRadius: 12, padding: 24 }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: '#6D4AFF', marginBottom: 14 }}>{step.n}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>{step.title}</h3>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: '#6B6B7B' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ borderTop: '1px solid #E7E7EC', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '72px 24px' }}>
          <h2 style={{ margin: '0 0 30px', fontSize: 13, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9A9AAB' }}>Features</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2, background: '#EFEFF3', border: '1px solid #EFEFF3', borderRadius: 12, overflow: 'hidden' }}>
            {FEATURES.map(feature => (
              <div key={feature.title} style={{ background: '#fff', padding: '22px 24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{feature.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#6B6B7B' }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ background: '#16161D', borderRadius: 14, padding: '44px 40px', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center' }}>
          <div style={{ flex: '1 1 340px' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: '#fff' }}>Ready in one click.</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#A2A2B4' }}>No signup, no configuration. Endpoints expire automatically.</p>
          </div>
          <button className="btnPrimary" onClick={() => setShowCreate(true)} style={{ border: 'none', borderRadius: 9, padding: '13px 22px', fontSize: 15 }}>
            Create webhook URL
          </button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #E7E7EC', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, color: '#9A9AAB' }}>© 2026 TestMyHook</span>
          <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 22, fontSize: 13.5, color: '#6B6B7B' }}>
            <a href="#how-it-works" className="linkMuted" style={{ color: 'inherit', textDecoration: 'none' }}>Documentation</a>
            <span className="linkMuted">Privacy</span>
            <span className="linkMuted">Terms</span>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="linkMuted" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
            <span className="linkMuted">Status</span>
            <span className="linkMuted">Contact</span>
          </div>
        </div>
      </footer>

      {showCreate && <CreateEndpointModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
