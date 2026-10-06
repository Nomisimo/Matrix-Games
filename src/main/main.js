const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const root = app.getAppPath();
let mainWin = null;

/* ── Fenster ──────────────────────────────────────────────────────────── */
function createWindow() {
  const iconPath = path.join(root, 'assets', 'app-icon', 'icon.png');
  mainWin = new BrowserWindow({
    width: 1400, height: 900, minWidth: 960, minHeight: 640,
    title: 'Matrix Games', show: false, backgroundColor: '#15191e',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(root, 'src', 'preload', 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(root, 'dist-app', 'index.html'));
  mainWin.once('ready-to-show', () => { mainWin.show(); mainWin.focus(); });
  mainWin.on('focus', () => { if (!mainWin.isDestroyed()) mainWin.webContents.focus(); });
  // Links im Standardbrowser öffnen
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url || '')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('app-version', () => app.getVersion());

// IPv4-Netzwerkkarten (ohne Loopback) für die sACN-Ausgabe
ipcMain.handle('netzwerkkarten', () => {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal) continue;
      out.push({ name, address: a.address, prefix: a.cidr ? +a.cidr.split('/')[1] : null });
    }
  }
  return out;
});

/* ── Ausgabe an die LED-Matrix (sACN, NDI) ─────────────────────────────── */
const ausgabe = require('./spiele/ausgabe').register(ipcMain, () => mainWin);
app.on('before-quit', () => ausgabe.stopAll());

/* ── Start, Einzelinstanz ──────────────────────────────────────────────── */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
