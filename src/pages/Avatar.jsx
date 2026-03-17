import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Package, 
  Box, 
  AlertCircle, 
  Download, 
  FolderOpen,
  LayoutGrid,
  LayoutList
} from 'lucide-react';
import api from '../services/api';
import { useView } from '../context/ViewContext';
import '../styles/avatar.css';

function Avatar() {
  const { avatarStates, updateAvatarState } = useView();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const avatarId = searchParams.get('id');
  
  const savedState = avatarStates[avatarId] || {};
  
  const [avatar, setAvatar] = useState(savedState.avatar || null);
  const [assets, setAssets] = useState(savedState.assets || []);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(savedState.total || 0);
  const [offset, setOffset] = useState(savedState.offset || 0);
  const [hasMore, setHasMore] = useState(savedState.hasMore !== undefined ? savedState.hasMore : true);
  const [viewMode, setViewMode] = useState(savedState.viewMode || 'list');
  const limit = 50;

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Setup infinite scroll
  useEffect(() => {
    setupInfiniteScroll();
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [assets, hasMore, loading]);

  useEffect(() => {
    if (avatarId && assets.length === 0) {
      console.log(`Avatar: No assets for ${avatarId}, fetching initial set`);
      fetchAvatarAssets(true);
    } else if (avatarId) {
      console.log(`Avatar: Preserving ${assets.length} assets for ${avatarId}`);
    }
  }, [avatarId]);

  const fetchAvatarAssets = async (reset = false) => {
    if (!avatarId) return;
    
    setLoading(true);
    const newOffset = reset ? 0 : offset;
    
    try {
      const data = await api.getAvatarAssets(avatarId, {
        limit,
        offset: newOffset,
      });
      
      setAvatar(data.avatar);
      setTotal(data.total);
      
      if (reset) {
        setAssets(data.assets);
        setOffset(data.assets.length);
        updateAvatarState(avatarId, { 
          avatar: data.avatar, 
          assets: data.assets, 
          total: data.total, 
          offset: data.assets.length, 
          hasMore: data.assets.length === limit 
        });
      } else {
        const newAssets = [...assets, ...data.assets];
        const newOffset = offset + data.assets.length;
        setAssets(newAssets);
        setOffset(newOffset);
        updateAvatarState(avatarId, { 
          assets: newAssets, 
          offset: newOffset, 
          hasMore: data.assets.length === limit 
        });
      }
      
      setHasMore(data.assets.length === limit);
    } catch (err) {
      console.error('Error fetching avatar assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupInfiniteScroll = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          fetchAvatarAssets();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchAvatarAssets();
    }
  };

  const handleOpenFile = async (filePath) => {
    try {
      await api.openFile(filePath);
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  if (!avatarId) {
    return (
      <div className="avatar-page">
        <div className="empty-state">
          <div className="empty-state-icon"><User size={48} /></div>
          <div className="empty-state-title">No Avatar Selected</div>
          <div className="empty-state-text">
            Select an avatar from the home page to view linked assets
          </div>
          <Link to="/" className="primary-btn">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading && assets.length === 0) {
    return (
      <div className="avatar-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="avatar-page">
        <div className="empty-state">
          <div className="empty-state-icon"><AlertCircle size={48} color="var(--danger)" /></div>
          <div className="empty-state-title">Avatar Not Found</div>
          <div className="empty-state-text">
            The requested avatar could not be found
          </div>
          <Link to="/" className="primary-btn">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="content-header centered">
        <div className="header-left">
          <button className="secondary-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Back to Library
          </button>
        </div>
        <div className="header-center-title">
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{avatar.name}</h1>
          <span className="category-badge" style={{ marginBottom: 0 }}>{avatar.category}</span>
        </div>
        <div className="header-right-placeholder"></div>
      </header>

      <div className="content-body">
        <div className="view-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ margin: 0 }}>Linked Assets ({total})</h2>
            <div className="view-mode-toggle">
              <button 
                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`} 
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <LayoutList size={18} />
              </button>
              <button 
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`} 
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Box size={48} /></div>
            <div className="empty-state-title">No Linked Assets</div>
            <div className="empty-state-text">
              No assets are currently linked to this avatar
            </div>
          </div>
        ) : (
          <>
            <div className={`assets-list ${viewMode}`}>
              {assets.map(asset => (
                <div key={asset.id} className="linked-asset-card">
                  <div className="asset-header">
                    <img
                      src={asset.thumbnail_url || 'https://sampleimg.com/100x100?text=No+Image'}
                      className="asset-thumbnail"
                      alt={asset.name}
                    />
                    <div className="asset-info">
                      <h3 className="asset-name">{asset.name}</h3>
                      <span className="asset-category">{asset.category}</span>
                      {asset.booth_link && (
                        <a
                          href={asset.booth_link}
                          className="booth-link"
                          onClick={(e) => {
                            e.preventDefault();
                            api.openExternal(e.currentTarget.href);
                          }}
                        >
                          View on Booth.pm
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="asset-files">
                    <h4>Files</h4>
                    {asset.files && asset.files.length > 0 ? (
                      asset.files.map(file => (
                        <div key={file.id} className="file-item">
                          <div className="file-info">
                            <div className="file-tags">
                              {!!(file.links && file.links.length > 0) && file.links.map((link, i) => (
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
                            <span className="file-name">
                              {file.file_path.split('/').pop()}
                            </span>
                          </div>
                          <div className="file-actions">
                            <button
                              className="secondary-btn small"
                              onClick={() => api.openFileLocation(file.file_path)}
                              title="Show in Folder"
                            >
                              <FolderOpen size={16} style={{ marginRight: '6px' }} /> FOLDER
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
                      <p className="text-muted">No files attached</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {loading && (
              <div className="loading-row">
                <div className="loading-spinner"></div>
                <span>Loading more assets...</span>
              </div>
            )}
            
            <div ref={sentinelRef} style={{ height: '20px', width: '100%' }} />
          </>
        )}
      </div>
    </>
  );
}

export default Avatar;