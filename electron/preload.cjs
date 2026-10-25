const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('n3Api', {
  getFullState: () => ipcRenderer.invoke('n3:get-full-state'),
  refreshTelemetry: () => ipcRenderer.invoke('n3:refresh-telemetry'),
  setPreferredConnection: (mode) => ipcRenderer.invoke('n3:set-connection-mode', mode),

  setDpi: (payload) => ipcRenderer.invoke('n3:set-dpi', payload),
  setPollingRate: (hz) => ipcRenderer.invoke('n3:set-polling-rate', hz),
  setDebounce: (ms) => ipcRenderer.invoke('n3:set-debounce', ms),
  setSensor: (payload) => ipcRenderer.invoke('n3:set-sensor', payload),

  setButton: (button, actionConfig) =>
    ipcRenderer.invoke('n3:set-button', { button, actionConfig }),
  resetButtons: () => ipcRenderer.invoke('n3:reset-buttons'),

  saveMacro: (macro) => ipcRenderer.invoke('n3:save-macro', macro),
  deleteMacro: (macroId) => ipcRenderer.invoke('n3:delete-macro', macroId),
  bindMacroToButton: (button, macroId) =>
    ipcRenderer.invoke('n3:bind-macro-button', { button, macroId }),

  switchProfile: (profileId) => ipcRenderer.invoke('n3:switch-profile', profileId),
  createProfile: (name) => ipcRenderer.invoke('n3:create-profile', name),
  renameProfile: (profileId, name) =>
    ipcRenderer.invoke('n3:rename-profile', { profileId, name }),
  deleteProfile: (profileId) => ipcRenderer.invoke('n3:delete-profile', profileId),
  exportProfileDialog: () => ipcRenderer.invoke('n3:export-profile-dialog'),
  importProfileDialog: () => ipcRenderer.invoke('n3:import-profile-dialog'),
  factoryReset: (resetHardware = true) =>
    ipcRenderer.invoke('n3:factory-reset', { resetHardware }),

  updatePreferences: (prefs) => ipcRenderer.invoke('n3:update-preferences', prefs),
  listMacApps: () => ipcRenderer.invoke('n3:list-mac-apps'),
  openMacMouseSettings: () => ipcRenderer.invoke('n3:open-mac-mouse-settings'),
  openMainWindow: () => ipcRenderer.invoke('n3:open-main-window'),
  closePopover: () => ipcRenderer.invoke('n3:close-popover'),
  quitApp: () => ipcRenderer.invoke('n3:quit-app'),

  onStateUpdated: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('n3:state-updated', handler);
    return () => ipcRenderer.removeListener('n3:state-updated', handler);
  },

  onHudPayload: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('n3:hud-payload', handler);
    return () => ipcRenderer.removeListener('n3:hud-payload', handler);
  },
});
