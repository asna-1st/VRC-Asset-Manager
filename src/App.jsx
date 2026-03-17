import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Avatar from './pages/Avatar';
import FileManager from './pages/FileManager';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import { ViewProvider } from './context/ViewContext';
import { ToastProvider } from './context/ToastContext';
import FirstTimeSetup from './components/FirstTimeSetup';
import api from './services/api';

function App() {
  const [config, setConfig] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getConfig()
      .then(cfg => {
        if (mounted) setConfig(cfg);
      })
      .catch(err => console.error('Failed to load config:', err))
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => { mounted = false; };
  }, []);

  const handleSetupComplete = async () => {
    const cfg = await api.getConfig();
    setConfig(cfg);
  };

  return (
    <ToastProvider>
      <ViewProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/avatar" element={<Avatar />} />
              <Route path="/filemanager" element={<FileManager />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
        {!checking && config?.firstRun && (
          <FirstTimeSetup config={config} onComplete={handleSetupComplete} />
        )}
      </ViewProvider>
    </ToastProvider>
  );
}

export default App;
