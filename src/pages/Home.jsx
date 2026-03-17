import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  LayoutGrid
} from 'lucide-react';
import api from '../services/api';
import { useView } from '../context/ViewContext';
import ConfirmDialog from '../components/ConfirmDialog';
import AssetGrid from '../components/AssetGrid';
import AssetDetailModal from '../components/AssetDetailModal';
import AssetFormModal from '../components/AssetFormModal';
import TransferModeModal from '../components/TransferModeModal';


const CATEGORIES = ['All', 'Avatar', 'Outfit', 'Accessory', 'Texture', 'Hair', 'Miscellaneous'];
const LIMIT = 24;

// Helper function to convert video URLs to embed format
const getEmbedUrl = (url) => {
  if (!url) return null;

  // YouTube URL patterns
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);

  if (youtubeMatch) {
    const origin = window.location.origin;
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}&widget_referrer=${origin}`;
  }

  // Vimeo URL patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);

  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Return original URL if no conversion needed
  return url;
};

function Home() {
  const { homeState, updateHomeState } = useView();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState(homeState.assets);
  const [currentCategory, setCurrentCategory] = useState(homeState.category);
  const [searchQuery, setSearchQuery] = useState(homeState.search);
  const [searchInput, setSearchInput] = useState(homeState.search);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(homeState.hasMore);
  const [offset, setOffset] = useState(homeState.offset);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [editingAsset, setEditingAsset] = useState(null);
  const [availableAvatars, setAvailableAvatars] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Avatar',
    thumbnail_url: '',
    gallery_urls: [],
    video_url: null,
    booth_link: '',
    nsfw: false,
  });
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    danger: true,
    onConfirm: null
  });
  const [transferPromptOpen, setTransferPromptOpen] = useState(false);
  const transferPendingRef = useRef(null);
  const { invalidateFileManager } = useView();

  const contentRef = useRef(null);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const lastFetchKeyRef = useRef('');

  // Initialize from URL params
  useEffect(() => {
    const category = searchParams.get('category');
    const editId = searchParams.get('edit');

    if (category && CATEGORIES.includes(category)) {
      setCurrentCategory(category);
    }

    if (editId) {
      handleEditFromUrl(editId);
    }
  }, [searchParams]);

  // Fetch assets if empty (initial mount)
  useEffect(() => {
    if (assets.length === 0) {
      console.log('Home: No assets in state, fetching initial set');
      fetchAssets(true);
    } else {
      console.log(`Home: Preserving ${assets.length} assets from context`);
    }
    fetchAvatars();
  }, []);

  // Fetch assets when category or search changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    console.log('Home: Category or Search changed, resetting list');
    fetchAssets(true);
  }, [currentCategory, searchQuery]);

  // Debounce search input to avoid spamming IPC
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput.trim().replace(/\s+/g, ' '));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);


  // Setup infinite scroll
  useEffect(() => {
    setupInfiniteScroll();
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [assets, hasMore, loading]);

  // Listen for open add modal event
  useEffect(() => {
    const handleOpenAddModal = () => {
      console.log('Home: openAddModal event received');
      openAddModal();
    };

    console.log('Home: registering openAddModal listener');
    window.addEventListener('openAddModal', handleOpenAddModal);
    return () => {
      window.removeEventListener('openAddModal', handleOpenAddModal);
    };
  }, []);

  const fetchAvatars = async () => {
    try {
      const data = await api.getTargets();
      setAvailableAvatars(data);
    } catch (err) {
      console.error('Error fetching avatars:', err);
    }
  };

  const fetchAssets = async (reset = false, force = false) => {
    if (fetchInFlightRef.current || (!hasMore && !reset)) {
      return;
    }
    const newOffset = reset ? 0 : offset;

    try {
      const params = {
        limit: LIMIT,
        offset: newOffset,
      };

      if (currentCategory !== 'All') {
        params.category = currentCategory;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const fetchKey = JSON.stringify(params) + `|reset=${reset}`;
      if (!force && fetchKey === lastFetchKeyRef.current) {
        return;
      }
      lastFetchKeyRef.current = fetchKey;

      setLoading(true);
      fetchInFlightRef.current = true;
      console.log('Home: calling api.getAssets with params:', params);
      const data = await api.getAssets(params);
      console.log(`Home: api.getAssets returned ${data.length} items`);

      if (reset) {
        setAssets(data);
        setOffset(data.length);
        updateHomeState({
          assets: data,
          offset: data.length,
          hasMore: data.length === LIMIT,
          category: currentCategory,
          search: searchQuery
        });
      } else {
        const merged = [...assets, ...data];
        const deduped = [];
        const seen = new Set();
        for (const item of merged) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            deduped.push(item);
          }
        }
        const newAssets = deduped;
        const newOffset = offset + data.length;
        setAssets(newAssets);
        setOffset(newOffset);
        updateHomeState({
          assets: newAssets,
          offset: newOffset,
          hasMore: data.length === LIMIT
        });
      }

      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  };

  const setupInfiniteScroll = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          fetchAssets();
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
  };

  const handleEditFromUrl = async (editId) => {
    try {
      const data = await api.getAssets({ limit: 1000 });
      const asset = data.find(a => a.id === parseInt(editId));
      if (asset) {
        openEditModal(asset);
      }
    } catch (err) {
      console.error('Error fetching asset for edit:', err);
    }
  };

  const handleCategoryChange = (category) => {
    setCurrentCategory(category);
    setOffset(0);
    setHasMore(true);
  };

  const handleSearch = useCallback((e) => {
    const value = e.target.value;
    setSearchInput(value);
    setOffset(0);
    setHasMore(true);
  }, []);

  const openAddModal = () => {
    fetchAvatars();
    setEditingAsset(null);
    setFormData({
      name: '',
      category: 'Avatar',
      thumbnail_url: '',
      gallery_urls: [],
      video_url: null,
      booth_link: '',
      nsfw: false,
    });
    setFiles([]);
    setExistingFiles([]);
    setFormErrors([]);
    setShowModal(true);
  };

  const openEditModal = (asset) => {
    fetchAvatars();
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      category: asset.category,
      thumbnail_url: asset.thumbnail_url || '',
      gallery_urls: asset.gallery_urls ? JSON.parse(asset.gallery_urls) : [],
      video_url: asset.video_url || null,
      booth_link: asset.booth_link || '',
      nsfw: !!asset.nsfw,
    });
    const formattedFiles = (asset.files || []).map(f => ({
      ...f,
      links: (f.links || []).map(l => ({
        ...l,
        target_asset_id: (l.target_asset_id === null && l.manual_name) ? 'manual' : l.target_asset_id
      }))
    }));
    setExistingFiles(formattedFiles);
    setFiles([]);
    setShowDetailModal(false);
    setFormErrors([]);
    setShowModal(true);
  };

  const showDetails = (asset) => {
    setSelectedAsset({ ...asset, gallery: [] });
    setCarouselIndex(0);
    setShowDetailModal(true);

    // Auto-fetch metadata if booth link is present
    if (asset.booth_link) {
      handleAutoFetchMetadata(asset);
    }
  };

  const handleAutoFetchMetadata = async (asset) => {
    if (fetchingMetadata) return;
    setFetchingMetadata(true);
    try {
      const data = await api.fetchMetadata(asset.booth_link);
      setSelectedAsset(prev => {
        if (!prev || prev.id !== asset.id) return prev;
        return {
          ...prev,
          gallery: data.images || [],
          video_url: data.video || null
        };
      });
    } catch (err) {
      console.error('Error auto-fetching metadata:', err);
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileAdd = (batchFiles = [], transferMode = 'copy') => {
    if (batchFiles && batchFiles.length > 0) {
      const newEntries = Array.from(batchFiles).map(f => {
        const fileObj = f.file || f;
        const sourcePath = f.path || f.file?.path || null;
        const name = f.name || f.file?.name || (sourcePath ? sourcePath.split(/[\\/]/).pop() : 'Unknown File');

        return {
          file: fileObj,
          name: name,
          transferMode,
          sourcePath: sourcePath,
          avatarLinks: [],
          isResource: false,
          resourceName: '',
        };
      });
      setFiles(prev => [...prev, ...newEntries]);
    } else {
      setFiles(prev => [...prev, {
        file: null,
        transferMode: 'copy',
        sourcePath: null,
        avatarLinks: [],
        isResource: false,
        resourceName: '',
      }]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).map(f => {
      const path = window.electronAPI.getPathForFile(f);
      console.log(`Home: Dropped file captured via webUtils: ${f.name}, path: ${path}`);
      return {
        file: f,
        path: path,
        name: f.name
      };
    });
    if (droppedFiles.length > 0) {
      promptTransferMode(droppedFiles);
    }
  };

  const handleFileChange = (index, file, transferMode = 'copy') => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = {
        ...newFiles[index],
        file,
        name: file.name || file.path?.split(/[\\/]/).pop() || 'Unknown File',
        transferMode,
        sourcePath: file.path || null
      };
      return newFiles;
    });
  };

  const promptTransferMode = (batchFiles, onResolve) => {
    transferPendingRef.current = { batchFiles: Array.from(batchFiles || []), onResolve };
    setTransferPromptOpen(true);
  };

  const handleFileRemove = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAvatarLinkAdd = (fileIndex) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[fileIndex].avatarLinks.push({ targetId: null, manualName: '' });
      return newFiles;
    });
  };

  const handleAvatarLinkChange = (fileIndex, linkIndex, field, value) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[fileIndex].avatarLinks[linkIndex][field] = value;
      return newFiles;
    });
  };

  const handleAvatarLinkRemove = (fileIndex, linkIndex) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[fileIndex].avatarLinks = newFiles[fileIndex].avatarLinks.filter((_, i) => i !== linkIndex);
      return newFiles;
    });
  };

  const handleResourceToggle = (fileIndex, checked) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[fileIndex].isResource = checked;
      if (checked) {
        newFiles[fileIndex].avatarLinks = [];
      }
      return newFiles;
    });
  };

  const handleResourceNameChange = (fileIndex, value) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[fileIndex].resourceName = value;
      return newFiles;
    });
  };

  const handleExistingAvatarLinkAdd = (fileId) => {
    setExistingFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const links = [...(f.links || [])];
      links.push({ target_asset_id: null, manual_name: '' });
      return { ...f, links };
    }));
  };

  const handleExistingAvatarLinkChange = (fileId, linkIndex, field, value) => {
    setExistingFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const links = [...(f.links || [])];
      links[linkIndex] = { ...links[linkIndex], [field]: value };
      return { ...f, links };
    }));
  };

  const handleExistingAvatarLinkRemove = (fileId, linkIndex) => {
    setExistingFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      const links = (f.links || []).filter((_, i) => i !== linkIndex);
      return { ...f, links };
    }));
  };

  const handleExistingResourceToggle = (fileId, checked) => {
    setExistingFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, is_resource: checked ? 1 : 0, links: checked ? [] : f.links };
    }));
  };

  const handleExistingResourceNameChange = (fileId, value) => {
    setExistingFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return { ...f, resource_name: value };
    }));
  };

  const handleDeleteExistingFile = async (fileId) => {
    setConfirmState({
      open: true,
      title: 'Delete file?',
      message: 'This will permanently remove the file from this asset. This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteAssetFile(fileId);
          setExistingFiles(prev => prev.filter(f => f.id !== fileId));
          fetchAssets(true);
        } catch (err) {
          console.error('Error deleting file:', err);
        } finally {
          setConfirmState(prev => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
    return;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = [];
    const trimmedName = formData.name.trim();
    const trimmedCategory = formData.category.trim();

    if (!trimmedName) errors.push('Asset name is required.');
    if (!trimmedCategory) errors.push('Category is required.');

    const hasNewFiles = files.some(f => f.file);
    const hasExistingFiles = existingFiles.length > 0;
    if (!hasNewFiles && !hasExistingFiles) {
      errors.push('Add at least one file before saving.');
    }

    const manualMissing = files.some(f =>
      f.avatarLinks.some(l => l.targetId === 'manual' && !String(l.manualName || '').trim())
    ) || existingFiles.some(f =>
      (f.links || []).some(l => l.target_asset_id === 'manual' && !String(l.manual_name || '').trim())
    );
    if (manualMissing) {
      errors.push('Manual avatar name cannot be empty.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    try {
      const fileAvatars = files.map(f => ({
        avatar_links: f.isResource ? [] : f.avatarLinks.map(link => ({
          target_id: link.targetId ? parseInt(link.targetId) : null,
          manual_name: link.manualName || null,
        })),
        is_resource: f.isResource,
        resource_name: f.resourceName || null,
      }));

      const data = {
        ...formData,
        name: trimmedName,
        category: trimmedCategory,
        files: files.filter(f => f.file).map(f => {
          const p = f.sourcePath || (f.file && f.file.path);
          console.log(`Home: Preparing file for submit: ${f.name}, path: ${p}`);
          return {
            path: p,
            name: f.name || (f.file && f.file.name),
            transferMode: f.transferMode || 'copy'
          };
        }),
        file_avatars: JSON.stringify(fileAvatars),
      };

      if (editingAsset) {
        data.id = editingAsset.id;
        await api.updateAsset(data);
        fetchAvatars();

        // Update metadata for existing files
        for (const file of existingFiles) {
          await api.updateAssetFile({
            id: file.id,
            is_resource: !!file.is_resource,
            resource_name: file.resource_name,
            avatar_links: (file.links || []).map(l => ({
              target_id: l.target_asset_id === 'manual' ? null : (l.target_asset_id ? parseInt(l.target_asset_id) : null),
              manual_name: l.target_asset_id === 'manual' ? l.manual_name : (l.manual_name || null)
            }))
          });
        }
      } else {
        await api.createAsset(data);
        fetchAvatars();
      }

      setShowModal(false);
      invalidateFileManager();
      fetchAssets(true, true);
    } catch (err) {
      setFormErrors([`Error saving asset: ${err.message}`]);
    }
  };

  const handleDelete = async (id) => {
    setConfirmState({
      open: true,
      title: 'Delete asset?',
      message: 'This will permanently delete the asset and its linked files. This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteAsset(id);
          setShowDetailModal(false);
          invalidateFileManager();
          fetchAssets(true, true);
        } catch (err) {
          console.error('Error deleting asset:', err);
        } finally {
          setConfirmState(prev => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
  };

  const handleOpenFile = async (filePath) => {
    try {
      await api.openFile(filePath);
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  const handleFetchMetadata = async () => {
    if (!formData.booth_link || fetchingMetadata) return;
    setFetchingMetadata(true);
    try {
      const data = await api.fetchMetadata(formData.booth_link);
      setFormData(prev => ({
        ...prev,
        thumbnail_url: data.thumbnail_url || prev.thumbnail_url,
        gallery_urls: data.images || [],
        video_url: data.video || null,
        name: data.name || prev.name
      }));
    } catch (err) {
      console.error('Error fetching metadata:', err);
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleRefreshMetadata = null; // Removed in favor of auto-fetching

  return (
    <>
      <header className="content-header">
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search assets..."
            id="asset-search"
            value={searchInput}
            onChange={handleSearch}
          />
        </div>
      </header>

      <div className="content-body" ref={contentRef}>
        <div className="view-header">
          <h2 id="view-title">
            {currentCategory === 'All' ? 'All Assets' : `${currentCategory} Library`}
          </h2>
        </div>

        <AssetGrid 
          assets={assets} 
          loading={loading} 
          onAssetClick={showDetails} 
          sentinelRef={sentinelRef} 
          searchQuery={searchQuery} 
        />

      </div>

      <AssetDetailModal
        show={showDetailModal}
        asset={selectedAsset}
        onClose={() => setShowDetailModal(false)}
        onEdit={openEditModal}
        onDelete={handleDelete}
        fetchingMetadata={fetchingMetadata}
        getEmbedUrl={getEmbedUrl}
        handleOpenFile={handleOpenFile}
      />

      <AssetFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        formData={formData}
        handleFormChange={handleFormChange}
        handleFetchMetadata={handleFetchMetadata}
        fetchingMetadata={fetchingMetadata}
        CATEGORIES={CATEGORIES}
        editingAsset={editingAsset}
        isDragging={isDragging}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        existingFiles={existingFiles}
        handleDeleteExistingFile={handleDeleteExistingFile}
        availableAvatars={availableAvatars}
        handleExistingAvatarLinkChange={handleExistingAvatarLinkChange}
        handleExistingAvatarLinkRemove={handleExistingAvatarLinkRemove}
        handleExistingAvatarLinkAdd={handleExistingAvatarLinkAdd}
        handleExistingResourceToggle={handleExistingResourceToggle}
        handleExistingResourceNameChange={handleExistingResourceNameChange}
        files={files}
        handleFileChange={handleFileChange}
        handleFileRemove={handleFileRemove}
        handleAvatarLinkChange={handleAvatarLinkChange}
        handleAvatarLinkRemove={handleAvatarLinkRemove}
        handleAvatarLinkAdd={handleAvatarLinkAdd}
        handleResourceToggle={handleResourceToggle}
        handleResourceNameChange={handleResourceNameChange}
        handleFileAdd={handleFileAdd}
        formErrors={formErrors}
        promptTransferMode={promptTransferMode}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText="Cancel"
        danger={confirmState.danger}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false, onConfirm: null }))}
        onConfirm={() => confirmState.onConfirm && confirmState.onConfirm()}
      />

      <TransferModeModal 
        open={transferPromptOpen}
        onClose={() => setTransferPromptOpen(false)}
        onResolve={(mode) => {
          const pending = transferPendingRef.current;
          setTransferPromptOpen(false);
          if (pending?.onResolve) {
            pending.onResolve(mode);
          } else if (pending?.batchFiles?.length) {
            handleFileAdd(pending.batchFiles, mode);
          }
          transferPendingRef.current = null;
        }}
      />
    </>
  );
}


export default Home;
