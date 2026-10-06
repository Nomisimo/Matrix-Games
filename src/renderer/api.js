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
};
