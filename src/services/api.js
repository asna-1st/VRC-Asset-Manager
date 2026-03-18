// Native Electron API service using IPC
class ApiService {
  constructor() {
    console.log('ApiService: initializing');
    if (!window.electronAPI) {
      console.error('ApiService: window.electronAPI is UNDEFINED!');
    }
  }

  async openExternal(url) {
    return window.electronAPI.openExternal(url);
  }

  // Assets
  async getAssets(params = {}) {
    console.log('ApiService: getAssets called with', params);
    return window.electronAPI.getAssets(params);
  }

  async getAsset(id) {
    const assets = await window.electronAPI.getAssets({ limit: 1000 });
    return assets.find(a => a.id === id);
  }

  async createAsset(data) {
    const processedData = { ...data };
    if (data.files && data.files.length > 0) {
      processedData.files = data.files.map(file => ({
        path: file.path || file.sourcePath || null,
        name: file.name,
        type: file.type,
        transferMode: file.transferMode || 'copy',
        sourcePath: file.sourcePath || null
      }));
    }
    return window.electronAPI.createAsset(processedData);
  }

  async updateAsset(data) {
    const processedData = { ...data };
    if (data.files && data.files.length > 0) {
      processedData.files = data.files.map(file => ({
        path: file.path || file.sourcePath || null,
        name: file.name,
        type: file.type,
        transferMode: file.transferMode || 'copy',
        sourcePath: file.sourcePath || null
      }));
    }
    return window.electronAPI.updateAsset(processedData);
  }

  async deleteAsset(id) {
    return window.electronAPI.deleteAsset(id);
  }

  // Avatars
  async getAvatars() {
    return window.electronAPI.getAvatars();
  }

  async getMissingAvatars() {
    return window.electronAPI.getMissingAvatars();
  }

  async getAvatarAssets(id, params = {}) {
    return window.electronAPI.getAvatarAssets({ id, ...params });
  }

  // Targets (for linking)
  async getTargets() {
    return window.electronAPI.getTargets();
  }

  // Asset Files
  async deleteAssetFile(fileId) {
    return window.electronAPI.deleteAssetFile(fileId);
  }

  async updateAssetFile(data) {
    return window.electronAPI.updateAssetFile(data);
  }

  // Files
  async getFiles() {
    return window.electronAPI.getFiles();
  }

  async deleteFile(filePath) {
    return window.electronAPI.deleteFile(filePath);
  }

  async openFile(filePath) {
    return window.electronAPI.openFile(filePath);
  }

  async openFileLocation(filePath) {
    return window.electronAPI.openFileLocation(filePath);
  }

  // Metadata
  async fetchMetadata(url) {
    return window.electronAPI.fetchMetadata(url);
  }

  // Save file (for uploads - legacy, but keeping for compatibility)
  async saveFile(data) {
    return window.electronAPI.saveFile(data);
  }

  // Config & Settings
  async getConfig() {
    return window.electronAPI.getConfig();
  }

  async setConfig(config) {
    return window.electronAPI.setConfig(config);
  }

  async selectFolder() {
    return window.electronAPI.selectFolder();
  }

  async validateAssetsFolder(path) {
    return window.electronAPI.validateAssetsFolder(path);
  }

  async changeAssetsLocation(newPath, mode) {
    return window.electronAPI.changeAssetsLocation({ newPath, mode });
  }

  onMigrationProgress(callback) {
    return window.electronAPI.onMigrationProgress(callback);
  }

  onToast(callback) {
    return window.electronAPI.onToast(callback);
  }
}

export default new ApiService();
