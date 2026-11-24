// Soundtrack-Dateien je Spiel (z. B. Tetris), lokal in IndexedDB gespeichert, damit sie den
// Neustart der App überstehen. In den Einstellungen steht nur der Dateiname (cfg.soundtrack).
const DB = "matrixgames_audio", STORE = "soundtracks";

const oeffne = () => new Promise((ok, fehler) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fehler(r.error);
});

async function mit(modus, fn) {
  const db = await oeffne();
  try {
    return await new Promise((ok, fehler) => {
      const tx = db.transaction(STORE, modus), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => ok(req?.result);
      tx.onerror = () => fehler(tx.error);
    });
  } finally { db.close(); }
}

// { name, daten: ArrayBuffer } oder null
export const soundtrackLaden = (spiel) => mit("readonly", (s) => s.get(spiel)).then((v) => v || null).catch(() => null);
export const soundtrackSpeichern = (spiel, name, daten) => mit("readwrite", (s) => s.put({ name, daten }, spiel));
export const soundtrackLoeschen = (spiel) => mit("readwrite", (s) => s.delete(spiel)).catch(() => {});
