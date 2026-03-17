import React, { useState, useEffect } from 'react';
import { 
  Search, 
  LayoutGrid, 
  List, 
  File, 
  Image as ImageIcon, 
  Package, 
  Layers, 
  Gamepad, 
  FileText, 
  FolderOpen, 
  Trash2, 
  Folder,
  Eye
} from 'lucide-react';
import api from '../services/api';
import { useView } from '../context/ViewContext';
import '../styles/filemanager.css';
import ConfirmDialog from '../components/ConfirmDialog';

function FileManager() {
  const { fileManagerState, updateFileManagerState } = useView();
  const [files, setFiles] = useState(fileManagerState.files);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    danger: true,
    onConfirm: null
  });
  const [viewMode, setViewMode] = useState(fileManagerState.viewMode); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState(fileManagerState.sortBy); // 'name', 'date', 'size', 'category'
  const [filterCategory, setFilterCategory] = useState(fileManagerState.filterCategory);
  const [searchQuery, setSearchQuery] = useState(fileManagerState.searchQuery);

  const CATEGORIES = ['All', 'Avatar', 'Outfit', 'Accessory', 'Texture', 'Hair'];

  useEffect(() => {
    if (files.length === 0) {
      fetchFiles();
    }
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await api.getFiles();
      const filesList = data.files || [];
      setFiles(filesList);
      updateFileManagerState({ files: filesList });
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (filePath) => {
    setConfirmState({
      open: true,
      title: 'Delete file?',
      message: 'This will permanently remove the file from disk. This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteFile(filePath);
          setFiles(prev => prev.filter(f => f.path !== filePath));
        } catch (err) {
          console.error('Error deleting file:', err);
        } finally {
          setConfirmState(prev => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;
    setConfirmState({
      open: true,
      title: 'Delete selected files?',
      message: `This will permanently remove ${selectedFiles.length} file(s) from disk. This action cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await Promise.all(selectedFiles.map(path => api.deleteFile(path)));
          setFiles(prev => prev.filter(f => !selectedFiles.includes(f.path)));
          setSelectedFiles([]);
        } catch (err) {
          console.error('Error deleting files:', err);
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

  const handleOpenLocation = async (filePath) => {
    try {
      await api.openFileLocation(filePath);
    } catch (err) {
      console.error('Error opening file location:', err);
    }
  };

  const toggleFileSelection = (filePath) => {
    setSelectedFiles(prev => 
      prev.includes(filePath)
        ? prev.filter(p => p !== filePath)
        : [...prev, filePath]
    );
  };

  const selectAll = () => {
    const filteredPaths = filteredFiles.map(f => f.path);
    setSelectedFiles(filteredPaths);
  };

  const deselectAll = () => {
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter and sort files
  const filteredFiles = files
    .filter(file => {
      const matchesCategory = filterCategory === 'All' || file.category === filterCategory;
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.modified) - new Date(a.modified);
        case 'size':
          return b.size - a.size;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="filemanager-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="content-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>File Manager</h1>
          <div className="header-stats" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
            <span className="stat">
              <strong style={{ color: 'var(--primary)' }}>{files.length}</strong> files
            </span>
            <span className="stat">
              <strong style={{ color: 'var(--primary)' }}>{formatFileSize(files.reduce((acc, f) => acc + f.size, 0))}</strong> total
            </span>
          </div>
        </div>
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="content-body">
        <div className="view-header">
          <h2>Library Files</h2>
          <div className="toolbar-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              className="secondary-btn"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '0.5rem 1rem' }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              className="secondary-btn"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '0.5rem 1rem' }}
            >
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
              <option value="size">Sort by Size</option>
              <option value="category">Sort by Category</option>
            </select>

            <div className="view-toggle" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Folder size={48} /></div>
          <div className="empty-state-title">No Files Found</div>
          <div className="empty-state-text">
            {searchQuery || filterCategory !== 'All'
              ? 'Try adjusting your search or filter'
              : 'Upload some files to get started'}
          </div>
        </div>
      ) : (
        <>
          <div className="selection-bar">
            <button className="text-btn" onClick={selectAll}>
              Select All ({filteredFiles.length})
            </button>
            {selectedFiles.length > 0 && (
              <button className="text-btn" onClick={deselectAll}>
                Deselect All
              </button>
            )}
          </div>
          
          <div className={`files-${viewMode}`}>
            {filteredFiles.map(file => (
              <div
                key={file.path}
                className={`file-card ${selectedFiles.includes(file.path) ? 'selected' : ''}`}
                onClick={() => toggleFileSelection(file.path)}
              >
                <div className="file-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file.path)}
                    onChange={() => toggleFileSelection(file.path)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className="file-icon">
                  {file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon size={24} /> :
                   file.name.match(/\.(zip|rar|7z)$/i) ? <Package size={24} /> :
                   file.name.match(/\.(fbx|obj|blend)$/i) ? <Layers size={24} /> :
                   file.name.match(/\.(unitypackage|prefab)$/i) ? <Gamepad size={24} /> : <FileText size={24} />}
                </div>
                
                <div className="file-details">
                  <div className="file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div className="file-meta">
                    <span className="file-category">{file.category}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <span className="file-date">{formatDate(file.modified)}</span>
                  </div>
                </div>
                
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="secondary-btn small"
                    onClick={() => handleOpenFile(file.path)}
                    title="Open File"
                  >
                    <Eye size={14} style={{ marginRight: '6px' }} /> Open
                  </button>
                  <button
                    className="secondary-btn small"
                    onClick={() => handleOpenLocation(file.path)}
                    title="Open Location"
                  >
                    <FolderOpen size={14} style={{ marginRight: '6px' }} /> Folder
                  </button>
                  <button
                    className="danger-btn small"
                    onClick={() => handleDeleteFile(file.path)}
                    title="Delete File"
                  >
                    <Trash2 size={14} style={{ marginRight: '6px' }} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
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
    </>
  );
}

export default FileManager;
