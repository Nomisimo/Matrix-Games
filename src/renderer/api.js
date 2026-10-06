// Brücke zum Electron-Hauptprozess mit Browser-Rückfall (Spielen geht auch im Browser)
const E = typeof window !== "undefined" ? window.electronAPI : null;
export const isElectron = !!E;

export const api = {
  appVersion: () => (E ? E.appVersion() : Promise.resolve(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev")),
  netzwerkkarten: () => (E ? E.netzwerkkarten() : Promise.resolve([])),
  // Ausgabe an die LED-Matrix (sACN/NDI) im Hauptprozess
  ausgabe: (cfg) => (E ? E.ausgabe(cfg) : Promise.resolve(null)),
  frame: (px) => E?.frame(px),
  onStatus: (cb) => (E ? E.onStatus(cb) : () => {}),
  // Updates
  fetchReleases: () => (E?.fetchReleases ? E.fetchReleases() : fetch("https://api.github.com/repos/Nomisimo/Matrix-Games/releases?per_page=20").then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  checkForUpdates: () => (E?.checkForUpdates ? E.checkForUpdates() : Promise.resolve({ auto: false })),
  macUpdateLaden: (tag) => (E?.macUpdateLaden ? E.macUpdateLaden(tag) : Promise.resolve({ ok: false })),
  installUpdate: (url) => (E?.installUpdate ? E.installUpdate(url) : window.open(url, "_blank")),
  appBeenden: () => E?.appBeenden?.(),
  openExternal: (url) => (E?.openExternal ? E.openExternal(url) : window.open(url, "_blank")),
  onUpdateStatus: (cb) => (E?.onUpdateStatus ? E.onUpdateStatus(cb) : () => {}),
};
