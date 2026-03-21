const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    getPathForFile: (file) => webUtils.getPathForFile(file),
    
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getLatestVersion: () => ipcRenderer.invoke('get-latest-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Asset management
    getTargets: () => ipcRenderer.invoke('get-targets'),
    getAssets: (params) => ipcRenderer.invoke('get-assets', params),
    getAvatars: () => ipcRenderer.invoke('get-avatars'),
    getMissingAvatars: () => ipcRenderer.invoke('get-missing-avatars'),
    createAsset: (data) => ipcRenderer.invoke('create-asset', data),
    updateAsset: (data) => ipcRenderer.invoke('update-asset', data),
    deleteAsset: (id) => ipcRenderer.invoke('delete-asset', id),
    
    // File management
    deleteAssetFile: (id) => ipcRenderer.invoke('delete-asset-file', id),
    updateAssetFile: (data) => ipcRenderer.invoke('update-asset-file', data),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    getAvatarAssets: (params) => ipcRenderer.invoke('get-avatar-assets', params),
    getFiles: () => ipcRenderer.invoke('get-files'),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
    selectFile: () => ipcRenderer.invoke('select-file'),
    notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
    onToast: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('app-toast', subscription);
        return () => ipcRenderer.removeListener('app-toast', subscription);
    },
    
    // Metadata
    fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
    
    // File upload
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    
    // Window controls
    windowControl: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close')
    },
    
    // Settings & Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (config) => ipcRenderer.invoke('set-config', config),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    validateAssetsFolder: (path) => ipcRenderer.invoke('validate-assets-folder', path),
    changeAssetsLocation: (data) => ipcRenderer.invoke('change-assets-location', data),
    onMigrationProgress: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('migration-progress', subscription);
        return () => ipcRenderer.removeListener('migration-progress', subscription);
    }
});
