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
  // Anleitung: in der App als PDF speichern, im Browser über den Druckdialog („Als PDF sichern“)
  anleitungPdf: (html) => {
    if (E?.anleitungPdf) return E.anleitungPdf(html);
    const w = window.open("", "_blank");
    if (!w) return Promise.resolve({ ok: false });
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
    return Promise.resolve({ ok: true });
  },
  // Drehsensor (HTTP-Endpoint im Hauptprozess)
  drehsensor: (cfg) => (E?.drehsensor ? E.drehsensor(cfg) : Promise.resolve(null)),
  onDrehsensor: (cb) => (E?.onDrehsensor ? E.onDrehsensor(cb) : () => {}),
  // Fernsteuerung (Controller-Seite und HTTP im Hauptprozess)
  fernsteuerung: (cfg) => (E?.fernsteuerung ? E.fernsteuerung(cfg) : Promise.resolve(null)),
  onFernStatus: (cb) => (E?.onFernStatus ? E.onFernStatus(cb) : () => {}),
  onFernEingabe: (cb) => (E?.onFernEingabe ? E.onFernEingabe(cb) : () => {}),
  // Updates
  fetchReleases: () => (E?.fetchReleases ? E.fetchReleases() : fetch("https://api.github.com/repos/Nomisimo/Matrix-Games/releases?per_page=20").then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  checkForUpdates: () => (E?.checkForUpdates ? E.checkForUpdates() : Promise.resolve({ auto: false })),
  macUpdateLaden: (tag) => (E?.macUpdateLaden ? E.macUpdateLaden(tag) : Promise.resolve({ ok: false })),
  installUpdate: (url) => (E?.installUpdate ? E.installUpdate(url) : window.open(url, "_blank")),
  appBeenden: () => E?.appBeenden?.(),
  openExternal: (url) => (E?.openExternal ? E.openExternal(url) : window.open(url, "_blank")),
  onUpdateStatus: (cb) => (E?.onUpdateStatus ? E.onUpdateStatus(cb) : () => {}),
};
