import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  subtitle?: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, subtitle, width, onClose, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(22,22,29,0.34)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: width,
          boxShadow: '0 24px 60px -20px rgba(22,22,29,0.35)', overflow: 'hidden'
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F1F1F5', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: '#6B6B7B', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <span
            className="closeX"
            onClick={onClose}
            style={{ marginLeft: 'auto', fontSize: 18, color: '#9A9AAB', lineHeight: 1 }}
          >
            ×
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div style={{ padding: '16px 22px', borderTop: '1px solid #F1F1F5', background: '#FCFCFD', display: 'flex', gap: 10, alignItems: 'center', justifyContent: note ? undefined : 'flex-end' }}>
      {note && <span style={{ fontSize: 12.5, color: '#9A9AAB' }}>{note}</span>}
      {children}
    </div>
  );
}

export function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        {label} {optional && <span style={{ color: '#9A9AAB', fontWeight: 400 }}>optional</span>}
      </label>
      {children}
    </div>
  );
}
