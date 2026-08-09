import { useEffect, useRef, useState } from 'react';

const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😡', label: 'Angry' },
  { value: 2, emoji: '🤨', label: 'Confused' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '😍', label: 'Love it' }
];

type Phase = 'idle' | 'sending' | 'sent' | 'error';

/** Floating feedback button + popover, present on every page. */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const canSend = phase !== 'sending' && (mood !== null || text.trim() !== '');

  const send = async () => {
    if (!canSend || mood === null) return;
    setPhase('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, text: text.trim(), email: email.trim() })
      });
      if (!res.ok) throw new Error(String(res.status));
      setPhase('sent');
      closeTimer.current = setTimeout(() => {
        setOpen(false);
        setPhase('idle');
        setMood(null);
        setText('');
        setEmail('');
      }, 1600);
    } catch {
      setPhase('error');
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="mono"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', right: 18, bottom: 16, zIndex: 50,
          fontSize: 11.5, letterSpacing: '0.06em', padding: '7px 13px', borderRadius: 999,
          background: 'var(--card)', color: open ? 'var(--accent)' : 'var(--muted)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-strong)'}`,
          boxShadow: 'var(--shadow)', cursor: 'pointer'
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', right: 18, bottom: 58, zIndex: 50,
            width: 340, maxWidth: 'calc(100vw - 36px)',
            background: 'var(--card)', border: '1px solid var(--frame-border)', borderRadius: 11,
            boxShadow: 'var(--pop-shadow)', overflow: 'hidden'
          }}
        >
          <div
            className="mono"
            style={{
              padding: '14px 18px', borderBottom: '1px solid var(--border-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)'
            }}
          >
            <span>Send your feedback</span>
            <span className="hoverInk clickable" onClick={() => setOpen(false)} style={{ fontSize: 14, color: 'var(--muted)', letterSpacing: 0 }}>
              ×
            </span>
          </div>

          {phase === 'sent' ? (
            <div className="mono" style={{ padding: '36px 18px', textAlign: 'center', fontSize: 13, color: 'var(--green)' }}>
              Thanks — feedback sent
            </div>
          ) : (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    title={m.label}
                    aria-label={m.label}
                    style={{
                      fontSize: 22, lineHeight: 1, padding: 7, borderRadius: 8, cursor: 'pointer',
                      background: mood === m.value ? 'var(--card-alt)' : 'transparent',
                      border: `1px solid ${mood === m.value ? 'var(--accent)' : 'transparent'}`,
                      opacity: mood === null || mood === m.value ? 1 : 0.45,
                      transition: 'opacity 120ms'
                    }}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>

              <textarea
                className="popInput"
                rows={4}
                placeholder="Type your feedback or request here… (optional)"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={2000}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Send me a response to <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  className="popInput"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  maxLength={200}
                  style={{ resize: 'none' }}
                />
              </div>

              {phase === 'error' && (
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>
                  Could not send — please try again.
                </div>
              )}

              <button
                className="mono"
                onClick={send}
                disabled={!canSend || mood === null}
                style={{
                  alignSelf: 'flex-end', fontSize: 11.5, letterSpacing: '0.06em',
                  padding: '8px 16px', borderRadius: 7, cursor: canSend && mood !== null ? 'pointer' : 'default',
                  background: mood !== null ? 'var(--accent)' : 'var(--card-alt)',
                  color: mood !== null ? 'var(--accent-contrast)' : 'var(--faint)',
                  border: 'none', opacity: phase === 'sending' ? 0.6 : 1
                }}
              >
                {phase === 'sending' ? 'Sending…' : 'Send →'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
