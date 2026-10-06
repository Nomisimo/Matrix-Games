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

ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

/* ── Updates wie im Netzwerkplaner ───────────────────────────────────────
   Windows: electron-updater lädt die neue Version im Hintergrund und installiert
   sie nach Bestätigung. macOS: die App ist nicht mit einer Apple-Developer-ID signiert,
   dort lädt die App das passende DMG und öffnet es; die App nach „Programme“ ziehen. */
const RELEASES_URL = 'https://github.com/Nomisimo/Matrix-Games/releases';
const RELEASES_API = 'https://api.github.com/repos/Nomisimo/Matrix-Games/releases?per_page=20';

// Neueste Releases von GitHub holen (für den Update-Hinweis). Ohne Netz: null.
ipcMain.handle('fetch-releases', async () => {
  try {
    const { net: enet } = require('electron');
    const r = await enet.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Matrix-Games' } });
    if (!r.ok) return null;
    const list = await r.json();
    return Array.isArray(list) ? list.map((x) => ({ tag_name: x.tag_name, name: x.name, html_url: x.html_url, prerelease: x.prerelease, draft: x.draft, published_at: x.published_at })) : null;
  } catch { return null; }
});

const MANUAL_UPDATE = process.platform === 'darwin';
let updaterAktiv = false, updateReady = false;
function setupAutoUpdater(win) {
  if (MANUAL_UPDATE || !app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.error('electron-updater fehlt:', e?.message); return; }
  updaterAktiv = true;
  const send = (type, payload) => { if (!win.isDestroyed()) win.webContents.send('update-status', { type, ...payload }); };
  autoUpdater.allowPrerelease = app.getVersion().includes('-'); // Betas bekommen auch Betas
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-not-available', () => send('up-to-date'));
  autoUpdater.on('error', (err) => { console.error('AutoUpdater:', err?.message || err); send('error', { message: err?.message || String(err) }); });
  autoUpdater.on('download-progress', (p) => send('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  let sofort = false; // „Jetzt installieren“ gedrückt, bevor der Download fertig war
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true; send('downloaded', { version: info.version });
    if (sofort) setTimeout(() => autoUpdater.quitAndInstall(false, true), 800);
  });
  ipcMain.removeHandler('check-for-updates');
  ipcMain.handle('check-for-updates', () => {
    if (updateReady) { send('downloaded'); return { auto: true }; }
    autoUpdater.checkForUpdates().catch((err) => send('error', { message: err?.message || String(err) }));
    return { auto: true };
  });
  ipcMain.removeHandler('install-update');
  ipcMain.handle('install-update', () => {
    // Fertig geladen: sofort neu starten und installieren, sonst laden und danach installieren
    if (updateReady) { autoUpdater.quitAndInstall(false, true); return { ok: true }; }
    sofort = true;
    send('installing-after-download');
    autoUpdater.checkForUpdates().catch((err) => { sofort = false; send('error', { message: err?.message || String(err) }); });
    return { ok: true };
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}
ipcMain.handle('check-for-updates', () => ({ auto: updaterAktiv, mac: MANUAL_UPDATE && app.isPackaged }));

/* macOS ohne Apple-Signatur: das passende DMG wie im Browser laden (normaler Download,
   Gatekeeper-Schutz bleibt), öffnen und den Nutzer die App nach „Programme“ ziehen lassen.
   Die App selbst tauscht nichts aus. */
let macDownload = null;
ipcMain.handle('mac-update-laden', (_e, tag) => {
  if (!MANUAL_UPDATE || !mainWin || macDownload) return { ok: false };
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(tag || '')) return { ok: false };
  const datei = `Matrix-Games-${tag}-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg`;
  const url = `${RELEASES_URL}/download/v${tag}/${datei}`;
  const send = (type, payload) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-status', { type, ...payload }); };
  macDownload = { url, ziel: path.join(app.getPath('downloads'), datei) };
  const ses = mainWin.webContents.session;
  const h = (_ev, item) => {
    if (!macDownload || item.getURLChain()[0] !== macDownload.url) return;
    ses.removeListener('will-download', h);
    item.setSavePath(macDownload.ziel);
    item.on('updated', () => { const t = item.getTotalBytes(); if (t) send('downloading', { percent: Math.round((item.getReceivedBytes() / t) * 100) }); });
    item.once('done', async (_e2, state) => {
      const ziel = macDownload.ziel;
      macDownload = null;
      if (state !== 'completed') return send('error', { message: `Download ${state}` });
      const err = await shell.openPath(ziel);
      if (err) return send('error', { message: err });
      send('mac-dmg-offen', { version: tag, datei: ziel });
    });
  };
  ses.on('will-download', h);
  send('downloading', { percent: 0 });
  mainWin.webContents.downloadURL(url);
  return { ok: true };
});
ipcMain.handle('app-beenden', () => app.quit());
ipcMain.handle('install-update', (_e, url) => shell.openExternal(/^https:\/\/github\.com\/Nomisimo\/Matrix-Games\//.test(url || '') ? url : RELEASES_URL));

/* ── Ausgabe an die LED-Matrix (sACN, NDI) ─────────────────────────────── */
const ausgabe = require('./spiele/ausgabe').register(ipcMain, () => mainWin);
app.on('before-quit', () => ausgabe.stopAll());

/* ── Start, Einzelinstanz ──────────────────────────────────────────────── */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); } });
  app.whenReady().then(() => { createWindow(); setupAutoUpdater(mainWin); });
  app.on('window-all-closed', () => app.quit());
}
