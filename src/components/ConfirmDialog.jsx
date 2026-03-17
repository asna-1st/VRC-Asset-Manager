import React from 'react';
import { AlertTriangle } from 'lucide-react';

function ConfirmDialog({ open, title, message, confirmText, cancelText, onConfirm, onCancel, danger }) {
  if (!open) return null;

  return (
    <div className="modal show" onClick={onCancel}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color={danger ? 'var(--danger)' : 'var(--primary)'} />
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onCancel}>
            {cancelText || 'Cancel'}
          </button>
          <button className={danger ? 'danger-btn' : 'primary-btn'} onClick={onConfirm}>
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
