import type { ReactNode } from 'react';

export interface BannerAction {
  label: string;
  onClick: () => void;
}

interface BannerProps {
  title: string;
  body: ReactNode;
  color: string;
  tint: string;
  border: string;
  actions: BannerAction[];
}

export function Banner({ title, body, color, tint, border, actions }: BannerProps) {
  return (
    <div style={{ border: `1px solid ${border}`, background: tint, borderRadius: 10, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      <div style={{ flex: '1 1 320px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#6B6B7B' }}>{body}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map(action => (
          <button key={action.label} className="btnSecondary" onClick={action.onClick} style={{ borderRadius: 7, padding: '7px 12px', fontSize: 13 }}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
