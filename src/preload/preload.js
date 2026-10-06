const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:     () => ipcRenderer.invoke('app-version'),
  netzwerkkarten: () => ipcRenderer.invoke('netzwerkkarten'),
  ausgabe:        (cfg) => ipcRenderer.invoke('spiele-ausgabe', cfg),
  frame:          (px) => ipcRenderer.send('spiele-frame', px),
  onStatus:       (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('spiele-status', h); return () => ipcRenderer.removeListener('spiele-status', h); },
  // Updates (wie im Netzwerkplaner)
  fetchReleases:  () => ipcRenderer.invoke('fetch-releases'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate:  (url) => ipcRenderer.invoke('install-update', url),
  macUpdateLaden: (tag) => ipcRenderer.invoke('mac-update-laden', tag),
  appBeenden:     () => ipcRenderer.invoke('app-beenden'),
  openExternal:   (url) => ipcRenderer.invoke('open-external', url),
  onUpdateStatus: (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('update-status', h); return () => ipcRenderer.removeListener('update-status', h); },
});
