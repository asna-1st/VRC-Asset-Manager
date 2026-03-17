import React, { createContext, useContext, useState, useRef } from 'react';

const ViewContext = createContext();

export const ViewProvider = ({ children }) => {
  const [homeState, setHomeState] = useState({
    assets: [],
    offset: 0,
    hasMore: true,
    category: 'All',
    search: ''
  });

  const [avatarStates, setAvatarStates] = useState({}); // id -> { avatar, assets, offset, hasMore }

  const [fileManagerState, setFileManagerState] = useState({
    files: [],
    filterCategory: 'All',
    searchQuery: '',
    sortBy: 'name',
    viewMode: 'grid'
  });

  // Use Ref for scrolls to avoid re-renders on every scroll tick
  const scrollPositions = useRef({}); // path -> scrollY

  const updateHomeState = (updates) => {
    setHomeState(prev => ({ ...prev, ...updates }));
  };

  const updateFileManagerState = (updates) => {
    setFileManagerState(prev => ({ ...prev, ...updates }));
  };

  const updateAvatarState = (id, updates) => {
    setAvatarStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { assets: [], offset: 0, hasMore: true }), ...updates }
    }));
  };

  const saveScroll = (path, scrollY) => {
    scrollPositions.current[path] = scrollY;
  };

  const getScroll = (path) => {
    return scrollPositions.current[path] || 0;
  };

  return (
    <ViewContext.Provider value={{ 
      homeState, 
      updateHomeState, 
      fileManagerState,
      updateFileManagerState,
      avatarStates,
      updateAvatarState,
      saveScroll, 
      getScroll
    }}>
      {children}
    </ViewContext.Provider>
  );
};

export const useView = () => useContext(ViewContext);
