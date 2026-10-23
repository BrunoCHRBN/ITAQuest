import { AlertCircle, CheckCircle2, CircleHelp, X } from 'lucide-react';
import type { Notice } from '../../types';

interface NoticeToastProps {
  notice: Notice;
  onClose: () => void;
}

export function NoticeToast({ notice, onClose }: NoticeToastProps) {
  return (
    <div className={`toast toast-${notice.type}`} role="status">
      <span className="toast-icon">
        {notice.type === 'success' ? (
          <CheckCircle2 size={17} />
        ) : notice.type === 'error' ? (
          <AlertCircle size={17} />
        ) : (
          <CircleHelp size={17} />
        )}
      </span>
      <span>{notice.text}</span>
      <button className="toast-close" onClick={onClose} aria-label="Fechar notificação">
        <X size={15} />
      </button>
    </div>
  );
}
