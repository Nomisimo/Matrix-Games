/* ── Versionen & Änderungen ────────────────────────────────────────────────
   Wie im Netzwerkplaner: die Versionsnummer steht in package.json (SemVer, Betas als x.y.z-beta.n).
   Hier stehen die Änderungen je Version für „Version und Updates“ in der App; der
   Release-Workflow nimmt daraus auch den Text für das GitHub-Release. */
export const REPO = "Nomisimo/Matrix-Games";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export const CHANGELOG = {
  "1.0.0-beta.2": [
    "Tastatur: Nach einem Klick auf einen Schalter, eine Auswahlliste oder einen Knopf reagiert das Spiel weiter auf die Tasten (vorher war die Tastatur dort „gefangen“, die Leertaste schaltete z. B. sACN aus)",
    "Gleichmäßigere 60 Bilder je Sekunde für sACN und NDI, die Anzeige läuft im Takt des Bildschirms",
    "Matrix an/aus: schaltet die LED-Matrizen dunkel (sACN und NDI senden Schwarz), das Spiel läuft weiter",
    "Gamepads: Steuerkreuz, A springt, B/X rennt oder wirft Feuer, Start = Enter, Select = Esc; bei Pong zwei Pads",
    "NDI-Name gilt erst beim Verlassen des Felds (vorher entstand je Buchstabe ein neuer Stream)",
    "Mario: neues Aussehen, Fahnenmast und Burg am Ende, danach die nächste Welt mit schnelleren und mehr Gegnern",
    "Mario: Piranha-Pflanzen, Paratroopas, Panzer kicken und anhalten, Feuerbälle, Münz-, Stern- und 1-Up-Blöcke, Kombo-Punkte",
    "Mario: Weltanzeige vor jeder Runde, Ziel- und Game-Over-Bild mit mehr Abstand zwischen den Zeilen",
    "Schrift: W sieht nicht mehr wie V aus, M und N sind in Mario gut zu unterscheiden",
    "Updates: Die App prüft beim Start, ob es eine neue Version gibt. Windows installiert sie selbst, auf dem Mac lädt die App das DMG und öffnet es",
  ],
  "1.0.0-beta.1": [
    "Erste Version: Snake, Pong und Mario Jump als eigene Desktop-App im Design des Netzwerkplaners (grün)",
    "Ausgabe per sACN (E1.31) und NDI mit Live-Ansicht der beiden Matrizen",
  ],
};

// SemVer-Vergleich inkl. Vorabversionen: 1.0.0-beta.1 < 1.0.0-beta.2 < 1.0.0
export const parseVersion = (v) => {
  const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
};
export const compareVersions = (a, b) => {
  const A = parseVersion(a), B = parseVersion(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A.nums[i] !== B.nums[i]) return A.nums[i] - B.nums[i];
  if (!A.pre.length || !B.pre.length) return (A.pre.length ? -1 : 0) - (B.pre.length ? -1 : 0);
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny && +x !== +y) return +x - +y;
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
export const istBeta = (v) => /-(alpha|beta|rc)/i.test(String(v || ""));

// Neueste Version aus der GitHub-Releases-Liste (ohne Entwürfe)
export const neuesteVersion = (releases = []) => releases
  .filter((r) => !r.draft && parseVersion(r.tag_name))
  .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0] || null;
