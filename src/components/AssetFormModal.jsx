import React from 'react';
import { X, RefreshCw, UploadCloud, Trash2, FileText as FileIcon, Plus } from 'lucide-react';

const AssetFormModal = ({
  show,
  onClose,
  onSubmit,
  formData,
  handleFormChange,
  handleFetchMetadata,
  fetchingMetadata,
  CATEGORIES,
  editingAsset,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  existingFiles,
  handleDeleteExistingFile,
  availableAvatars,
  handleExistingAvatarLinkChange,
  handleExistingAvatarLinkRemove,
  handleExistingAvatarLinkAdd,
  handleExistingResourceToggle,
  handleExistingResourceNameChange,
  files,
  handleFileChange,
  handleFileRemove,
  handleAvatarLinkChange,
  handleAvatarLinkRemove,
  handleAvatarLinkAdd,
  handleResourceToggle,
  handleResourceNameChange,
  handleFileAdd,
  formErrors,
  promptTransferMode
}) => {
  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content form-modal" onClick={e => e.stopPropagation()}>
        <div className="form-modal-header">
          <button className="close" onClick={onClose}>
            <X size={20} />
          </button>
          <h2 id="modal-title" style={{ margin: 0 }}>
            {editingAsset ? 'Edit Asset' : 'Add Asset'}
          </h2>
        </div>

        <div className="form-modal-body">
          {formErrors.length > 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '1.5rem 2.5rem 0' }}>
              <div className="setup-error">
                {formErrors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </div>
          )}
          <div className="form-sidebar">
            <span className="section-label">General Info</span>

            <div className="form-group">
              <label htmlFor="name">Asset Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                required
                placeholder=""
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                required
              >
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="booth_link">Booth.pm Link</label>
              <input
                type="url"
                id="booth_link"
                name="booth_link"
                value={formData.booth_link}
                onChange={handleFormChange}
                onBlur={handleFetchMetadata}
                placeholder=""
              />
            </div>

            <div className="form-group">
              <label htmlFor="thumbnail_url">Thumbnail URL</label>
              <input
                type="url"
                id="thumbnail_url"
                name="thumbnail_url"
                value={formData.thumbnail_url}
                onChange={handleFormChange}
                placeholder=""
              />
              {fetchingMetadata && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                  <RefreshCw size={12} className="spinning" style={{ marginRight: '6px' }} />
                  Fetching gallery links...
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="nsfw">Content Rating</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  id="nsfw"
                  name="nsfw"
                  checked={!!formData.nsfw}
                  onChange={handleFormChange}
                />
                Mark as NSFW / R18 (blur in lists)
              </label>
            </div>

            {formData.thumbnail_url && (
              <div id="thumb-preview">
                <img
                  id="preview-img"
                  src={formData.thumbnail_url}
                  alt="Preview"
                />
              </div>
            )}
          </div>

          <div
            className="form-main"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`drop-zone ${isDragging ? 'active' : ''}`}>
              <UploadCloud className="drop-zone-icon" />
              <div>
                <h3>Quick Drop</h3>
                <p>Drag & drop multiple files here to upload instantly</p>
              </div>
            </div>

            <span className="section-label">Files & Associations</span>

            {/* Existing Files */}
            {existingFiles.length > 0 && (
              <div style={{ marginBottom: '2.5rem' }}>
                <div className="existing-file-list">
                  {existingFiles.map(file => (
                    <div key={file.id} className="asset-file-item-modern existing">
                      <div className="file-header">
                        <span className="file-name">
                          {file.file_path.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDeleteExistingFile(file.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {(!file.is_resource && formData.category !== 'Avatar') && (
                        <div className="association-grid">
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                            Avatar Links
                          </label>
                          {(file.links || []).map((link, linkIndex) => (
                            <div key={linkIndex} style={{ display: 'flex', gap: '0.5rem' }}>
                              <select
                                className="glass-select"
                                value={link.target_asset_id || ''}
                                onChange={(e) => handleExistingAvatarLinkChange(file.id, linkIndex, 'target_asset_id', e.target.value)}
                              >
                                <option value="">-- Select Avatar --</option>
                                {availableAvatars.map(av => (
                                  <option key={av.id} value={av.id}>👤 {av.name}</option>
                                ))}
                                <option value="manual">Enter Name Manually...</option>
                              </select>
                              {link.target_asset_id === 'manual' && (
                                <input
                                  type="text"
                                  className="glass-input"
                                  placeholder="Avatar Name"
                                  value={link.manual_name || ''}
                                  onChange={(e) => handleExistingAvatarLinkChange(file.id, linkIndex, 'manual_name', e.target.value)}
                                  style={{ height: '38px' }}
                                />
                              )}
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleExistingAvatarLinkRemove(file.id, linkIndex)}
                                style={{ width: '32px', height: '32px' }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="secondary-btn small"
                            onClick={() => handleExistingAvatarLinkAdd(file.id)}
                            style={{ alignSelf: 'flex-start' }}
                          >
                            + Add Link
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!file.is_resource}
                            onChange={(e) => handleExistingResourceToggle(file.id, e.target.checked)}
                          />
                          Resource
                        </label>
                        {!!file.is_resource && (
                          <input
                            type="text"
                            className="glass-input"
                            placeholder="Sub Name (e.g. Mat, VRC)"
                            value={file.resource_name || ''}
                            onChange={(e) => handleExistingResourceNameChange(file.id, e.target.value)}
                            style={{ flex: 1, height: '38px' }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Files */}
            <div id="file-list">
              {files.map((fileData, fileIndex) => (
                <div key={fileIndex} className="asset-file-item-modern">
                  <div className="file-header">
                    <div style={{ flex: 1, display: 'flex', gap: '0.8rem', alignItems: 'center', overflow: 'hidden' }}>
                      <button
                        type="button"
                        className="secondary-btn small"
                        onClick={async () => {
                          const selected = await window.electronAPI.selectFile();
                          if (selected) {
                            promptTransferMode([selected], (mode) => handleFileChange(fileIndex, selected, mode));
                          }
                        }}
                      >
                        <FileIcon size={14} /> {fileData.file ? 'Change' : 'Select'}
                      </button>
                      <span className="file-name" style={{
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}>
                        {fileData.name || fileData.file?.name || (fileData.file?.path ? fileData.file.path.split(/[\\/]/).pop() : 'No file selected')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleFileRemove(fileIndex)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {(!fileData.isResource && formData.category !== 'Avatar') && (
                    <div className="association-grid">
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        Avatar Links
                      </label>
                      {fileData.avatarLinks.map((link, linkIndex) => (
                        <div key={linkIndex} style={{ display: 'flex', gap: '0.5rem' }}>
                          <select
                            className="glass-select"
                            value={link.targetId || ''}
                            onChange={(e) => handleAvatarLinkChange(fileIndex, linkIndex, 'targetId', e.target.value)}
                          >
                            <option value="">-- Select Avatar --</option>
                            {availableAvatars.map(av => (
                              <option key={av.id} value={av.id}>👤 {av.name}</option>
                            ))}
                            <option value="manual">Enter Name Manually...</option>
                          </select>
                          {link.targetId === 'manual' && (
                            <input
                              type="text"
                              className="glass-input"
                              placeholder="Avatar Name"
                              value={link.manualName}
                              onChange={(e) => handleAvatarLinkChange(fileIndex, linkIndex, 'manualName', e.target.value)}
                              style={{ height: '38px' }}
                            />
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleAvatarLinkRemove(fileIndex, linkIndex)}
                            style={{ width: '32px', height: '32px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="secondary-btn small"
                        onClick={() => handleAvatarLinkAdd(fileIndex)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        + Add Link
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={fileData.isResource}
                        onChange={(e) => handleResourceToggle(fileIndex, e.target.checked)}
                      />
                      Resource
                    </label>
                    {fileData.isResource && (
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="Sub Name (e.g. Mat, VRC)"
                        value={fileData.resourceName}
                        onChange={(e) => handleResourceNameChange(fileIndex, e.target.value)}
                        style={{ flex: 1, height: '38px' }}
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="primary-btn"
                onClick={handleFileAdd}
                style={{
                  width: '100%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--primary)',
                  border: '1px dashed var(--primary)',
                  marginTop: '1rem'
                }}
              >
                <Plus size={18} /> Add Another File
              </button>
            </div>
          </div>
        </div>

        <div className="form-footer">
          <button
            type="submit"
            form="asset-form"
            className="primary-btn"
            style={{ minWidth: '160px' }}
          >
            {editingAsset ? 'Save Changes' : 'Create'}
          </button>
        </div>

        <form id="asset-form" onSubmit={onSubmit} style={{ display: 'none' }}>
        </form>
      </div>
    </div>
  );
};

export default AssetFormModal;
