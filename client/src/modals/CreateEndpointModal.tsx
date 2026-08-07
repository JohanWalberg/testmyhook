import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { rememberEndpoint } from '../lib/storage';
import { Modal, ModalFooter, Field } from '../components/Modal';
import { pillStyle } from '../components/ui';
import { useToast } from '../components/Toast';

const EXPIRY_OPTIONS = ['15 minutes', '1 hour', '24 hours', '7 days'];

export function CreateEndpointModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('24 hours');
  const [maxRequests, setMaxRequests] = useState('100');
  const [responseStatus, setResponseStatus] = useState('200');
  const [responseBody, setResponseBody] = useState('{"received": true}');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const endpoint = await api.createEndpoint({
        name: name.trim(),
        expiry,
        maxRequests: parseInt(maxRequests, 10) || 100,
        responseStatus: parseInt(responseStatus, 10) || 200,
        responseBody
      });
      rememberEndpoint({ token: endpoint.token, name: endpoint.name, createdAt: endpoint.createdAt });
      toast('Endpoint created');
      onClose();
      navigate(`/inbox/${endpoint.token}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create endpoint');
      setBusy(false);
    }
  };

  return (
    <Modal title="Create webhook endpoint" subtitle="A temporary endpoint, ready in one click." width={560} onClose={onClose}>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Endpoint name" optional>
          <input
            className="tmInput"
            placeholder="Payments sandbox"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
          />
        </Field>
        <Field label="Expiration">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXPIRY_OPTIONS.map(option => (
              <span key={option} style={pillStyle(expiry === option, false)} onClick={() => setExpiry(option)}>
                {option}
              </span>
            ))}
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Field label="Maximum stored requests">
            <input
              className="tmInput mono"
              value={maxRequests}
              onChange={e => setMaxRequests(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
            />
          </Field>
          <Field label="Custom response status">
            <input
              className="tmInput mono"
              value={responseStatus}
              onChange={e => setResponseStatus(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', fontSize: 14 }}
            />
          </Field>
        </div>
        <Field label="Custom response body" optional>
          <textarea
            className="tmInput mono"
            rows={3}
            value={responseBody}
            onChange={e => setResponseBody(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
          />
        </Field>
      </div>
      <ModalFooter note="Defaults work for most cases.">
        <button className="btnSecondary" onClick={onClose} style={{ marginLeft: 'auto', padding: '9px 15px', fontSize: 13.5 }}>
          Cancel
        </button>
        <button className="btnPrimary" onClick={create} disabled={busy} style={{ padding: '9px 17px', fontSize: 13.5, border: 'none' }}>
          {busy ? 'Creating…' : 'Create endpoint'}
        </button>
      </ModalFooter>
    </Modal>
  );
}
