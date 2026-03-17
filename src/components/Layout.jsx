import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home as HomeIcon,
  Users,
  Shirt,
  Crown,
  Palette,
  Scissors,
  Layers,
  Folder,
  Plus,
  Menu,
  Minus,
  Square,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import api from '../services/api';
import { useView } from '../context/ViewContext';

const TitleBar = () => {
  const handleMinimize = () => window.electronAPI.windowControl.minimize();
  const handleMaximize = () => window.electronAPI.windowControl.maximize();
  const handleClose = () => window.electronAPI.windowControl.close();

  return (
    <div className="title-bar">
      <div className="title-bar-drag">
        <div className="app-title-mini">VRC Asset Manager</div>
      </div>
      <div className="window-controls">
        <button className="control-btn win-minimize" onClick={handleMinimize}>
          <Minus size={14} />
        </button>
        <button className="control-btn win-maximize" onClick={handleMaximize}>
          <Square size={12} />
        </button>
        <button className="control-btn win-close" onClick={handleClose}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveScroll, getScroll } = useView();
  const [sidebarActive, setSidebarActive] = useState(false);
  const mainContentRef = React.useRef(null);

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' && !location.search.includes('category=');
    }
    return location.pathname === path;
  };

  React.useEffect(() => {
    // Initial config load to apply theme
    const initApp = async () => {
      try {
        const config = await api.getConfig();
        if (config) {
          document.documentElement.setAttribute('data-theme', config.theme);
          document.documentElement.style.setProperty('--primary', config.accentColor);

          // Apply RGB for glows
          const hex = config.accentColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
          document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
        }
      } catch (err) {
        console.error('Failed to load initial config:', err);
      }
    };
    initApp();
  }, []);

  // Scroll Restoration Logic
  React.useLayoutEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    const handleScroll = () => {
      saveScroll(location.pathname + location.search, container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);

    // Restore scroll
    const savedScroll = getScroll(location.pathname + location.search);
    container.scrollTop = savedScroll;

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, location.search]);

  const navigateToHome = (category = 'All') => {
    navigate(`/?category=${category}`);
    setSidebarActive(false);
  };

  const navigateToFileManager = () => {
    navigate('/filemanager');
    setSidebarActive(false);
  };

  return (
    <>
      <TitleBar />
      <div className="glass-bg"></div>

      <div className="mobile-top-bar">
        <button
          className="icon-btn"
          onClick={() => setSidebarActive(!sidebarActive)}
        >
          <Menu size={20} />
        </button>
        <div className="logo">
          <h1>VRC<span>AssetMAnager</span></h1>
        </div>
      </div>

      <div className="app-container">
        <aside className={`sidebar ${sidebarActive ? 'active' : ''}`}>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <label>Library</label>
              <button
                className={`cat-btn ${location.pathname === '/' && (new URLSearchParams(location.search).get('category') === 'All' || !location.search.includes('category=')) ? 'active' : ''}`}
                onClick={() => navigateToHome('All')}
              >
                <span className="icon"><HomeIcon size={18} /></span> All Assets
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Avatar') ? 'active' : ''}`}
                onClick={() => navigateToHome('Avatar')}
              >
                <span className="icon"><Users size={18} /></span> Avatar
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Outfit') ? 'active' : ''}`}
                onClick={() => navigateToHome('Outfit')}
              >
                <span className="icon"><Shirt size={18} /></span> Outfit
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Accessory') ? 'active' : ''}`}
                onClick={() => navigateToHome('Accessory')}
              >
                <span className="icon"><Crown size={18} /></span> Accessory
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Texture') ? 'active' : ''}`}
                onClick={() => navigateToHome('Texture')}
              >
                <span className="icon"><Palette size={18} /></span> Texture
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Hair') ? 'active' : ''}`}
                onClick={() => navigateToHome('Hair')}
              >
                <span className="icon"><Scissors size={18} /></span> Hair
              </button>
              <button
                className={`cat-btn ${location.search.includes('category=Miscellaneous') ? 'active' : ''}`}
                onClick={() => navigateToHome('Miscellaneous')}
              >
                <span className="icon"><Layers size={18} /></span> Miscellaneous
              </button>
            </div>
            <div className="nav-section">
              <label>Tools</label>
              <button
                className={`cat-btn ${isActive('/filemanager') ? 'active' : ''}`}
                onClick={navigateToFileManager}
              >
                <span className="icon"><Folder size={18} /></span> File Manager
              </button>
              <button
                className={`cat-btn ${isActive('/settings') ? 'active' : ''}`}
                onClick={() => { navigate('/settings'); setSidebarActive(false); }}
              >
                <span className="icon"><SettingsIcon size={18} /></span> Settings
              </button>
            </div>
          </nav>

          <div className="sidebar-footer">
            <button
              className="primary-btn full-width"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openAddModal'));
                setSidebarActive(false);
              }}
            >
              <Plus size={20} /> Add
            </button>
          </div>
        </aside>

        <main className="main-content" ref={mainContentRef}>
          {children}
        </main>
      </div>
    </>
  );
}

export default Layout;
