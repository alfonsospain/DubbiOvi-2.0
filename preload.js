const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  runWhisperLocal: (audioBuffer, modelPath) => ipcRenderer.invoke('run-whisper-local', { audioBuffer, modelPath }),
  checkEngineBinary: (engineId) => ipcRenderer.invoke('check-engine-binary', { engineId }),
  downloadEngineBinary: (engineId) => ipcRenderer.invoke('download-engine-binary', { engineId }),
  onEngineDownloadProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('engine-download-progress', subscription);
    return () => ipcRenderer.removeListener('engine-download-progress', subscription);
  },
  checkEngineModel: (engineId, modelName) => ipcRenderer.invoke('check-engine-model', { engineId, modelName }),
  downloadEngineModel: (engineId, modelName) => ipcRenderer.invoke('download-engine-model', { engineId, modelName }),
  onModelDownloadProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('model-download-progress', subscription);
    return () => ipcRenderer.removeListener('model-download-progress', subscription);
  },
  openDetachedWindow: (url) => ipcRenderer.send('open-detached-video', url),
  closeDetachedWindow: () => ipcRenderer.send('close-detached-video'),
  onDetachedWindowStatus: (callback) => {
    const subscription = (event, status) => callback(status);
    ipcRenderer.on('detached-window-status', subscription);
    return () => ipcRenderer.removeListener('detached-window-status', subscription);
  }
});
