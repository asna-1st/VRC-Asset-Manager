import React from 'react';

const TransferModeModal = ({ open, onClose, onResolve }) => {
  if (!open) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>Add files</h2>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Do you want to copy the selected file(s) into your library, or move them?
          </p>
        </div>
        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="secondary-btn"
            onClick={() => onResolve('copy')}
          >
            Copy
          </button>
          <button
            className="danger-btn"
            onClick={() => onResolve('move')}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModeModal;
