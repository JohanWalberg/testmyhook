import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { CodeBlock, Prompt } from '../components/CodeBlock';
import { loadSlugs } from '../lib/storage';

const STEPS = [
  {
    n: 'STEP 01',
    title: 'Copy your URL',
    body: 'Every URL gets its own random slug. Open as many as you need and switch between them with tabs.'
  },
  {
    n: 'STEP 02',
    title: 'Send a request',
    body: 'Webhooks arrive as POST, but any method works. Requests appear in the sidebar within a second.'
  },
  {
    n: 'STEP 03',
    title: 'Inspect and reply',
    body: 'Read headers, body and query params. Set the status code and body we send back to the sender.'
  }
];

const FACTS = [
  { label: 'Retention', body: 'URLs are deleted after 7 days of inactivity.' },
  { label: 'Limits', body: '500 webhooks kept per URL · 10 MB body max.' },
  { label: 'Accounts', body: 'None. The site is open to everyone.' }
];

export function Docs() {
  const navigate = useNavigate();
  // Show the visitor's own URL in the examples when they have one.
  const slug = loadSlugs()[0] ?? 'tiny-snow-k4d92h';
  const target = `${window.location.origin}/${slug}/orders`;
  return (
    <div style={{ minHeight: '100%', background: 'var(--main-bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1264, margin: '0 auto', padding: '64px 88px 72px', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
          <Logo onClick={() => navigate('/')} />
          <h2 className="mono" style={{ margin: 0, fontSize: 32, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            How to use
          </h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--ink-3)' }}>
            Open the site and you already have a live URL. Use it to see what a service sends before you build the real receiver on your own site.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {STEPS.map(step => (
            <div key={step.n} style={{ display: 'flex', flexDirection: 'column', gap: 11, borderTop: '2px solid var(--ink)', paddingTop: 16 }}>
              <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.14em', color: 'var(--accent)' }}>{step.n}</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{step.title}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--ink-3)' }}>{step.body}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28 }}>
          <CodeBlock label="CURL" copyText={`curl -X POST ${target} -d '{"hello":"world"}'`}>
            <div><Prompt />curl -X POST \</div>
            <div style={{ paddingLeft: 20 }}>{target} \</div>
            <div style={{ paddingLeft: 20 }}>-d <span style={{ color: '#E0A45C' }}>{`'{"hello":"world"}'`}</span></div>
          </CodeBlock>
          <CodeBlock label="JAVASCRIPT" copyText={`await fetch("${target}", { method: "POST", body: JSON.stringify({ hello: "world" }) })`}>
            <div><span style={{ color: '#B58FD6' }}>await</span> fetch(<span style={{ color: '#E0A45C' }}>"{window.location.origin}</span></div>
            <div style={{ paddingLeft: 20 }}><span style={{ color: '#E0A45C' }}>/{slug}/orders"</span>, {'{'}</div>
            <div style={{ paddingLeft: 20 }}>method: <span style={{ color: '#E0A45C' }}>"POST"</span>, body: json</div>
            <div>{'})'}</div>
          </CodeBlock>
        </div>

        <div style={{ display: 'flex', gap: 56, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {FACTS.map(fact => (
            <div key={fact.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 20 }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{fact.label}</div>
              <div style={{ fontSize: 15, color: 'var(--ink-2)' }}>{fact.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
