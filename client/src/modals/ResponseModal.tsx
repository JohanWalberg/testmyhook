import { useState } from 'react';
import type { ApiEndpoint } from '../types';
import { api } from '../api';
import { statusFull } from '../lib/format';
import { Modal, ModalFooter, Field } from '../components/Modal';
import { pillStyle } from '../components/ui';
import { useToast } from '../components/Toast';

const PRESETS = ['200 OK', '201 Created', '204 No Content', '400 Bad Request', '401 Unauthorized', '404 Not Found', '500 Internal Server Error'];

interface ResponseModalProps {
  endpoint: ApiEndpoint;
  onClose: () => void;
  onSaved: (endpoint: ApiEndpoint) => void;
}

export function ResponseModal({ endpoint, onClose, onSaved }: ResponseModalProps) {
  const [status, setStatus] = useState(String(endpoint.responseStatus));
  const [contentType, setContentType] = useState(endpoint.responseContentType);
  const [delay, setDelay] = useState(String(endpoint.responseDelayMs));
  const [body, setBody] = useState(endpoint.responseBody);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.updateEndpoint(endpoint.token, {
        responseStatus: parseInt(status, 10) || 200,
        responseContentType: contentType,
        responseBody: body,
        responseDelayMs: parseInt(delay, 10) || 0
      });
      onSaved(updated);
      toast('Custom response saved');
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save response');
      setBusy(false);
    }
  };

  return (
    <Modal title="Custom response" subtitle="Control what TestMyHook returns to the sender." width={620} onClose={onClose}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Presets">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(preset => (
              <span key={preset} style={pillStyle(preset.startsWith(status + ' '))} onClick={() => setStatus(preset.split(' ')[0])}>
                {preset}
              </span>
            ))}
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Field label="HTTP response status">
            <input className="tmInput mono" value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
          <Field label="Response content type">
            <input className="tmInput mono" value={contentType} onChange={e => setContentType(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
          <Field label="Artificial delay" optional>
            <input className="tmInput mono" value={delay} onChange={e => setDelay(e.target.value)} placeholder="0 ms" style={{ width: '100%', padding: '10px 12px', fontSize: 14 }} />
          </Field>
        </div>
        <Field label="Response body">
          <textarea className="tmInput mono" rows={4} value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: 13, lineHeight: 1.7, resize: 'vertical' }} />
        </Field>
        <Field label="Custom response headers">
          <div style={{ border: '1px solid #EFEFF3', borderRadius: 9, overflow: 'hidden' }}>
            <div className="mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '10px 14px', borderBottom: '1px solid #F5F5F8', fontSize: 12.5 }}>
              <span style={{ color: '#6B6B7B' }}>x-testmyhook-id</span>
              <span>{endpoint.token}</span>
            </div>
            <div className="mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '10px 14px', fontSize: 12.5 }}>
              <span style={{ color: '#6B6B7B' }}>cache-control</span>
              <span>no-store</span>
            </div>
          </div>
        </Field>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A9AAB', marginBottom: 8 }}>Preview</div>
          <div style={{ border: '1px solid #E7E7EC', borderRadius: 9, background: '#FCFCFD', overflow: 'hidden' }}>
            <div className="mono" style={{ padding: '10px 14px', borderBottom: '1px solid #F1F1F5', fontSize: 12.5 }}>
              HTTP/1.1 {statusFull(parseInt(status, 10) || 200)}
            </div>
            <div className="mono" style={{ padding: '12px 14px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body}</div>
          </div>
        </div>
      </div>
      <ModalFooter>
        <button className="btnSecondary" onClick={onClose} style={{ padding: '9px 15px', fontSize: 13.5 }}>Cancel</button>
        <button className="btnPrimary" onClick={save} disabled={busy} style={{ padding: '9px 17px', fontSize: 13.5, border: 'none' }}>
          {busy ? 'Saving…' : 'Save response'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
