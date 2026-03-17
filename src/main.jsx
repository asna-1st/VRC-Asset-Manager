import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove launch loader once React mounts
const loader = document.getElementById('app-loading');
if (loader) {
  requestAnimationFrame(() => loader.remove());
}
