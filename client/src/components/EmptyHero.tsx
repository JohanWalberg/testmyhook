import { CodeBlock, Prompt } from './CodeBlock';

export function EmptyHero({ slug }: { slug: string | null }) {
  const target = `${window.location.origin}/${slug ?? '…'}`;
  const copyCommand = `curl -X POST ${target} -H "Content-Type: application/json" -d '{"hello":"world"}'`;
  return (
    <div style={{ flex: 1, padding: '96px 88px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
      <div style={{ maxWidth: 660, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          Receiving
        </div>
        <h1
          className="mono"
          style={{ margin: 0, fontSize: 40, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', textWrap: 'pretty' }}
        >
          Send any webhook to your URL.
          <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}> Inspect headers, body and query params the moment they land.</span>
        </h1>
        <div style={{ height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 15, lineHeight: 1.7, color: 'var(--ink-3)', maxWidth: 560 }}>
          <p style={{ margin: 0 }}>
            Point any webhook or callback here to see exactly what a service sends you: Shopify, Slack, Stripe, GitHub, PayPal, Jira, or your own app.
          </p>
          <p style={{ margin: 0 }}>No account. No login. URLs are deleted after 7 days of inactivity.</p>
        </div>
        <div style={{ maxWidth: 560 }}>
          <CodeBlock copyText={copyCommand}>
            <div>
              <Prompt />curl -X POST {target} \
            </div>
            <div style={{ paddingLeft: 20 }}>
              -H <span style={{ color: '#E0A45C' }}>"Content-Type: application/json"</span> \
            </div>
            <div style={{ paddingLeft: 20 }}>
              -d <span style={{ color: '#E0A45C' }}>{`'{"hello":"world"}'`}</span>
            </div>
          </CodeBlock>
        </div>
      </div>
    </div>
  );
}
