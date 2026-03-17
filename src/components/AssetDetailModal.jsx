import React, { useState } from 'react';
import { X, Loader2, ExternalLink, ChevronRight, ChevronLeft, User, Package, Download, FolderOpen, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const AssetDetailModal = ({
  show,
  asset,
  onClose,
  onEdit,
  onDelete,
  fetchingMetadata,
  getEmbedUrl,
  handleOpenFile
}) => {
  const [carouselIndex, setCarouselIndex] = useState(0);

  if (!show || !asset) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
        <div
          className="detail-modal-bg"
          style={{ backgroundImage: `url(${asset.gallery && asset.gallery[carouselIndex] ? asset.gallery[carouselIndex] : (asset.thumbnail_url || 'https://sampleimg.com/600x600?text=No+Image')})` }}
        />
        <button className="close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="detail-left">
          <div className="carousel-container">
            {fetchingMetadata && (!asset.gallery || asset.gallery.length === 0) && (
              <div className="carousel-loader">
                <div className="spinner-glow"></div>
                <Loader2 className="spinning" size={48} />
                <p>Fetching Booth Media...</p>
              </div>
            )}

            {/* Commented out video preview
            {asset.video_url && carouselIndex === (asset.gallery?.length || 0) ? (
              <div className="video-wrapper">
                <iframe
                  title="Asset Video"
                  src={getEmbedUrl(asset.video_url)}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="detail-video"
                />
              </div>
            ) : ( */}
            <img
              src={(asset.gallery && asset.gallery[carouselIndex]) || asset.thumbnail_url || 'https://sampleimg.com/600x600?text=No+Image'}
              className="detail-img"
              alt={`${asset.name} - ${carouselIndex + 1}`}
            />
            {/* )} */}

            {(asset.gallery?.length > 1 /* || asset.video_url */) && (
              <>
                <button
                  className="carousel-control prev"
                  onClick={() => {
                    const total = (asset.gallery?.length || 0) /* + (asset.video_url ? 1 : 0) */;
                    setCarouselIndex(prev => (prev === 0 ? total - 1 : prev - 1));
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  className="carousel-control next"
                  onClick={() => {
                    const total = (asset.gallery?.length || 0) /* + (asset.video_url ? 1 : 0) */;
                    setCarouselIndex(prev => (prev >= total - 1 ? 0 : prev + 1));
                  }}
                >
                  <ChevronRight size={24} />
                </button>

                <div className="carousel-dots">
                  {asset.gallery?.map((_, i) => (
                    <span
                      key={i}
                      className={`dot ${carouselIndex === i ? 'active' : ''}`}
                      onClick={() => setCarouselIndex(i)}
                    />
                  ))}
                  {/* {asset.video_url && (
                    <span
                      className={`dot video-dot ${carouselIndex === (asset.gallery?.length || 0) ? 'active' : ''}`}
                      onClick={() => setCarouselIndex(asset.gallery?.length || 0)}
                    >
                      <Play size={10} />
                    </span>
                  )} */}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="detail-right">
          <div className="detail-header">
            <span className="detail-category">{asset.category}</span>
            <h2>{asset.name}</h2>
            {fetchingMetadata && (
              <span className="fetching-indicator">
                <Loader2 size={14} className="spinning" /> Fetching gallery...
              </span>
            )}
          </div>

          <div className="action-bar">
            {asset.booth_link && (
              <button
                onClick={() => api.openExternal(asset.booth_link)}
                className="primary-btn"
              >
                Visit Booth.pm <ExternalLink size={14} style={{ marginLeft: '6px' }} />
              </button>
            )}
            {asset.category === 'Avatar' && (
              <Link
                to={`/avatar?id=${asset.id}`}
                className="secondary-btn"
              >
                View Assets <ChevronRight size={14} style={{ marginLeft: '4px' }} />
              </Link>
            )}
          </div>

          <div className="detail-section">
            <h3>Associated Files</h3>
            <div className="existing-file-list">
              {asset.files && asset.files.length > 0 ? (
                asset.files.map(file => (
                  <div key={file.id} className="asset-file-item">
                    <div className="file-info">
                      {file.links && file.links.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {file.links.map((link, i) => (
                            <span key={i} className="tag avatar-tag">
                              <User size={10} /> {link.target_name || link.manual_name}
                            </span>
                          ))}
                          {!!file.is_resource && (
                            <span className="tag resource-tag">
                              <Package size={10} /> Resource{file.resource_name ? `: ${file.resource_name}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>
                        {file.file_path.split('/').pop()}
                      </span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="secondary-btn small"
                        onClick={() => api.openFileLocation(file.file_path)}
                        title="Show in Folder"
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        className="secondary-btn small"
                        onClick={() => handleOpenFile(file.file_path)}
                        title="Open File"
                      >
                        <Package size={16} style={{ marginRight: '6px' }} /> OPEN
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No files attached to this asset</p>
              )}
            </div>
          </div>

          <div className="detail-footer">
            <button
              className="secondary-btn"
              onClick={() => onEdit(asset)}
            >
              <Edit2 size={16} style={{ marginRight: '8px' }} /> Edit Information
            </button>
            <button
              className="text-btn danger"
              onClick={() => onDelete(asset.id)}
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} style={{ marginRight: '8px' }} /> Delete Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal;
