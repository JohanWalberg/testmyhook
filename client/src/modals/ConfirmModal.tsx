import { Modal, ModalFooter } from '../components/Modal';

interface ConfirmModalProps {
  title: string;
  body: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ title, body, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal title={title} width={440} onClose={onClose}>
      <div style={{ padding: 22, fontSize: 14, lineHeight: 1.6, color: '#6B6B7B' }}>{body}</div>
      <ModalFooter>
        <button className="btnSecondary" onClick={onClose} style={{ padding: '9px 15px', fontSize: 13.5 }}>Cancel</button>
        <button className="btnDanger" onClick={onConfirm} style={{ padding: '9px 17px', fontSize: 13.5 }}>Delete</button>
      </ModalFooter>
    </Modal>
  );
}
