const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  appVersion:     () => ipcRenderer.invoke('app-version'),
  netzwerkkarten: () => ipcRenderer.invoke('netzwerkkarten'),
  ausgabe:        (cfg) => ipcRenderer.invoke('spiele-ausgabe', cfg),
  frame:          (px) => ipcRenderer.send('spiele-frame', px),
  onStatus:       (cb) => { const h = (_, msg) => cb(msg); ipcRenderer.on('spiele-status', h); return () => ipcRenderer.removeListener('spiele-status', h); },
});
