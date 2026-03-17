import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const ToastContext = createContext({ push: () => {} });

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry = { id, type: 'info', ...toast };
    setToasts(prev => [...prev, entry]);
    const timeout = setTimeout(() => remove(id), 4000);
    return () => clearTimeout(timeout);
  }, [remove]);

  useEffect(() => {
    const unsubscribe = api.onToast((data) => {
      if (!data) return;
      push({
        title: data.title,
        body: data.body,
        type: data.type || 'info'
      });
    });
    return () => unsubscribe && unsubscribe();
  }, [push]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-host">
        {toasts.map(t => (
          <div key={t.id} className={`toast-card ${t.type}`}>
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
