/* ── Pac-Man (hochkant) ────────────────────────────────────────────────────
   Die beiden 24×24-Matrizen stehen übereinander (24×48). Ein Feld ist ein Pixel: Gänge und
   Wände sind je 1 Pixel breit, Pac-Man und die Geister auch. Das Labyrinth (24×38) folgt dem
   Original (gleicher Aufbau, Tunnel, Geisterhaus, 246 Punkte und 4 Kraftpillen statt 240 + 4).
   Oben stehen die Punkte, unten die Leben und die Früchte.

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
   - Geisterhaus: Pinky kommt sofort, Inky nach 30, Clyde nach 60 gefressenen Punkten (Level 1),
     nach einem Leben mit dem gemeinsamen Zähler (7, 17, 32). Frisst Pac-Man 4 s (ab Level 5: 3 s)
     nichts, kommt der nächste Geist heraus.
   - „Cruise Elroy“: Bei wenigen Punkten wird Blinky in zwei Stufen schneller und jagt auch im Scatter.
   - Tempo je Level als Anteil der Höchstgeschwindigkeit, Geister im Tunnel langsamer, Pac-Man hält
     nach jedem Punkt ein Bild an (nach einer Kraftpille drei).
   Gezeichnet wird hochkant und für die Ausgabe in den 48×24-Frame gedreht (wie Tetris).
   Zustände: title → playing → game_over → title */
import { Bild, dreheInQuer, fdiv } from "./pixel.js";
import { FONT } from "./mario/index.js";

export const HW = 24, HH = 48;
// Linke Hälfte des Labyrinths, die rechte ist gespiegelt.
// # Wand, . Punkt, o Kraftpille, Leerzeichen freier Gang, - Tür des Geisterhauses, H Innenraum
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
export const KARTE = HAELFTE.map((r) => r + [...r].reverse().join(""));
export const MB = 24, MH = KARTE.length;
// Lage des Labyrinths auf der Leinwand
const OY = 6;

// Richtungen in der Reihenfolge, in der das Original bei Gleichstand wählt
export const OBEN = 0, LINKS = 1, UNTEN = 2, RECHTS = 3;
const DX = [0, -1, 0, 1], DY = [-1, 0, 1, 0];
const gegen = (d) => (d + 2) % 4;
const TASTEN = {
  ArrowUp: OBEN, KeyW: OBEN, ArrowLeft: LINKS, KeyA: LINKS, ArrowDown: UNTEN, KeyS: UNTEN, ArrowRight: RECHTS, KeyD: RECHTS,
};

// Wichtige Felder
export const START = { x: 11, y: 28 }, TUER = { x: 11, y: 14 }, HAUS_Y = 17;
const FRUCHT = [{ x: 11, y: 20 }, { x: 12, y: 20 }];
const TUNNEL_Y = 17;
// Hier biegen Geister im Scatter und Chase nicht nach oben ab (wie die vier Felder im Original)
const ROT = new Set(["10,14", "13,14", "10,28", "13,28"]);

const zelle = (x, y) => (y < 0 || y >= MH ? "#" : KARTE[y][((x % MB) + MB) % MB]);
export const pacFrei = (x, y) => !"#H-".includes(zelle(x, y));
const geistFrei = (x, y) => !"#H-".includes(zelle(x, y));
const wrap = (x) => ((x % MB) + MB) % MB;

export const GEISTER = ["blinky", "pinky", "inky", "clyde"];
export const FARBEN = {
  blinky: [255, 0, 0], pinky: [255, 120, 200], inky: [0, 230, 255], clyde: [255, 140, 0],
  pac: [255, 220, 0], wand: [25, 25, 140], punkt: [110, 80, 60], pille: [255, 184, 150],
  tuer: [150, 70, 110], angst: [60, 60, 255], blink: [230, 230, 230], augen: [160, 160, 255],
};
// Ecken im Scatter (außerhalb des Labyrinths, wie im Original)
export const ECKEN = { blinky: { x: 21, y: -3 }, pinky: { x: 2, y: -3 }, inky: { x: 23, y: MH }, clyde: { x: 0, y: MH } };
const HEIM = { blinky: 11, pinky: 11, inky: 9, clyde: 13 };

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
  // tempo: Faktor auf alle Geschwindigkeiten (Einstellung, 1 = wie im Original)
  constructor(ton = () => {}, rnd = Math.random, { tempo = () => 1, level = 1 } = {}) {
    this.ton = ton; this.rnd = rnd; this.tempoFaktor = tempo;
    this.score = 0; this.leben = LEBEN; this.extra = false; this.level = level; this.tick = 0;
    this.neuesLevel();
    this.phase = "bereit"; this.zeit = ERSTES_BEREIT;
    this.ton("start");
  }
  neuesLevel() {
    this.punkte = KARTE.map((r) => [...r].map((c) => (c === "." || c === "o" ? c : null)));
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
    this.pac = { x: START.x, y: START.y, dir: LINKS, off: 0, wunsch: null, steht: false, pause: 0, rest: 0 };
    this.geister = GEISTER.map((name) => {
      const g = { name, x: HEIM[name], y: HAUS_Y, dir: name === "pinky" ? UNTEN : OBEN, off: 0, zustand: "haus", angst: false, umkehren: false, am: 0, plan: 0, rest: 0 };
      if (name === "blinky") { g.x = TUER.x; g.y = TUER.y; this.losLaufen(g); }
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
    const n = elroyGrenze(this.level);
    return this.rest <= n / 2 ? 2 : this.rest <= n ? 1 : 0;
  }

  /* Ziel eines Geistes (Feld, auch außerhalb des Labyrinths) */
  ziel(g) {
    if (g.zustand === "augen") return TUER;
    const p = this.pac;
    if (this.scatter && !(g.name === "blinky" && this.elroy)) return ECKEN[g.name];
    if (g.name === "blinky") return { x: p.x, y: p.y };
    // Nach oben rechnet das Original auch nach links (Überlauf-Fehler)
    const vor = (n) => ({ x: p.x + DX[p.dir] * n - (p.dir === OBEN ? n : 0), y: p.y + DY[p.dir] * n });
    if (g.name === "pinky") return vor(4);
    if (g.name === "inky") {
      const v = vor(2), b = this.geist("blinky");
      return { x: 2 * v.x - b.x, y: 2 * v.y - b.y };
    }
    const dx = g.x - p.x, dy = g.y - p.y;
    return dx * dx + dy * dy > 64 ? { x: p.x, y: p.y } : ECKEN.clyde;
  }
  /* Richtung, in die g am Feld (nx, ny) abbiegt, wenn es dort mit Richtung d ankommt */
  waehle(g, nx, ny, d) {
    let wege = [OBEN, LINKS, UNTEN, RECHTS].filter((o) => o !== gegen(d) && geistFrei(nx + DX[o], ny + DY[o]));
    if (g.zustand === "frei" && !g.angst && ROT.has(`${wrap(nx)},${ny}`)) wege = wege.filter((o) => o !== OBEN);
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
    if (g.y === TUNNEL_Y && (g.x <= 3 || g.x >= MB - 4)) return t.tunnel;
    if (g.angst) return t.angst;
    if (g.name === "blinky" && this.elroy) return this.elroy === 2 ? t.elroy2 : t.elroy1;
    return t.geist;
  }
  // Ein Schritt (1/8 Feld) eines Geistes
  geistSchritt(g) {
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
    const p = this.pac, w = p.wunsch;
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
      if (FRUCHT_BEI.includes(this.gefressen)) { this.frucht = FRUCHT_ZEIT; this.fruchtNr++; }
      if (!this.rest) { this.phase = "geschafft"; this.zeit = GESCHAFFT; this.ton("_stop"); }
    }
    if (this.frucht && p.y === FRUCHT[0].y && (p.x === FRUCHT[0].x || p.x === FRUCHT[1].x)) {
      const f = fruchtFuer(this.level);
      this.frucht = 0; this.punkteDazu(f.p); this.ton("fruit");
      this.anzeige = { text: String(f.p), x: 12, y: FRUCHT[0].y, zeit: 120 };
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
      if (this.globalZ >= GLOBAL[g.name]) {
        this.freilassen(g);
        if (g.name === "clyde") { this.globalAn = false; this.globalZ = 0; }
      }
    } else if (this.zaehler[g.name] >= hausGrenze(g.name, this.level)) this.freilassen(g);
    if (g.zustand === "haus" && this.seitPunkt >= (this.level < 5 ? 240 : 180)) { this.freilassen(g); this.seitPunkt = 0; }
  }
  // Treffen sich Pac-Man und ein Geist auf einem Feld? (wie im Original nur gleiches Feld)
  treffen() {
    const p = this.pac;
    for (const g of this.geister) {
      if (g.x !== p.x || g.y !== p.y || g.zustand === "augen" || g.zustand === "rein") continue;
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

  /* Zeichnen auf ein Hochkant-Bild (24×48). hud: Punkte, Leben, Früchte und READY. */
  render(b, hud = true) {
    b.fill(SCHWARZ);
    const geschafft = this.phase === "geschafft" && this.zeit < GESCHAFFT - 60;
    const wand = geschafft && fdiv(this.zeit, 12) % 2 === 0 ? [220, 220, 220] : FARBEN.wand;
    for (const [x, y] of WAND) b.set(x, OY + y, wand);
    if (!geschafft) b.rect(TUER.x, OY + TUER.y + 1, 2, 1, FARBEN.tuer);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
      const c = this.punkte[y][x];
      if (c === ".") b.set(x, OY + y, FARBEN.punkt);
      else if (c === "o" && (this.phase !== "laeuft" || fdiv(this.tick, 10) % 2 === 0)) b.set(x, OY + y, FARBEN.pille);
    }
    if (this.frucht) { const f = fruchtFuer(this.level); b.set(FRUCHT[0].x, OY + FRUCHT[0].y, f.a); b.set(FRUCHT[1].x, OY + FRUCHT[1].y, f.b); }
    const tod = this.phase === "tod" ? TOD - this.zeit : -1;
    // Geister (beim Sterben verschwinden sie nach einer Sekunde, im Levelende sofort)
    if (tod < 60 && this.phase !== "geschafft" && this.phase !== "over") {
      for (const g of this.geister) {
        if (this.anzeige?.geist === g && this.phase === "gefressen") continue;
        const c = g.zustand === "augen" || g.zustand === "rein" ? FARBEN.augen
          : g.angst ? (this.angstBlinkt ? FARBEN.blink : FARBEN.angst) : FARBEN[g.name];
        b.set(g.x, OY + g.y, c);
      }
    }
    // Pac-Man: beim Sterben wird er dunkler und zerplatzt
    const p = this.pac;
    if (this.phase === "gefressen") { /* an seiner Stelle stehen die Punkte */ }
    else if (tod < 0) b.set(p.x, OY + p.y, FARBEN.pac);
    else if (tod < 120) {
      const f = tod < 60 ? 1 : 1 - (tod - 60) / 60;
      b.set(p.x, OY + p.y, FARBEN.pac.map((v) => Math.round(v * f)));
    } else if (tod < 140) {
      const r = tod < 130 ? 1 : 2;
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) b.set(p.x + dx, OY + p.y + dy, [200, 180, 0]);
    }
    if (this.anzeige) {
      const t = this.anzeige.text, w = FONT.textWidth(t);
      const x = Math.max(0, Math.min(HW - w, this.anzeige.x - (w >> 1))), y = Math.max(OY, Math.min(OY + MH - 6, OY + this.anzeige.y - 2));
      b.rect(x - 1, y - 1, w + 2, 7, SCHWARZ);
      FONT.drawText(b, t, x, y, this.anzeige.geist ? FARBEN.inky : [255, 184, 222]);
    }
    if (!hud) return;
    if (this.phase === "bereit") {
      b.rect(1, OY + 19, 22, 7, SCHWARZ);
      FONT.drawText(b, "READY", mitte("READY"), OY + 20, FARBEN.pac);
    }
    FONT.drawText(b, kurz(this.score), 1, 0, [255, 255, 255]);
    // Level oben rechts klein, Leben unten links, Früchte unten rechts
    for (let i = 0; i < Math.min(5, this.leben - (this.phase === "laeuft" || this.phase === "gefressen" ? 1 : 0)); i++) lebenIcon(b, 1 + i * 4, HH - 3);
    for (let i = 0; i < Math.min(4, this.level); i++) {
      const f = fruchtFuer(this.level - i), x = HW - 3 - i * 3;
      b.set(x, HH - 2, f.a); b.set(x + 1, HH - 2, f.b); b.set(x, HH - 1, f.a); b.set(x + 1, HH - 1, f.a);
    }
  }
}

const SCHWARZ = [0, 0, 0];
// Wandpixel: nur Wände neben einem Gang, damit dicke Blöcke als Umriss erscheinen wie im Original
const WAND = [];
for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
  if (KARTE[y][x] !== "#") continue;
  let rand = false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && xx < MB && yy >= 0 && yy < MH && KARTE[yy][xx] !== "#") rand = true;
  }
  if (rand) WAND.push([x, y]);
}
function lebenIcon(b, x, y) {
  // Kleiner Pac-Man mit offenem Mund nach rechts
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 2], [0, 0], [0, 2], [2, 0], [2, 2]]) b.set(x + dx, y + dy, FARBEN.pac);
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
const NACHBARN = [];
for (let i = 0; i < MB * MH; i++) {
  const x = i % MB, y = fdiv(i, MB);
  NACHBARN.push(pacFrei(x, y) ? [0, 1, 2, 3].filter((d) => pacFrei(x + DX[d], y + DY[d])).map((d) => [d, (y + DY[d]) * MB + wrap(x + DX[d])]) : []);
}
function bfs(starts, gesperrt = -1) {
  const dist = new Int16Array(MB * MH).fill(9999), q = [];
  for (const s of starts) if (s >= 0 && s !== gesperrt && dist[s] > 0) { dist[s] = 0; q.push(s); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    for (const [, j] of NACHBARN[i]) if (j !== gesperrt && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
  }
  return dist;
}
export function demoRichtung(r, koennen = 1, rnd = Math.random) {
  const p = r.pac, pi = p.y * MB + p.x, wege = NACHBARN[pi];
  if (!wege.length) return null;
  if (rnd() < (1 - koennen) * 0.25) return wege[Math.floor(rnd() * wege.length)][0];
  const blind = rnd() < (1 - koennen) * 0.6;
  const gefahr = blind ? new Int16Array(MB * MH).fill(9999) : bfs(r.geister.filter((g) => !g.angst && (g.zustand === "frei" || g.zustand === "raus"))
    .flatMap((g) => [g.y * MB + g.x, pacFrei(g.x + DX[g.dir], g.y + DY[g.dir]) ? (g.y + DY[g.dir]) * MB + wrap(g.x + DX[g.dir]) : -1]));
  const blaue = new Set(r.geister.filter((g) => g.angst && g.zustand === "frei").map((g) => g.y * MB + g.x));
  const jagen = r.angstZeit > 90;
  const pillenOk = gefahr[pi] <= 8 || r.rest <= 20;
  let best = null, bw = -Infinity;
  for (const [d, n] of wege) {
    let wert;
    if (gefahr[n] <= 1) wert = -1000 + gefahr[n];
    else {
      const dist = bfs([n], pi);
      let ziel = 9999;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= ziel) continue;
        const c = r.punkte[fdiv(i, MB)][i % MB];
        const gut = (jagen && blaue.has(i)) || ((c === "." || (c === "o" && pillenOk)) && dist[i] + 2 < gefahr[i]);
        if (gut) ziel = dist[i] - (jagen && blaue.has(i) ? 5 : 0);
      }
      wert = (ziel === 9999 ? -50 : -ziel) + 2 * Math.min(gefahr[n], 6);
    }
    if (d === p.dir) wert += 0.5;
    if (wert > bw) { bw = wert; best = d; }
  }
  return best;
}

export function createPacmanDemo({ koennen = () => 1, drehung = () => "rechts", tempo = () => 1, rnd = Math.random } = {}) {
  const hoch = new Bild(HW, HH);
  const neu = () => { const r = new PacRunde(() => {}, rnd, { tempo }); r.zeit = 30; return r; };
  let r = neu(), feld = -1, pause = 0;
  return {
    step() {
      if (pause > 0) { if (--pause === 0) { r = neu(); feld = -1; } return; }
      const p = r.pac, f = p.y * MB + p.x;
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
// tempo: () => Faktor auf alle Geschwindigkeiten (1 = Original)
export function createPacman({ ton = () => {}, rekord, drehung = () => "rechts", tempo = () => 1 } = {}) {
  let state = "title", game = null, blink = 0, neuerRekord = false, eigener = 0, ende = 0;
  rekord ||= { get: () => eigener, set: (n) => { eigener = n; } };
  const hoch = new Bild(HW, HH);
  const neu = () => { game = new PacRunde(ton, Math.random, { tempo }); state = "playing"; ende = 0; };
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
          GEISTER.forEach((n, i) => h.set(6 + i * 4, 24, FARBEN[n]));
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
          h.rect(1, OY + 19, 22, 7, SCHWARZ);
          zentriert(h, "OVER", OY + 20, [255, 0, 0]);
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
