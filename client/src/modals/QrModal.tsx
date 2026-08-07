import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../components/Modal';

export function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 336, margin: 1, color: { dark: '#16161D', light: '#FFFFFF' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url]);

  return (
    <Modal title="QR code" subtitle="Scan to open the callback URL." width={380} onClose={onClose}>
      <div style={{ padding: '26px 22px 24px', textAlign: 'center' }}>
        {dataUrl ? (
          <img src={dataUrl} alt="QR code for the callback URL" style={{ width: 168, height: 168, margin: '0 auto 16px', borderRadius: 10, border: '1px solid #EFEFF3', display: 'block' }} />
        ) : (
          <div style={{ width: 168, height: 168, margin: '0 auto 16px', border: '1px dashed #D8D8E0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9AAB', fontSize: 12.5, background: '#FCFCFD' }}>
            QR code
          </div>
        )}
        <div className="mono" style={{ fontSize: 12.5, color: '#6B6B7B', overflowWrap: 'anywhere' }}>{url}</div>
      </div>
    </Modal>
  );
}
