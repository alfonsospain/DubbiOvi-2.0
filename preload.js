const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  saveFile: (filePath, data, projectPath) => ipcRenderer.invoke('save-file', filePath, data, projectPath),
  runWhisperLocal: (audioBuffer, modelPath, language) => ipcRenderer.invoke('run-whisper-local', { audioBuffer, modelPath, language }),
  checkEngineBinary: (engineId) => ipcRenderer.invoke('check-engine-binary', { engineId }),
  downloadEngineBinary: (engineId) => ipcRenderer.invoke('download-engine-binary', { engineId }),
  onEngineDownloadProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('engine-download-progress', subscription);
    return () => ipcRenderer.removeListener('engine-download-progress', subscription);
  },
  checkEngineModel: (engineId, modelName) => ipcRenderer.invoke('check-engine-model', { engineId, modelName }),
  downloadEngineModel: (engineId, modelName, downloadUrl, configUrl) =>
    ipcRenderer.invoke('download-engine-model', { engineId, modelName, downloadUrl, configUrl }),
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
  },
  // Runtime Manager IPC Endpoints
  checkRuntimeInstalled: (runtimeId, version) => ipcRenderer.invoke('check-runtime-installed', { runtimeId, version }),
  getRuntimeDescriptor: (runtimeId, version) => ipcRenderer.invoke('get-runtime-descriptor', { runtimeId, version }),
  installRuntime: (runtimeId, version) => ipcRenderer.invoke('install-runtime', { runtimeId, version }),
  onRuntimeDownloadProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('runtime-download-progress', subscription);
    return () => ipcRenderer.removeListener('runtime-download-progress', subscription);
  },
  getInstalledRuntimes: () => ipcRenderer.invoke('get-installed-runtimes'),
  executeRuntime: (options) => ipcRenderer.invoke('execute-runtime', options),
  onRuntimeOutputStream: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('runtime-output-stream', subscription);
    return () => ipcRenderer.removeListener('runtime-output-stream', subscription);
  },
  // App Settings IPC Endpoints
  getAppSetting: (key, defaultValue) => ipcRenderer.invoke('get-app-setting', { key, defaultValue }),
  setAppSetting: (key, value) => ipcRenderer.invoke('set-app-setting', { key, value }),
  // Piper Voice Provider IPC Endpoints
  runPiperLocal: (params) => ipcRenderer.invoke('run-piper-local', params),
  listModels: (engineId) => ipcRenderer.invoke('list-models', engineId),
  deleteEngineModel: (engineId, modelName) => ipcRenderer.invoke('delete-engine-model', { engineId, modelName }),
  resolveAudioPath: (relativePath, projectPath) => ipcRenderer.invoke('resolve-audio-path', { relativePath, projectPath }),
  renderAudioMixdown: (options) => ipcRenderer.invoke('render-audio-mixdown', options),
  adjustVoiceTiming: (args) => ipcRenderer.invoke('adjust-voice-timing', args),
  renderVideoExport: (options) => ipcRenderer.invoke('render-video-export', options),
  getSystemDiagnostics: () => ipcRenderer.invoke('get-system-diagnostics'),
  setDirtyState: (isDirty) => ipcRenderer.send('set-dirty-state', isDirty),
  forceClose: () => ipcRenderer.send('force-close'),
  updateTitle: (title) => ipcRenderer.send('update-title', title),
  onSaveOnClose: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-save-on-close', subscription);
    return () => ipcRenderer.removeListener('trigger-save-on-close', subscription);
  },
  onTriggerSave: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-save', subscription);
    return () => ipcRenderer.removeListener('trigger-save', subscription);
  },
  onTriggerSaveAs: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-save-as', subscription);
    return () => ipcRenderer.removeListener('trigger-save-as', subscription);
  },
});

