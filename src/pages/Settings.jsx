import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Folder,
  Moon,
  Sun,
  Palette,
  Info,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Check
} from 'lucide-react';
import api from '../services/api';

const ACCENT_COLORS = [
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Sky', color: '#0ea5e9' },
  { name: 'Violet', color: '#8b5cf6' },
];

const MigrationModal = ({ isOpen, onConfirm, onCancel, targetPath }) => {
  const [mode, setMode] = useState(null); // 'migrate' or 'fresh'
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let unsubscribe;
    if (isProcessing) {
      unsubscribe = api.onMigrationProgress((data) => {
        setProgress(data.progress);
        setStatus(data.status);
      });
    }
    return () => unsubscribe && unsubscribe();
  }, [isProcessing]);

  const handleStart = async (selectedMode) => {
    setMode(selectedMode);
    setIsProcessing(true);
    setProgress(0);
    setStatus('Starting...');
    try {
      await onConfirm(selectedMode);
    } catch (err) {
      console.error('Migration error:', err);
      setStatus('Error: ' + err.message);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal ${isOpen ? 'show' : ''}`}>
      <div className="modal-content migration-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw size={24} className={isProcessing ? "spinning" : ""} />
            <h2 style={{ margin: 0 }}>Change Storage Location</h2>
          </div>
        </div>

        {!isProcessing ? (
          <div className="modal-body">
            <p>You are changing your assets storage to:</p>
            <code className="target-path-badge">{targetPath}</code>

            <div className="migration-options">
              <button
                className="option-card"
                onClick={() => handleStart('migrate')}
              >
                <div className="option-icon"><ChevronRight size={24} /></div>
                <div className="option-details">
                  <h4>Migrate Existing Data</h4>
                  <p>Move all your current assets and database to the new location. Best for keeping your library intact.</p>
                </div>
              </button>

              <button
                className="option-card"
                onClick={() => handleStart('fresh')}
              >
                <div className="option-icon"><RefreshCw size={24} /></div>
                <div className="option-details">
                  <h4>Start Fresh</h4>
                  <p>Reset and start a brand new library in the new location. Current data will NOT be moved.</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-body processing">
            <div className="progress-container">
              <div className="progress-bar-wrapper">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <p className="migration-status">{status}</p>
          </div>
        )}

        <div className="modal-footer">
          {!isProcessing && (
            <button className="secondary-btn" onClick={onCancel}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
};

function Settings() {
  const [config, setConfig] = useState(null);
  const [version, setVersion] = useState({ current: '', latest: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationData, setMigrationData] = useState({ isOpen: false, targetPath: null });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await api.getConfig();
      setConfig(data);

      // Also fetch versions
      const current = await api.getAppVersion();
      const latestData = await api.getLatestVersion();
      setVersion({ current, latest: latestData });
    } catch (err) {
      console.error('Error fetching config/versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const folderPath = await api.selectFolder();
      if (folderPath && folderPath !== config.assetsPath) {
        setMigrationData({ isOpen: true, targetPath: folderPath });
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  const handleConfirmMigration = async (mode) => {
    try {
      await api.changeAssetsLocation(migrationData.targetPath, mode);
      await fetchConfig();
      setMigrationData({ isOpen: false, targetPath: null });
    } catch (err) {
      alert('Migration failed: ' + err.message);
      throw err;
    }
  };

  const updateConfig = async (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setSaving(true);
    try {
      await api.setConfig(newConfig);
      // Apply theme/accent immediately
      if (updates.theme) applyTheme(updates.theme);
      if (updates.accentColor) applyAccent(updates.accentColor);
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  const applyAccent = (color) => {
    document.documentElement.style.setProperty('--primary', color);
    // Rough RGB approximation for glows
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <header className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SettingsIcon size={24} className="text-primary" />
          <h2>Settings</h2>
        </div>
      </header>

      <div className="settings-grid">
        {/* Storage Section */}
        <section className="settings-section" style={{ '--index': 1 }}>
          <div className="section-header">
            <Folder size={18} />
            <span className="section-label" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Storage</span>
          </div>
          <div className="section-content">
            <p className="description">Choose where your asset files and database are stored.</p>
            <div className="folder-selection">
              <div className="path-display">
                <span className="label">Assets Folder</span>
                <code className="path">{config.assetsPath}</code>
              </div>
              <button className="secondary-btn" onClick={handleSelectFolder}>
                Change Folder
              </button>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="settings-section" style={{ '--index': 2 }}>
          <div className="section-header">
            <Palette size={18} />
            <span className="section-label" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Appearance</span>
          </div>
          <div className="section-content">
            <div className="setting-item">
              <div className="setting-info">
                <h3>Color Theme</h3>
                <p>Switch between light and dark modes.</p>
              </div>
              <div className="theme-toggle">
                <button
                  className={`theme-btn ${config.theme === 'light' ? 'active' : ''}`}
                  onClick={() => updateConfig({ theme: 'light' })}
                >
                  <Sun size={18} />
                  <span>Light</span>
                </button>
                <button
                  className={`theme-btn ${config.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => updateConfig({ theme: 'dark' })}
                >
                  <Moon size={18} />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div className="setting-item column">
              <div className="setting-info">
                <h3>Accent Color</h3>
                <p>Personalize your application's primary brand color.</p>
              </div>
              <div className="accent-grid">
                {ACCENT_COLORS.map(ac => (
                  <button
                    key={ac.name}
                    className="accent-circle"
                    style={{ backgroundColor: ac.color }}
                    onClick={() => updateConfig({ accentColor: ac.color })}
                    title={ac.name}
                  >
                    {config.accentColor === ac.color && <Check size={14} color="white" />}
                  </button>
                ))}

                {/* Custom Color Picker */}
                <div className="custom-color-picker">
                  <input
                    type="color"
                    id="custom-accent"
                    value={config.accentColor}
                    onChange={(e) => updateConfig({ accentColor: e.target.value })}
                  />
                  <label htmlFor="custom-accent" className="accent-circle custom">
                    <Check size={14} color="white" style={{ opacity: ACCENT_COLORS.some(ac => ac.color === config.accentColor) ? 0 : 1 }} />
                  </label>
                  <span className="custom-label">Custom</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="settings-section" style={{ '--index': 3 }}>
          <div className="section-header">
            <Info size={18} />
            <span className="section-label" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>About</span>
          </div>
          <div className="section-content">
            <div className="about-branding">
              <div className="logo-mini" style={{ marginBottom: '0.75rem' }}>VRC Asset Manager</div>
              <p style={{ margin: 0, opacity: 0.8 }}>Current Version: <strong>{version.current}</strong></p>
              
              {version.latest && (
                <>
                  <p style={{ fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                    Latest Release: <strong style={{ color: 'var(--text)' }}>v{version.latest.tag}</strong>
                    {version.current !== version.latest.tag && (
                      <span style={{ 
                        marginLeft: '0.75rem', 
                        background: 'var(--primary)', 
                        color: 'white', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        boxShadow: '0 0 10px var(--primary-glow)'
                      }}>UPDATE AVAILABLE</span>
                    )}
                  </p>
                  
                  {version.current !== version.latest.tag && (
                    <button 
                      className="primary-btn"
                      onClick={() => api.openExternal(version.latest.url)}
                      style={{ marginTop: '0.75rem', width: 'auto', padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
                    >
                      Download & Update
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="about-links" style={{ marginTop: '1rem' }}>
              <a
                href="https://github.com/asna-1st/VRC-Asset-Manager"
                className="link-item"
                onClick={(e) => {
                  e.preventDefault();
                  api.openExternal(e.currentTarget.href);
                }}
              >
                <ExternalLink size={14} /> GitHub Repository
              </a>
            </div>
          </div>
        </section>
      </div>

      {saving && (
        <div className="save-status">
          <RefreshCw size={14} className="spinning" />
          Saving changes...
        </div>
      )}

      <MigrationModal
        isOpen={migrationData.isOpen}
        targetPath={migrationData.targetPath}
        onConfirm={handleConfirmMigration}
        onCancel={() => setMigrationData({ isOpen: false, targetPath: null })}
      />
    </div>
  );
}

export default Settings;
