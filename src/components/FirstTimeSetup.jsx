import React, { useState } from 'react';
import { Folder, Palette, CheckCircle } from 'lucide-react';
import api from '../services/api';

const ACCENT_COLORS = [
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Sky', color: '#0ea5e9' },
  { name: 'Violet', color: '#8b5cf6' },
];

function FirstTimeSetup({ config, onComplete }) {
  const [step, setStep] = useState(0);
  const [selectedRoot, setSelectedRoot] = useState('');
  const [theme, setTheme] = useState(config?.theme || 'dark');
  const [accentColor, setAccentColor] = useState(config?.accentColor || '#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const applyTheme = (nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const applyAccent = (color) => {
    document.documentElement.style.setProperty('--primary', color);
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.3)`);
  };

  const handleChooseFolder = async () => {
    try {
      const folderPath = await api.selectFolder();
      if (folderPath) {
        setSelectedRoot(folderPath);
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  const handleNext = async () => {
    if (step < 2) {
      if (step === 0 && !selectedRoot) {
        setError('Please choose an assets folder before continuing.');
        return;
      }
      setError('');
      setStep(prev => prev + 1);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (!selectedRoot) {
        setError('Please choose an assets folder before finishing.');
        return;
      }

      const validation = await api.validateAssetsFolder(selectedRoot);
      if (!validation?.ok) {
        setError(validation?.error || 'Selected folder is not writable.');
        return;
      }

      const result = await api.changeAssetsLocation(selectedRoot, 'fresh');
      if (result && result.error) {
        throw new Error(result.message || 'Could not set assets folder');
      }

      await api.setConfig({
        theme,
        accentColor,
        firstRun: false
      });

      applyTheme(theme);
      applyAccent(accentColor);

      if (onComplete) {
        await onComplete();
      }
    } catch (err) {
      setError(err.message || 'Setup failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-header">
          <div className="setup-title">First-time setup</div>
          <div className="setup-step">Step {step + 1} of 3</div>
        </div>

        <div className="setup-body">
          {error && (
            <div className="setup-error">{error}</div>
          )}
          {step === 0 && (
            <div className="setup-panel">
              <div className="setup-panel-header">
                <Folder size={18} />
                <h3>Choose Assets Folder</h3>
              </div>
              <p className="setup-text">
                Pick where your asset files and database should live. You can change this later in Settings.
              </p>
              <div className="setup-path">
                <span className="setup-label">Current Folder</span>
                <code className="setup-path-value">{selectedRoot || 'Not selected'}</code>
              </div>
              <button className="secondary-btn" onClick={handleChooseFolder}>
                Choose Folder
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="setup-panel">
              <div className="setup-panel-header">
                <Palette size={18} />
                <h3>Theme and Accent</h3>
              </div>
              <p className="setup-text">Pick a look you like. These settings can be changed later.</p>
              <div className="setup-theme-toggle">
                <button
                  className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => {
                    setTheme('light');
                    applyTheme('light');
                  }}
                >
                  Light
                </button>
                <button
                  className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => {
                    setTheme('dark');
                    applyTheme('dark');
                  }}
                >
                  Dark
                </button>
              </div>
              <div className="setup-accent-grid">
                {ACCENT_COLORS.map(ac => (
                  <button
                    key={ac.name}
                    className="accent-circle"
                    style={{ backgroundColor: ac.color }}
                    onClick={() => {
                      setAccentColor(ac.color);
                      applyAccent(ac.color);
                    }}
                    title={ac.name}
                  >
                    {accentColor === ac.color && <CheckCircle size={14} color="white" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="setup-panel">
              <div className="setup-panel-header">
                <CheckCircle size={18} />
                <h3>Quick Tips</h3>
              </div>
              <ul className="setup-tips">
                <li>Add assets with the “Add” button on the sidebar.</li>
                <li>Link files to avatars for easy lookup later.</li>
                <li>Use search to find by name or avatar tags.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="setup-footer">
          {step > 0 ? (
            <button className="secondary-btn" onClick={handleBack} disabled={saving}>
              Back
            </button>
          ) : (
            <div />
          )}
          <button className="primary-btn" onClick={handleNext} disabled={saving}>
            {step < 2 ? 'Next' : (saving ? 'Finishing...' : 'Finish Setup')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FirstTimeSetup;
