const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:     () => ipcRenderer.invoke('app-version'),
  netzwerkkarten: () => ipcRenderer.invoke('netzwerkkarten'),
  ausgabe:        (cfg) => ipcRenderer.invoke('spiele-ausgabe', cfg),
  frame:          (px) => ipcRenderer.send('spiele-frame', px),
  anleitungPdf:   (html) => ipcRenderer.invoke('anleitung-pdf', html),
  onStatus:       (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('spiele-status', h); return () => ipcRenderer.removeListener('spiele-status', h); },
  drehsensor:     (cfg) => ipcRenderer.invoke('drehsensor', cfg),
  onDrehsensor:   (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('drehsensor-status', h); return () => ipcRenderer.removeListener('drehsensor-status', h); },
  fernsteuerung:  (cfg) => ipcRenderer.invoke('fernsteuerung', cfg),
  onFernStatus:   (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('fernsteuerung-status', h); return () => ipcRenderer.removeListener('fernsteuerung-status', h); },
  onFernEingabe:  (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('fernsteuerung-eingabe', h); return () => ipcRenderer.removeListener('fernsteuerung-eingabe', h); },
  // Updates (wie im Netzwerkplaner)
  fetchReleases:  () => ipcRenderer.invoke('fetch-releases'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate:  (url) => ipcRenderer.invoke('install-update', url),
  macUpdateLaden: (tag) => ipcRenderer.invoke('mac-update-laden', tag),
  appBeenden:     () => ipcRenderer.invoke('app-beenden'),
  openExternal:   (url) => ipcRenderer.invoke('open-external', url),
  onUpdateStatus: (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('update-status', h); return () => ipcRenderer.removeListener('update-status', h); },
});
