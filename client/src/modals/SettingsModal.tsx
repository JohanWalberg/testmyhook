import { useState } from 'react';
import type { ApiEndpoint } from '../types';
import { api } from '../api';
import { formatSize, parseSize } from '../lib/format';
import { Modal, ModalFooter, Field } from '../components/Modal';
import { Toggle } from '../components/ui';
import { useCopy, useToast } from '../components/Toast';

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface SettingsModalProps {
  endpoint: ApiEndpoint;
  onClose: () => void;
  onSaved: (endpoint: ApiEndpoint) => void;
  onAskDelete: () => void;
}

export function SettingsModal({ endpoint, onClose, onSaved, onAskDelete }: SettingsModalProps) {
  const [name, setName] = useState(endpoint.name);
  const [expires, setExpires] = useState(toLocalInput(endpoint.expiresAt));
  const [maxBody, setMaxBody] = useState(formatSize(endpoint.maxBodySize).replace(/(\d)([A-Z])/, '$1 $2'));
  const [paused, setPaused] = useState(endpoint.paused);
  const [sig, setSig] = useState(endpoint.sigRequired);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const copy = useCopy();

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const expiresAt = new Date(expires).getTime();
      const updated = await api.updateEndpoint(endpoint.token, {
        name,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
        maxBodySize: parseSize(maxBody),
        paused,
        sigRequired: sig
      });
      onSaved(updated);
      toast('Settings saved');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save settings');
      setBusy(false);
    }
  };

  return (
    <Modal title="Endpoint settings" subtitle={`${endpoint.name || 'Untitled endpoint'} · /h/${endpoint.token}`} width={620} onClose={onClose}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Field label="Endpoint name">
            <input className="tmInput" value={name} onChange={e => setName(e.target.value)} placeholder="Payments sandbox" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
          <Field label="Expiration date">
            <input className="tmInput mono" type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
          <Field label="Request retention">
            <input className="tmInput" value="Until 24 h after expiry" disabled title="Captured requests are removed 24 hours after the endpoint expires." style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
          <Field label="Maximum body size">
            <input className="tmInput" value={maxBody} onChange={e => setMaxBody(e.target.value)} placeholder="1 MB" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 15px', border: '1px solid #EFEFF3', borderRadius: 9 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Endpoint status</div>
            <div style={{ fontSize: 12.5, color: '#6B6B7B', marginTop: 2 }}>Paused endpoints will not store incoming requests.</div>
          </div>
          <span onClick={() => setPaused(!paused)} style={{ fontSize: 12.5, fontWeight: 600, color: '#6D4AFF', cursor: 'pointer' }}>
            {paused ? 'Resume receiving' : 'Pause receiving'}
          </span>
        </div>

        <Field label="Secret token">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="tmInput mono"
              readOnly
              value={showSecret ? endpoint.secret : 'whsec_••••••••••••••••'}
              onFocus={() => setShowSecret(true)}
              onBlur={() => setShowSecret(false)}
              style={{ flex: 1, padding: '10px 12px', fontSize: 13 }}
            />
            <button className="btnSecondary" onClick={() => copy(endpoint.secret, 'Secret token copied')} style={{ padding: '9px 14px', fontSize: 13 }}>
              Copy
            </button>
          </div>
        </Field>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 15px', border: '1px solid #EFEFF3', borderRadius: 9 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Request signature validation</div>
            <div style={{ fontSize: 12.5, color: '#6B6B7B', marginTop: 2 }}>Verify the x-webhook-signature header against the secret token.</div>
          </div>
          <Toggle on={sig} onClick={() => setSig(!sig)} />
        </div>

        <div style={{ border: '1px solid #F2D4D4', background: '#FEF6F6', borderRadius: 10, padding: '15px 16px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#B91C1C', marginBottom: 4 }}>Danger zone</div>
          <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, color: '#6B6B7B' }}>
            Delete this endpoint and all captured requests. This action cannot be undone.
          </p>
          <button className="btnDanger" onClick={onAskDelete} style={{ padding: '8px 14px', fontSize: 13 }}>
            Delete endpoint
          </button>
        </div>
      </div>
      <ModalFooter>
        <button className="btnSecondary" onClick={onClose} style={{ padding: '9px 15px', fontSize: 13.5 }}>Cancel</button>
        <button className="btnPrimary" onClick={save} disabled={busy} style={{ padding: '9px 17px', fontSize: 13.5, border: 'none' }}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
