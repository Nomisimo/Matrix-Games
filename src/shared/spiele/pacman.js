/* ── Pac-Man (hochkant) ────────────────────────────────────────────────────
   Die beiden 24×24-Matrizen stehen übereinander (24×48). Zwei Darstellungen (Einstellung):
   - "gross": Pac-Man und die Geister sind 3×3 Pixel groß, damit man Pac-Mans Mund und die
     Blickrichtung der Geister sieht; die Gänge sind darum 3 Pixel breit. Das Labyrinth (23×40,
     die rechte Wand ist doppelt) ist kleiner als im Original, hat aber dessen Aufbau.
   - "original": Ein Feld ist ein Pixel, Figuren auch. Das Labyrinth (24×38) folgt dem Original
     Gang für Gang (246 Punkte und 4 Kraftpillen statt 240 + 4).
   Beide haben Tunnel auf halber Höhe, Geisterhaus mit Tür in der Mitte, Frucht darunter,
   Pac-Mans Start darunter und vier Kraftpillen. Gerechnet wird auf den Mittellinien der Gänge:
   ein Feld des Originals ist ein Pixel. Oben stehen die Punkte, unten die Leben und die Früchte.

   Die Geister verhalten sich wie im Automaten von 1980:
   - Ziele: Blinky jagt Pac-Mans Feld, Pinky 4 Felder vor ihn (nach oben auch 4 nach links,
     der Überlauf-Fehler des Originals), Inky spiegelt Blinky an dem Feld 2 vor Pac-Man (mit
     demselben Fehler), Clyde jagt ihn nur, solange er mehr als 8 Felder entfernt ist, sonst
     geht er in seine Ecke.
   - Ein Feld vorher entscheidet jeder Geist, wohin er am nächsten Feld abbiegt: der Ausgang mit
     dem kürzesten Luftlinien-Abstand zum Ziel, bei Gleichstand oben, links, unten, rechts. Umkehren
     darf er nur, wenn der Modus wechselt. Über dem Geisterhaus und über Pac-Mans Start dürfen
     Geister im Scatter und Chase nicht nach oben abbiegen.
   - Scatter und Chase wechseln nach der Zeittabelle je Level (7/20/7/20/5/20/5 s im Level 1),
     bei jedem Wechsel drehen alle Geister um. Während sie Angst haben, steht die Uhr.
   - Kraftpille: Geister drehen um, werden blau und langsamer und wählen an jeder Kreuzung eine
     zufällige Richtung; Dauer und Blinken je Level wie im Original. Gefressene Geister kehren als
     Augen ins Haus zurück. 200, 400, 800, 1600 Punkte.
   - Geisterhaus: Pinky kommt sofort, Inky nach 30, Clyde nach 60 von 244 Punkten (Level 1),
     nach einem Leben mit dem gemeinsamen Zähler (7, 17, 32). Diese Zahlen gelten (wie auch
     Früchte und Elroy) anteilig zur Zahl der Punkte im Labyrinth. Frisst Pac-Man 4 s
     (ab Level 5: 3 s) nichts, kommt der nächste Geist heraus.
   - „Cruise Elroy“: Bei wenigen Punkten wird Blinky in zwei Stufen schneller und jagt auch im Scatter.
   - Tempo je Level als Anteil der Höchstgeschwindigkeit, Geister im Tunnel langsamer, Pac-Man hält
     nach jedem Punkt ein Bild an (nach einer Kraftpille drei).
   Gezeichnet wird hochkant und für die Ausgabe in den 48×24-Frame gedreht (wie Tetris).
   Zustände: title → playing → game_over → title */
import { Bild, dreheInQuer, fdiv } from "./pixel.js";
import { FONT } from "./mario/index.js";

export const HW = 24, HH = 48;
// Richtungen in der Reihenfolge, in der das Original bei Gleichstand wählt
export const OBEN = 0, LINKS = 1, UNTEN = 2, RECHTS = 3;
const DX = [0, -1, 0, 1], DY = [-1, 0, 1, 0];
const gegen = (d) => (d + 2) % 4;
const TASTEN = {
  ArrowUp: OBEN, KeyW: OBEN, ArrowLeft: LINKS, KeyA: LINKS, ArrowDown: UNTEN, KeyS: UNTEN, ArrowRight: RECHTS, KeyD: RECHTS,
};
export const GEISTER = ["blinky", "pinky", "inky", "clyde"];
export const FARBEN = {
  blinky: [255, 0, 0], pinky: [255, 120, 200], inky: [0, 230, 255], clyde: [255, 140, 0],
  pac: [255, 220, 0], wand: [25, 25, 160], punkt: [140, 100, 80], pille: [255, 184, 150],
  tuer: [150, 70, 110], angst: [40, 40, 255], blink: [230, 230, 230], augen: [255, 255, 255], pupille: [30, 30, 220],
};

/* Labyrinth-Karte je Pixel: # Wand, . Punkt, o Kraftpille, Leerzeichen freier Gang (Mittellinie),
   - Weg durch die Tür, H Geisterhaus. Daraus baut labyrinth() alles, was Spiel, Zeichnen und Demo brauchen. */
function labyrinth({ name, karte, oy, start, tuer, hausY, heim, frucht, tunnelY, tunnelRand, rot, gross, offen }) {
  const MB = karte[0].length, MH = karte.length;
  const wrap = (x) => ((x % MB) + MB) % MB;
  const zelle = (x, y) => (y < 0 || y >= MH ? "#" : karte[y][wrap(x)]);
  const frei = (x, y) => !"#H-".includes(zelle(x, y));
  const alle = karte.join("").split("").filter((c) => c === "." || c === "o").length;
  // Gezeichnete Wand: nur Wandpixel neben einem offenen Pixel, damit dicke Blöcke als Umriss erscheinen
  const OFFEN = Array.from({ length: MH }, (_, y) => Array.from({ length: MB }, (_, x) => offen(zelle, x, y)));
  const wand = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
    if (OFFEN[y][x]) continue;
    let rand = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (OFFEN[y + dy]?.[wrap(x + dx)]) rand = true;
    // Schmaleres Labyrinth: die rechte Wand reicht bis an den Rand der Matrix
    if (rand) { wand.push([x, y]); for (let xx = MB; xx < HW && x === MB - 1; xx++) wand.push([xx, y]); }
  }
  const nachbarn = [];
  for (let i = 0; i < MB * MH; i++) {
    const x = i % MB, y = fdiv(i, MB);
    nachbarn.push(frei(x, y) ? [0, 1, 2, 3].filter((d) => frei(x + DX[d], y + DY[d])).map((d) => [d, (y + DY[d]) * MB + wrap(x + DX[d])]) : []);
  }
  return {
    name, karte, MB, MH, oy, start, tuer, hausY, heim, frucht, tunnelY, tunnelRand, rot: new Set(rot), gross,
    wrap, frei, wand, nachbarn, alle,
    // Zählerstände des Originals (244 Punkte) gelten anteilig
    anteil: (n) => Math.round((n * alle) / 244),
    // Ecken im Scatter (außerhalb des Labyrinths, wie im Original)
    ecken: { blinky: { x: MB - 3, y: -3 }, pinky: { x: 2, y: -3 }, inky: { x: MB - 1, y: MH }, clyde: { x: 0, y: MH } },
    // Treffen: gleiches Feld; große Figuren schon, wenn die Mitten ein Pixel auseinander sind
    treffen: gross ? 1 : 0,
  };
}

/* Große Figuren: Netz der Gänge, Knoten (+) an geraden Stellen, dazwischen Verbindungen (- waagerecht,
   | senkrecht). Spalte i liegt bei Pixel GX[i/2], Zeile j bei GY[j/2] (Mittellinien, 4–5 Pixel auseinander). */
const GX = [2, 6, 11, 16, 20], GY = [2, 6, 10, 15, 20, 25, 29, 33, 37];
const NETZ = [
  "+-+   +-+",
  "| |   | |",
  "+-+-+-+-+",
  "| |   | |",
  "+-+   +-+",
  "| |   | |",
  "+-+-+-+-+",
  "|       |",
  "+       +",   // Tunnel nach außen
  "|       |",
  "+-+-+-+-+",
  "| |   | |",
  "+-+-+-+-+",
  "|   |   |",
  "+-+-+-+-+",
  "|       |",
  "+-+-+-+-+",
];
const GROSS = (() => {
  const MB = 23, MH = 40, start = { x: 11, y: 29 }, tuer = { x: 11, y: 15 }, hausY = 20, tunnelY = 20;
  const k = Array.from({ length: MH }, () => Array(MB).fill("#"));
  const gang = (x, y) => { k[y][x] = " "; };
  NETZ.forEach((zeile, j) => [...zeile].forEach((c, i) => {
    if (j % 2 === 0 && i % 2 === 0 && c === "+") gang(GX[i / 2], GY[j / 2]);
    if (j % 2 === 0 && i % 2 === 1 && c === "-") for (let x = GX[(i - 1) / 2]; x <= GX[(i + 1) / 2]; x++) gang(x, GY[j / 2]);
    if (j % 2 === 1 && i % 2 === 0 && c === "|") for (let y = GY[(j - 1) / 2]; y <= GY[(j + 1) / 2]; y++) gang(GX[i / 2], y);
  }));
  for (const x of [0, 1, MB - 2, MB - 1]) gang(x, tunnelY);
  for (let y = hausY - 1; y <= hausY + 1; y++) for (let x = 7; x <= 15; x++) k[y][x] = "H";
  k[tuer.y + 1][tuer.x] = "-"; k[tuer.y + 2][tuer.x] = "-";
  // Punkte auf jedem zweiten Pixel der Mittellinien, nicht rund ums Geisterhaus und nicht im Tunnel
  for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
    if (k[y][x] !== " " || (x + y) % 2 || (y >= 12 && y <= 27 && x >= 4 && x <= 18) || x < 2 || x > MB - 3) continue;
    if (x === start.x && y === start.y) continue;
    k[y][x] = ".";
  }
  for (const [x, y] of [[2, 6], [20, 6], [2, 29], [20, 29]]) k[y][x] = "o";
  return labyrinth({
    name: "gross", karte: k.map((r) => r.join("")), oy: 5, start, tuer, hausY, tunnelY, tunnelRand: 1, gross: true,
    heim: { blinky: 11, pinky: 11, inky: 7, clyde: 15 }, frucht: { x: 11, y: 25 },
    // Hier biegen Geister im Scatter und Chase nicht nach oben ab (wie die vier Felder im Original)
    rot: ["6,15", "16,15", "6,29", "16,29"],
    // Offen ist alles bis ein Pixel neben einer Mittellinie (3 Pixel breite Gänge); die Tür ist zu
    offen: (zelle, x, y) => {
      if (y === tuer.y + 2 && Math.abs(x - tuer.x) <= 1) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (zelle(x + dx, y + dy) !== "#") return true;
      return false;
    },
  });
})();

/* Original: linke Hälfte des Labyrinths, die rechte ist gespiegelt (Zeichen wie oben). */
const HAELFTE = [
  "############",
  "#..........#",
  "#.##.#####.#",
  "#o##.#####.#",
  "#.##.#####.#",
  "#.##.#####.#",
  "#...........",
  "#.##.##.####",
  "#.##.##.####",
  "#.##.##.####",
  "#....##....#",
  "####.##### #",
  "####.##### #",
  "####.##### #",
  "####.##     ",
  "####.## ###-",
  "####.## #HHH",
  "    .   #HHH",
  "####.## #HHH",
  "####.## ####",
  "####.##     ",
  "####.## ####",
  "####.## ####",
  "####.## ####",
  "#..........#",
  "#.##.#####.#",
  "#.##.#####.#",
  "#.##.#####.#",
  "#o.#....... ",
  "##.#.##.####",
  "##.#.##.####",
  "##.#.##.####",
  "#....##....#",
  "#.########.#",
  "#.########.#",
  "#.########.#",
  "#...........",
  "############",
];
const ORIGINAL = labyrinth({
  name: "original", karte: HAELFTE.map((r) => r + [...r].reverse().join("")), oy: 6, gross: false,
  start: { x: 11, y: 28 }, tuer: { x: 11, y: 14 }, hausY: 17, tunnelY: 17, tunnelRand: 3,
  heim: { blinky: 11, pinky: 11, inky: 9, clyde: 13 }, frucht: { x: 11, y: 20 },
  rot: ["10,14", "13,14", "10,28", "13,28"],
  offen: (zelle, x, y) => zelle(x, y) !== "#",
});
export const LABYRINTHE = { gross: GROSS, original: ORIGINAL };
const labyrinthAus = (n) => LABYRINTHE[n] || GROSS;
// Vorgabe (große Figuren) für Tests und Werkzeuge
export const { karte: KARTE, MB, MH, start: START, tuer: TUER, hausY: HAUS_Y, ecken: ECKEN, frei: pacFrei, alle: ALLE_PUNKTE, anteil } = GROSS;

/* ── Tabellen je Level (wie im Original) ── */
// Tempo als Anteil der Höchstgeschwindigkeit
export function tempoFuer(level) {
  if (level <= 1) return { pac: 0.8, pacAngst: 0.9, geist: 0.75, angst: 0.5, tunnel: 0.4, elroy1: 0.8, elroy2: 0.85 };
  if (level <= 4) return { pac: 0.9, pacAngst: 0.95, geist: 0.85, angst: 0.55, tunnel: 0.45, elroy1: 0.9, elroy2: 0.95 };
  if (level <= 20) return { pac: 1, pacAngst: 1, geist: 0.95, angst: 0.6, tunnel: 0.5, elroy1: 1, elroy2: 1.05 };
  return { pac: 0.9, pacAngst: 0.9, geist: 0.95, angst: 0.6, tunnel: 0.5, elroy1: 1, elroy2: 1.05 };
}
// 100 % sind im Original 75,76 Pixel je Sekunde bei 8 Pixeln je Feld; hier 8 Schritte je Feld
const SCHRITT = 8, VOLL = 75.75757625 / 60;
// Scatter/Chase-Wechsel in Bildern; gerade Stellen sind Scatter, die letzte Phase (Chase) bleibt
export function modusZeiten(level) {
  const s = (...t) => t.map((x) => Math.round(x * 60));
  if (level <= 1) return s(7, 20, 7, 20, 5, 20, 5);
  if (level <= 4) return [...s(7, 20, 7, 20, 5, 1033), 1];
  return [...s(5, 20, 5, 20, 5, 1037), 1];
}
const ANGST_S = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1];
const BLINKEN = [5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];
export const angstDauer = (level) => (ANGST_S[level - 1] ?? 0) * 60;
const blinkZahl = (level) => BLINKEN[level - 1] ?? 0;
const BLINK = 24;
// Punkte, ab denen Blinky zu „Cruise Elroy“ wird (Stufe 2: die Hälfte)
export function elroyGrenze(level) {
  const t = [[1, 20], [2, 30], [5, 40], [8, 50], [11, 60], [14, 80], [18, 100]];
  for (const [bis, n] of t) if (level <= bis) return n;
  return 120;
}
// Geisterhaus: eigener Punktezähler je Geist, nach einem verlorenen Leben der gemeinsame Zähler
export function hausGrenze(name, level) {
  if (name === "inky") return level === 1 ? 30 : 0;
  if (name === "clyde") return level === 1 ? 60 : level === 2 ? 50 : 0;
  return 0;
}
const GLOBAL = { pinky: 7, inky: 17, clyde: 32 };
// Früchte: Farben (zwei Pixel) und Punkte je Level
const FRUECHTE = [
  { a: [255, 0, 0], b: [190, 0, 0], p: 100 },          // Kirsche
  { a: [255, 40, 80], b: [255, 255, 255], p: 300 },    // Erdbeere
  { a: [255, 150, 0], b: [255, 150, 0], p: 500 },      // Orange
  { a: [255, 0, 40], b: [60, 200, 60], p: 700 },       // Apfel
  { a: [60, 200, 60], b: [200, 255, 200], p: 1000 },   // Melone
  { a: [255, 220, 0], b: [40, 80, 255], p: 2000 },     // Galaxian
  { a: [255, 220, 0], b: [255, 220, 0], p: 3000 },     // Glocke
  { a: [80, 220, 255], b: [255, 255, 255], p: 5000 },  // Schlüssel
];
export const fruchtFuer = (level) => FRUECHTE[[0, 0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6][level] ?? 7];
const FRUCHT_BEI = [70, 170], FRUCHT_ZEIT = 570;
const LEBEN = 3, EXTRA = 10000;
const BEREIT = 120, ERSTES_BEREIT = 150, GEFRESSEN = 60, TOD = 150, GESCHAFFT = 60 + 8 * 12;

/* ── Eine Runde (alle Level bis zum letzten Leben) ── */
export class PacRunde {
  // tempo: Faktor auf alle Geschwindigkeiten (Einstellung, 1 = wie im Original);
  // labyrinth: "gross" (Figuren 3×3) oder "original" (1 Pixel je Feld)
  constructor(ton = () => {}, rnd = Math.random, { tempo = () => 1, level = 1, labyrinth = "gross" } = {}) {
    this.ton = ton; this.rnd = rnd; this.tempoFaktor = tempo; this.lab = labyrinthAus(labyrinth);
    this.score = 0; this.leben = LEBEN; this.extra = false; this.level = level; this.tick = 0;
    this.neuesLevel();
    this.phase = "bereit"; this.zeit = ERSTES_BEREIT;
    this.ton("start");
  }
  neuesLevel() {
    this.punkte = this.lab.karte.map((r) => [...r].map((c) => (c === "." || c === "o" ? c : null)));
    this.rest = this.punkte.flat().filter(Boolean).length;
    this.gefressen = 0;
    this.zaehler = { pinky: 0, inky: 0, clyde: 0 };
    this.globalAn = false; this.globalZ = 0;
    this.elroyAn = true;
    this.frucht = 0; this.fruchtNr = 0;
    this.aufstellen();
  }
  // Pac-Man und Geister an den Start, Modus-Uhr von vorn
  aufstellen() {
    const L = this.lab;
    this.pac = { x: L.start.x, y: L.start.y, dir: LINKS, off: 0, wunsch: null, steht: false, pause: 0, rest: 0 };
    this.geister = GEISTER.map((name) => {
      const g = { name, x: L.heim[name], y: L.hausY, dir: name === "pinky" ? UNTEN : OBEN, off: 0, zustand: "haus", angst: false, umkehren: false, am: 0, plan: 0, rest: 0 };
      if (name === "blinky") { g.x = L.tuer.x; g.y = L.tuer.y; this.losLaufen(g); }
      return g;
    });
    this.modusIdx = 0; this.modusZeit = 0; this.angstZeit = 0; this.kombi = 0;
    this.seitPunkt = 0; this.anzeige = null; this.waka = 0;
  }
  get scatter() { return this.modusIdx % 2 === 0; }
  get tempo() { return tempoFuer(this.level); }
  geist(name) { return this.geister.find((g) => g.name === name); }
  // Elroy-Stufe von Blinky (0, 1 oder 2)
  get elroy() {
    if (!this.elroyAn) return 0;
    const n = this.lab.anteil(elroyGrenze(this.level));
    return this.rest <= n / 2 ? 2 : this.rest <= n ? 1 : 0;
  }

  /* Ziel eines Geistes (Feld, auch außerhalb des Labyrinths) */
  ziel(g) {
    if (g.zustand === "augen") return this.lab.tuer;
    const p = this.pac;
    if (this.scatter && !(g.name === "blinky" && this.elroy)) return this.lab.ecken[g.name];
    if (g.name === "blinky") return { x: p.x, y: p.y };
    // Nach oben rechnet das Original auch nach links (Überlauf-Fehler)
    const vor = (n) => ({ x: p.x + DX[p.dir] * n - (p.dir === OBEN ? n : 0), y: p.y + DY[p.dir] * n });
    if (g.name === "pinky") return vor(4);
    if (g.name === "inky") {
      const v = vor(2), b = this.geist("blinky");
      return { x: 2 * v.x - b.x, y: 2 * v.y - b.y };
    }
    const dx = g.x - p.x, dy = g.y - p.y;
    return dx * dx + dy * dy > 64 ? { x: p.x, y: p.y } : this.lab.ecken.clyde;
  }
  /* Richtung, in die g am Feld (nx, ny) abbiegt, wenn es dort mit Richtung d ankommt */
  waehle(g, nx, ny, d) {
    const L = this.lab;
    let wege = [OBEN, LINKS, UNTEN, RECHTS].filter((o) => o !== gegen(d) && L.frei(nx + DX[o], ny + DY[o]));
    if (g.zustand === "frei" && !g.angst && L.rot.has(`${L.wrap(nx)},${ny}`)) wege = wege.filter((o) => o !== OBEN);
    if (!wege.length) return gegen(d);
    if (g.angst && g.zustand === "frei") {
      // Zufällige Richtung; ist sie zu, die nächste in der Reihenfolge oben, links, unten, rechts
      const r = Math.floor(this.rnd() * 4);
      for (let i = 0; i < 4; i++) if (wege.includes((r + i) % 4)) return (r + i) % 4;
    }
    const z = this.ziel(g);
    let best = wege[0], bd = Infinity;
    for (const o of wege) {
      const ex = nx + DX[o] - z.x, ey = ny + DY[o] - z.y, dd = ex * ex + ey * ey;
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }
  // Geist steht mittig über der Tür und läuft ins Labyrinth (nach links, wie im Original)
  losLaufen(g) {
    g.zustand = "frei"; g.dir = LINKS; g.off = 0; g.am = LINKS; g.umkehren = false;
    g.plan = this.waehle(g, g.x - 1, g.y, LINKS);
  }
  // Geist betritt ein neues Feld: die vorher geplante Richtung gilt hier, geplant wird das nächste
  betrete(g) {
    g.am = g.plan;
    g.plan = this.waehle(g, g.x + DX[g.am], g.y + DY[g.am], g.am);
  }
  allesUmkehren() { for (const g of this.geister) if (g.zustand === "frei") g.umkehren = true; }

  geschwindigkeit(g) {
    const t = this.tempo;
    if (g.zustand === "augen" || g.zustand === "rein") return 2;
    if (g.zustand !== "frei") return 0.5;
    const L = this.lab;
    if (g.y === L.tunnelY && (g.x <= L.tunnelRand || g.x >= L.MB - 1 - L.tunnelRand)) return t.tunnel;
    if (g.angst) return t.angst;
    if (g.name === "blinky" && this.elroy) return this.elroy === 2 ? t.elroy2 : t.elroy1;
    return t.geist;
  }
  // Ein Schritt (1/8 Feld) eines Geistes
  geistSchritt(g) {
    const { hausY: HAUS_Y, tuer: TUER, wrap } = this.lab;
    if (g.zustand === "haus") {
      // Auf und ab wippen
      if (g.off === 0) { if (g.y <= HAUS_Y - 1) g.dir = UNTEN; else if (g.y >= HAUS_Y + 1) g.dir = OBEN; }
    } else if (g.zustand === "raus") {
      if (g.off === 0) {
        if (g.x !== TUER.x) g.dir = g.x < TUER.x ? RECHTS : LINKS;
        else if (g.y > TUER.y) g.dir = OBEN;
        else return this.losLaufen(g);
      }
    } else if (g.zustand === "rein") {
      if (g.off === 0) {
        if (g.y < HAUS_Y) g.dir = UNTEN;
        else { g.zustand = "raus"; g.angst = false; return; }
      }
    } else if (g.off === 0) {
      if (g.zustand === "augen" && g.x === TUER.x && g.y === TUER.y) { g.zustand = "rein"; g.dir = UNTEN; return; }
      g.dir = g.am;
    }
    g.off++;
    if (g.off < SCHRITT / 2) return;
    if (g.zustand === "frei" && g.umkehren) {
      // Umkehren an der Feldgrenze: zurück ins alte Feld
      g.umkehren = false; g.dir = gegen(g.dir); g.off = -SCHRITT / 2; g.plan = g.dir;
      return this.betrete(g);
    }
    g.x = wrap(g.x + DX[g.dir]); g.y += DY[g.dir]; g.off = -SCHRITT / 2;
    if (g.zustand === "frei" || g.zustand === "augen") this.betrete(g);
  }
  // Ein Schritt (1/8 Feld) von Pac-Man; true, wenn er ein neues Feld betreten hat
  pacSchritt() {
    const p = this.pac, w = p.wunsch, { frei: pacFrei, wrap } = this.lab;
    if (w != null && w === gegen(p.dir)) { p.dir = w; p.off = -p.off; }
    if (p.off === 0) {
      if (w != null && w !== p.dir && pacFrei(p.x + DX[w], p.y + DY[w])) p.dir = w;
      if (!pacFrei(p.x + DX[p.dir], p.y + DY[p.dir])) { p.steht = true; return false; }
    } else if (p.off < 0 && w != null && w !== p.dir && w !== gegen(p.dir) && pacFrei(p.x + DX[w], p.y + DY[w])) {
      // Vor der Mitte abbiegen (Kurven schneiden wie im Original)
      p.off = 0; p.dir = w; p.steht = false;
      return false;
    }
    p.steht = false;
    if (++p.off < SCHRITT / 2) return false;
    p.x = wrap(p.x + DX[p.dir]); p.y += DY[p.dir]; p.off = -SCHRITT / 2;
    return true;
  }
  // Pac-Man frisst, was auf seinem Feld liegt
  fressen() {
    const p = this.pac, c = this.punkte[p.y][p.x];
    if (c) {
      this.punkte[p.y][p.x] = null; this.rest--; this.gefressen++; this.seitPunkt = 0;
      this.waka ^= 1;
      if (c === "o") {
        this.punkteDazu(50); p.pause = 3; this.ton("power"); this.kraftpille();
      } else { this.punkteDazu(10); p.pause = 1; this.ton(this.waka ? "dot" : "dot2"); }
      if (this.globalAn) this.globalZ++;
      else { const g = this.bevorzugt(); if (g) this.zaehler[g.name]++; }
      if (FRUCHT_BEI.some((n) => this.lab.anteil(n) === this.gefressen)) { this.frucht = FRUCHT_ZEIT; this.fruchtNr++; }
      if (!this.rest) { this.phase = "geschafft"; this.zeit = GESCHAFFT; this.ton("_stop"); }
    }
    const F = this.lab.frucht;
    if (this.frucht && Math.abs(p.x - F.x) + Math.abs(p.y - F.y) <= 1) {
      const f = fruchtFuer(this.level);
      this.frucht = 0; this.punkteDazu(f.p); this.ton("fruit");
      this.anzeige = { text: String(f.p), x: F.x, y: F.y, zeit: 120 };
    }
  }
  punkteDazu(n) {
    this.score += n;
    if (!this.extra && this.score >= EXTRA) { this.extra = true; this.leben++; this.ton("extra"); }
  }
  kraftpille() {
    const dauer = angstDauer(this.level);
    this.allesUmkehren();
    this.kombi = 0;
    if (!dauer) return;
    this.angstZeit = dauer;
    for (const g of this.geister) if (g.zustand !== "augen" && g.zustand !== "rein") g.angst = true;
  }
  // Der Geist im Haus, dessen Zähler gerade läuft (Reihenfolge Pinky, Inky, Clyde)
  bevorzugt() { return ["pinky", "inky", "clyde"].map((n) => this.geist(n)).find((g) => g.zustand === "haus"); }
  freilassen(g) {
    g.zustand = "raus";
    if (g.name === "clyde") this.elroyAn = true;
  }
  hausPruefen() {
    const g = this.bevorzugt();
    if (!g) return;
    if (this.globalAn) {
      if (this.globalZ >= this.lab.anteil(GLOBAL[g.name])) {
        this.freilassen(g);
        if (g.name === "clyde") { this.globalAn = false; this.globalZ = 0; }
      }
    } else if (this.zaehler[g.name] >= this.lab.anteil(hausGrenze(g.name, this.level))) this.freilassen(g);
    if (g.zustand === "haus" && this.seitPunkt >= (this.level < 5 ? 240 : 180)) { this.freilassen(g); this.seitPunkt = 0; }
  }
  // Treffen sich Pac-Man und ein Geist? Wie im Original zählt nur, ob die Mitten (fast) auf einem Feld liegen
  treffen() {
    const p = this.pac;
    for (const g of this.geister) {
      if (Math.abs(g.x - p.x) + Math.abs(g.y - p.y) > this.lab.treffen || g.zustand === "augen" || g.zustand === "rein") continue;
      if (g.angst) {
        this.kombi++;
        const n = 100 * 2 ** this.kombi;
        this.punkteDazu(n);
        g.angst = false; g.zustand = "augen";
        g.plan = this.waehle(g, g.x + DX[g.am], g.y + DY[g.am], g.am);
        this.anzeige = { text: String(n), x: g.x, y: g.y, zeit: GEFRESSEN, geist: g };
        this.phase = "gefressen"; this.zeit = GEFRESSEN;
        this.ton("ghost");
        return true;
      }
      this.phase = "tod"; this.zeit = TOD; this.ton("death");
      return true;
    }
    return false;
  }
  bewege(obj, tempo, schritt) {
    obj.rest += tempo * VOLL * Math.max(0.2, +this.tempoFaktor() || 1);
    while (obj.rest >= 1) { obj.rest -= 1; if (schritt() === "stopp") { obj.rest = 0; return; } }
  }

  // Ein Bild (1/60 s). Gibt "over" zurück, wenn das letzte Leben weg ist.
  update() {
    this.tick++;
    if (this.anzeige && this.phase !== "gefressen" && --this.anzeige.zeit <= 0) this.anzeige = null;
    if (this.phase === "over") return "over";
    if (this.phase !== "laeuft") {
      if (--this.zeit > 0) return null;
      if (this.phase === "gefressen") { this.anzeige = null; this.phase = "laeuft"; }
      else if (this.phase === "bereit") this.phase = "laeuft";
      else if (this.phase === "geschafft") { this.level++; this.neuesLevel(); this.phase = "bereit"; this.zeit = BEREIT; }
      else if (this.phase === "tod") {
        if (--this.leben <= 0) { this.phase = "over"; return "over"; }
        this.aufstellen(); this.globalAn = true; this.globalZ = 0; this.elroyAn = false;
        this.phase = "bereit"; this.zeit = BEREIT;
      }
      return null;
    }
    // Uhren: Scatter/Chase steht, solange die Geister Angst haben
    if (this.angstZeit > 0) {
      if (--this.angstZeit === 0) for (const g of this.geister) g.angst = false;
    } else {
      const zeiten = modusZeiten(this.level);
      if (this.modusIdx < zeiten.length && ++this.modusZeit >= zeiten[this.modusIdx]) {
        this.modusIdx++; this.modusZeit = 0; this.allesUmkehren();
      }
    }
    if (this.frucht > 0) this.frucht--;
    this.seitPunkt++;
    this.hausPruefen();
    // Pac-Man
    const p = this.pac, t = this.tempo;
    if (p.pause > 0) p.pause--;
    else {
      this.bewege(p, this.angstZeit ? t.pacAngst : t.pac, () => {
        if (this.pacSchritt()) { this.fressen(); if (this.phase !== "laeuft" || p.pause) return "stopp"; }
      });
    }
    if (this.phase !== "laeuft" || this.treffen()) return null;
    // Geister
    for (const g of this.geister) {
      this.bewege(g, this.geschwindigkeit(g), () => { this.geistSchritt(g); });
      if (this.treffen()) return null;
    }
    return null;
  }
  key(code) {
    if (code in TASTEN) this.pac.wunsch = TASTEN[code];
  }
  get angstBlinkt() {
    const n = blinkZahl(this.level);
    return this.angstZeit > 0 && this.angstZeit <= n * BLINK && fdiv(this.angstZeit, BLINK / 2) % 2 === 0;
  }

  /* Zeichnen auf ein Hochkant-Bild (24×48). hud: Punkte, Leben, Früchte und READY.
     Große Figuren 3×3 mit Mund und Auge, sonst ein Pixel je Figur. */
  render(b, hud = true) {
    const L = this.lab, OY = L.oy, G = L.gross;
    b.fill(SCHWARZ);
    const geschafft = this.phase === "geschafft" && this.zeit < GESCHAFFT - 60;
    const wand = geschafft && fdiv(this.zeit, 12) % 2 === 0 ? [220, 220, 220] : FARBEN.wand;
    for (const [x, y] of L.wand) b.set(x, OY + y, wand);
    if (!geschafft) {
      if (G) b.rect(L.tuer.x - 1, OY + L.tuer.y + 2, 3, 1, FARBEN.tuer);
      else b.rect(L.tuer.x, OY + L.tuer.y + 1, 2, 1, FARBEN.tuer);
    }
    const pille = this.phase !== "laeuft" || fdiv(this.tick, 10) % 2 === 0;
    for (let y = 0; y < L.MH; y++) for (let x = 0; x < L.MB; x++) {
      const c = this.punkte[y][x];
      if (c === ".") b.set(x, OY + y, FARBEN.punkt);
      else if (c === "o" && pille) for (const [dx, dy] of G ? PLUS : PUNKT) b.set(x + dx, OY + y + dy, FARBEN.pille);
    }
    if (this.frucht) {
      const f = fruchtFuer(this.level), F = L.frucht;
      if (G) for (const [dx, dy, i] of FRUCHT_FORM) b.set(F.x + dx, OY + F.y + dy, i ? f.b : f.a);
      else { b.set(F.x, OY + F.y, f.a); b.set(F.x + 1, OY + F.y, f.b); }
    }
    const tod = this.phase === "tod" ? TOD - this.zeit : -1;
    // Pac-Man (groß: Mund in Laufrichtung); beim Sterben klappt er auf bzw. wird dunkel und zerplatzt
    const p = this.pac;
    if (this.phase === "gefressen") { /* an seiner Stelle stehen die Punkte */ }
    else if (tod < 60) {
      // Der Mund geht nie ganz zu, damit man die Richtung immer sieht
      const mund = tod >= 0 || p.steht || this.phase !== "laeuft" ? 2 : 1 + (fdiv(this.tick, 4) % 2);
      if (G) figur(b, p.x, OY + p.y, p.dir, PAC_FORM[mund], FARBEN.pac);
      else b.set(p.x, OY + p.y, FARBEN.pac);
    } else if (tod < 120) {
      if (G) figur(b, p.x, OY + p.y, OBEN, PAC_TOD[Math.min(3, fdiv(tod - 60, 15))], FARBEN.pac);
      else b.set(p.x, OY + p.y, FARBEN.pac.map((v) => Math.round(v * (1 - (tod - 60) / 60))));
    } else if (tod < 140) {
      const r = tod < 130 ? 1 : 2;
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) b.set(p.x + dx, OY + p.y + dy, [200, 180, 0]);
    }
    // Geister (beim Sterben verschwinden sie nach einer Sekunde, im Levelende sofort)
    if (tod < 60 && this.phase !== "geschafft" && this.phase !== "over") {
      const rock = fdiv(this.tick, 8) % 2;
      for (const g of this.geister) {
        if (this.anzeige?.geist === g && this.phase === "gefressen") continue;
        const x = g.x, y = OY + g.y, augen = g.zustand === "augen" || g.zustand === "rein";
        const blinkt = g.angst && this.angstBlinkt;
        const koerper = g.angst ? (blinkt ? FARBEN.blink : FARBEN.angst) : FARBEN[g.name];
        if (!G) { b.set(x, y, augen ? FARBEN.pupille.map((v) => Math.min(255, v + 130)) : koerper); continue; }
        if (augen) {
          b.set(x - 1, y, FARBEN.augen); b.set(x + 1, y, FARBEN.augen);
          b.set(x + DX[g.dir], y + DY[g.dir], FARBEN.pupille);
          continue;
        }
        for (const [dx, dy] of GEIST_FORM[rock]) b.set(x + dx, y + dy, koerper);
        // Normal: ein weißes Auge in Blickrichtung; mit Angst ein blasses Gesicht in der Mitte
        if (g.angst) b.set(x, y, blinkt ? [255, 0, 0] : FARBEN.pille);
        else b.set(x + DX[g.dir], y + DY[g.dir], FARBEN.augen);
      }
    }
    if (this.anzeige) {
      const t = this.anzeige.text, w = FONT.textWidth(t);
      const x = Math.max(0, Math.min(HW - w, this.anzeige.x - (w >> 1))), y = Math.max(OY, Math.min(OY + L.MH - 6, OY + this.anzeige.y - 2));
      b.rect(x - 1, y - 1, w + 2, 7, SCHWARZ);
      FONT.drawText(b, t, x, y, this.anzeige.geist ? FARBEN.inky : [255, 184, 222]);
    }
    if (!hud) return;
    if (this.phase === "bereit") textUnterHaus(b, L, "READY", FARBEN.pac);
    FONT.drawText(b, kurz(this.score), 1, 0, [255, 255, 255]);
    // Leben unten links, Früchte der letzten Level unten rechts
    for (let i = 0; i < Math.min(4, this.leben - (this.phase === "laeuft" || this.phase === "gefressen" ? 1 : 0)); i++) figur(b, 2 + i * 4, HH - 2, RECHTS, PAC_FORM[2], FARBEN.pac);
    for (let i = 0; i < Math.min(3, this.level); i++) {
      const f = fruchtFuer(this.level - i);
      for (const [dx, dy, j] of FRUCHT_FORM) b.set(HW - 2 - i * 4 + dx, HH - 2 + dy, j ? f.b : f.a);
    }
  }
}

const SCHWARZ = [0, 0, 0];
// Figuren 3×3 als Versatz zur Mitte. Pac-Man nach rechts: zu, halb offen, offen; gedreht in Laufrichtung
const QUADRAT = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const ohne = (...weg) => QUADRAT.filter(([x, y]) => !weg.some(([a, b]) => a === x && b === y));
const PAC_FORM = [QUADRAT, ohne([1, 0]), ohne([1, 0], [0, 0])];
// Sterben (Mund nach oben): klappt immer weiter auf
const PAC_TOD = [ohne([0, -1], [0, 0]), ohne([0, -1], [0, 0], [-1, -1], [1, -1]), [[-1, 1], [0, 1], [1, 1]], [[0, 1]]];
// Geist: runder Kopf, Körper, wackelnder Saum
const GEIST_FORM = [
  [[0, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
  [[0, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
];
const PLUS = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]], PUNKT = [[0, 0]];
// Frucht: Blatt (b) oben, Frucht (a) darunter
const FRUCHT_FORM = [[0, -1, 1], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]];
// Form für Blickrichtung d drehen (gezeichnet ist sie nach rechts)
const drehen = ([x, y], d) => (d === RECHTS ? [x, y] : d === LINKS ? [-x, y] : d === OBEN ? [y, -x] : [y, x]);
function figur(b, x, y, d, form, farbe) {
  for (const p of form) { const [dx, dy] = drehen(p, d); b.set(x + dx, y + dy, farbe); }
}

// Text (READY, OVER) auf schwarzem Feld unter dem Geisterhaus, wie im Original
function textUnterHaus(b, L, t, farbe) {
  const y = L.oy + L.frucht.y - (L.gross ? 2 : 0);
  b.rect(1, y - 1, 22, 7, SCHWARZ);
  FONT.drawText(b, t, mitte(t), y, farbe);
}

export const kurz = (n) => (n < 10000 ? String(n) : n < 1e6 ? `${Math.floor(n / 1000)}K` : `${Math.floor(n / 1e6)}M`);
const zeichne = (b, hoch, drehung, f) => {
  if (b.w === HW && b.h === HH) return f(b);
  f(hoch);
  dreheInQuer(hoch, b, drehung());
};
const mitte = (t) => fdiv(HW - FONT.textWidth(t), 2);
const zentriert = (b, t, y, c) => FONT.drawText(b, t, mitte(t), y, c);

/* ── Demo: Pac-Man spielt sich selbst ──────────────────────────────────────
   An jedem Feld schaut er per Breitensuche, welcher Weg zum nächsten Punkt führt, den er vor
   den Geistern erreicht, und meidet Gänge, in denen ein Geist nah ist. Blaue Geister jagt er.
   „Können“ (0–1): wie oft er die Geister übersieht oder eine zufällige Richtung nimmt. */
function bfs(L, starts, gesperrt = -1) {
  const dist = new Int16Array(L.MB * L.MH).fill(9999), q = [];
  for (const s of starts) if (s >= 0 && s !== gesperrt && dist[s] > 0) { dist[s] = 0; q.push(s); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const [, j] of L.nachbarn[i]) if (j !== gesperrt && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
  }
  return dist;
}
export function demoRichtung(r, koennen = 1, rnd = Math.random) {
  const L = r.lab, { MB, MH } = L, p = r.pac, pi = p.y * MB + p.x, wege = L.nachbarn[pi];
  // Ab welchem Abstand ein Geist gefährlich ist (große Figuren treffen sich früher)
  const nah = L.gross ? 3 : 1;
  if (!wege.length) return null;
  if (rnd() < (1 - koennen) * 0.25) return wege[Math.floor(rnd() * wege.length)][0];
  const blind = rnd() < (1 - koennen) * 0.6;
  const gefahr = blind ? new Int16Array(MB * MH).fill(9999) : bfs(L, r.geister.filter((g) => !g.angst && (g.zustand === "frei" || g.zustand === "raus"))
    .flatMap((g) => [g.y * MB + g.x, L.frei(g.x + DX[g.dir], g.y + DY[g.dir]) ? (g.y + DY[g.dir]) * MB + L.wrap(g.x + DX[g.dir]) : -1]));
  const blaue = new Set(r.geister.filter((g) => g.angst && g.zustand === "frei").map((g) => g.y * MB + g.x));
  const jagen = r.angstZeit > 90;
  const pillenOk = gefahr[pi] <= 8 || r.rest <= 20;
  let best = null, bw = -Infinity;
  for (const [d, n] of wege) {
    let wert;
    if (gefahr[n] <= nah) wert = -1000 + gefahr[n];
    else {
      const dist = bfs(L, [n], pi);
      let ziel = 9999;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= ziel) continue;
        const c = r.punkte[fdiv(i, MB)][i % MB];
        const gut = (jagen && blaue.has(i)) || ((c === "." || (c === "o" && pillenOk)) && dist[i] + nah + 1 < gefahr[i]);
        if (gut) ziel = dist[i] - (jagen && blaue.has(i) ? 5 : 0);
      }
      wert = (ziel === 9999 ? -50 : -ziel) + 2 * Math.min(gefahr[n], 6);
    }
    if (d === p.dir) wert += 0.5;
    if (wert > bw) { bw = wert; best = d; }
  }
  return best;
}

// labyrinth: () => "gross" | "original"; wird es umgestellt, beginnt die Demo neu
export function createPacmanDemo({ koennen = () => 1, drehung = () => "rechts", tempo = () => 1, labyrinth = () => "gross", rnd = Math.random } = {}) {
  const hoch = new Bild(HW, HH);
  const neu = () => { const r = new PacRunde(() => {}, rnd, { tempo, labyrinth: labyrinth() }); r.zeit = 30; return r; };
  let r = neu(), feld = -1, pause = 0;
  return {
    step() {
      if (labyrinthAus(labyrinth()) !== r.lab) { r = neu(); feld = -1; pause = 0; }
      if (pause > 0) { if (--pause === 0) { r = neu(); feld = -1; } return; }
      const p = r.pac, f = p.y * r.lab.MB + p.x;
      if (r.phase === "laeuft" && (f !== feld || p.steht)) {
        feld = f;
        const kn = Math.max(0, Math.min(1, koennen()));
        p.wunsch = demoRichtung(r, kn, rnd);
      }
      if (r.update() === "over") pause = 90;
    },
    render(b) { zeichne(b, hoch, drehung, (h) => r.render(h, false)); },
    get runde() { return r; },
  };
}

// rekord: { get, set } für den gespeicherten Highscore; drehung: () => "rechts" | "links";
// tempo: () => Faktor auf alle Geschwindigkeiten (1 = Original);
// labyrinth: () => "gross" | "original", gilt ab der nächsten Runde
export function createPacman({ ton = () => {}, rekord, drehung = () => "rechts", tempo = () => 1, labyrinth = () => "gross" } = {}) {
  let state = "title", game = null, blink = 0, neuerRekord = false, eigener = 0, ende = 0;
  rekord ||= { get: () => eigener, set: (n) => { eigener = n; } };
  const hoch = new Bild(HW, HH);
  const neu = () => { game = new PacRunde(ton, Math.random, { tempo, labyrinth: labyrinth() }); state = "playing"; ende = 0; };
  return {
    id: "pacman",
    hochkant: true,
    get state() { return state; },
    get score() { return game?.score || 0; },
    get spiel() { return game; },
    key(code) {
      if (state === "title") { if (code === "Space" || code === "Enter") neu(); }
      else if (state === "playing") game.key(code);
      else if (state === "game_over" && ende > 60) {
        if (code === "Space" || code === "Enter") neu();
        else if (code === "Escape") state = "title";
      }
    },
    step() {
      blink++;
      if (state === "playing" && game.update() === "over") {
        ton("over");
        neuerRekord = game.score > 0 && game.score > rekord.get();
        if (neuerRekord) rekord.set(game.score);
        state = "game_over";
      }
      if (state === "game_over") ende++;
    },
    render(b, pause = false) {
      zeichne(b, hoch, drehung, (h) => {
        if (state === "title") {
          h.fill(SCHWARZ);
          zentriert(h, "PAC", 8, FARBEN.pac);
          zentriert(h, "MAN", 14, FARBEN.pac);
          figur(h, 3, 25, RECHTS, PAC_FORM[2], FARBEN.pac);
          GEISTER.forEach((n, i) => { for (const [dx, dy] of GEIST_FORM[0]) h.set(8 + i * 4 + dx, 25 + dy, FARBEN[n]); h.set(7 + i * 4, 25, FARBEN.augen); });
          if (fdiv(blink, 30) % 2 === 0) zentriert(h, "START", 36, [255, 255, 255]);
        } else if (state === "playing") {
          game.render(h, true);
          if (pause) {
            for (let i = 0; i < h.px.length; i++) h.px[i] >>= 2;
            h.rect(0, 19, HW, 9, SCHWARZ);
            zentriert(h, "PAUSE", 21, [255, 230, 50]);
          }
        } else if (ende <= 60) {
          game.render(h, true);
          textUnterHaus(h, game.lab, "OVER", [255, 0, 0]);
        } else {
          h.fill(SCHWARZ);
          const an = fdiv(blink, 40) % 3 < 2;
          zentriert(h, "GAME", 2, an ? [255, 40, 40] : [120, 20, 20]);
          zentriert(h, "OVER", 8, an ? [255, 40, 40] : [120, 20, 20]);
          zentriert(h, "SCORE", 16, [150, 150, 150]);
          zentriert(h, kurz(game.score), 22, [255, 255, 255]);
          if (neuerRekord) zentriert(h, "NEW", 30, FARBEN.pac);
          else zentriert(h, "BEST", 30, [90, 90, 200]);
          zentriert(h, kurz(Math.max(rekord.get(), game.score)), 36, neuerRekord ? FARBEN.pac : [90, 90, 200]);
          zentriert(h, `L${game.level}`, 42, [80, 80, 80]);
        }
      });
    },
  };
}
