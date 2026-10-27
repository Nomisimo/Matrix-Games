/* ── Tetris (hochkant) ─────────────────────────────────────────────────────
   Die beiden 24×24-Matrizen stehen übereinander (24×48). Das Spielfeld hat 10×20 Felder
   à 2×2 Pixel, darüber zwei unsichtbare Zeilen, in denen die Steine erscheinen.
   Drehen nach SRS (mit Wandsprüngen), Steine aus dem 7er-Beutel, Schwerkraft und Punkte wie NES,
   Lock-Delay von einer halben Sekunde. Gezeichnet wird hochkant und für die Ausgabe in den
   48×24-Frame gedreht (Richtung über die Option drehung: "rechts" oder "links").
   Zustände: title → playing → game_over → title */
import { Bild, dreheInQuer, fdiv } from "./pixel.js";
import { FONT } from "./mario/index.js";

export const BREITE = 10, HOEHE = 22, VERSTECKT = 2;
export const HW = 24, HH = 48;
// Linke obere Ecke des sichtbaren Spielfelds (Pixel) und Größe eines Feldes
const FX = 2, FY = 7, Z = 2;

const FORMEN = {
  I: ["....", "XXXX", "....", "...."], J: ["X..", "XXX", "..."], L: ["..X", "XXX", "..."],
  O: ["XX", "XX"], S: [".XX", "XX.", "..."], T: [".X.", "XXX", "..."], Z: ["XX.", ".XX", "..."],
};
export const TYPEN = Object.keys(FORMEN);
export const FARBEN = {
  I: [0, 220, 255], J: [40, 90, 255], L: [255, 140, 0], O: [255, 220, 0],
  S: [40, 230, 60], T: [190, 60, 255], Z: [255, 40, 40],
};
// Rahmenfarbe je Level (wiederholt sich)
const RAHMEN = [[70, 70, 90], [40, 90, 140], [40, 120, 70], [130, 90, 30], [120, 40, 110], [140, 40, 40], [60, 120, 130], [110, 110, 40]];
const GRAU = [90, 90, 90], WEISS = [255, 255, 255], SCHWARZ = [0, 0, 0], PUNKTE_FARBE = [255, 255, 255];

// Felder je Drehung: im Uhrzeigersinn wird (x, y) zu (n-1-y, x)
export const ZELLEN = Object.fromEntries(TYPEN.map((t) => {
  const n = FORMEN[t].length;
  let z = [];
  FORMEN[t].forEach((row, y) => [...row].forEach((c, x) => { if (c === "X") z.push([x, y]); }));
  const rots = [];
  for (let r = 0; r < 4; r++) { rots.push(z); z = z.map(([x, y]) => [n - 1 - y, x]); }
  return [t, rots];
}));

/* SRS-Wandsprünge (x nach rechts, y nach oben wie in der Spezifikation; beim Prüfen wird y umgedreht).
   Schlüssel: "von>nach" mit 0, 1 (R), 2, 3 (L). */
const KICK_JLSTZ = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICK_I = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

// Bilder je Zeile für Level 0–29 (NES), danach 1
const FALL = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
export const fallTempo = (level) => FALL[level] ?? 1;
export const LINIEN_PUNKTE = [0, 40, 100, 300, 1200];
const LOCK = 30, LOCK_RESETS = 15, CLEAR_ZEIT = 20, DAS = 10, ARR = 3, SOFT = 2;
const TOPOUT_ZEIT = 46;
// Vorgabe für die Helligkeit des Schatten-Steins (Anteil der Steinfarbe)
export const SCHATTEN = 0.12;

const LINKS = ["ArrowLeft", "KeyA"], RECHTS = ["ArrowRight", "KeyD"], RUNTER = ["ArrowDown", "KeyS"];
const DREHEN_R = new Set(["ArrowUp", "KeyW", "KeyX"]), DREHEN_L = new Set(["KeyZ", "KeyY", "ShiftLeft", "ShiftRight"]);
const haelt = (held, codes) => codes.some((c) => held.has(c));

export class TetrisRunde {
  constructor(ton = () => {}, rnd = Math.random, startLevel = 0) {
    this.ton = ton; this.rnd = rnd;
    this.feld = Array.from({ length: HOEHE }, () => Array(BREITE).fill(null));
    this.beutel = []; this.score = 0; this.lines = 0; this.startLevel = startLevel; this.level = startLevel;
    this.fall = 0; this.lock = 0; this.resets = 0; this.soft = 0;
    this.dasRichtung = 0; this.dasZeit = 0; this.clearing = null; this.tot = false; this.tick = 0;
    this.naechster = this.ziehe();
    this.spawn();
  }
  ziehe() {
    if (!this.beutel.length) {
      this.beutel = [...TYPEN];
      for (let i = this.beutel.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [this.beutel[i], this.beutel[j]] = [this.beutel[j], this.beutel[i]]; }
    }
    return this.beutel.pop();
  }
  zellen(p = this.stein) { return ZELLEN[p.typ][p.rot].map(([x, y]) => [p.x + x, p.y + y]); }
  passt(p) {
    return this.zellen(p).every(([x, y]) => x >= 0 && x < BREITE && y < HOEHE && (y < 0 || !this.feld[y][x]));
  }
  spawn() {
    const typ = this.naechster;
    this.naechster = this.ziehe();
    this.nr = (this.nr || 0) + 1;      // zählt die Steine (die Demo plant je Stein einmal)
    this.stein = { typ, rot: 0, x: typ === "O" ? 4 : 3, y: 0 };
    this.fall = 0; this.lock = 0; this.resets = 0; this.soft = 0;
    if (!this.passt(this.stein)) { this.tot = true; return false; }
    // Gleich eine Zeile tiefer, damit der Stein sofort sichtbar ist
    if (this.passt({ ...this.stein, y: 1 })) this.stein.y = 1;
    return true;
  }
  amBoden() { return !this.passt({ ...this.stein, y: this.stein.y + 1 }); }
  // Erfolgreiche Bewegung am Boden setzt das Lock-Delay zurück (höchstens 15-mal je Stein)
  bewegt() { if (this.resets < LOCK_RESETS && this.lock > 0) { this.lock = 0; this.resets++; } }
  schiebe(dx) {
    if (this.tot || this.clearing) return false;
    const p = { ...this.stein, x: this.stein.x + dx };
    if (!this.passt(p)) return false;
    this.stein = p; this.bewegt(); this.ton("move");
    return true;
  }
  drehe(richtung = 1) {
    if (this.tot || this.clearing || this.stein.typ === "O") return false;
    const von = this.stein.rot, nach = (von + richtung + 4) % 4;
    const kicks = (this.stein.typ === "I" ? KICK_I : KICK_JLSTZ)[`${von}>${nach}`];
    for (const [kx, ky] of kicks) {
      const p = { ...this.stein, rot: nach, x: this.stein.x + kx, y: this.stein.y - ky };
      if (this.passt(p)) { this.stein = p; this.bewegt(); this.ton("rotate"); return true; }
    }
    return false;
  }
  geisterY() {
    let y = this.stein.y;
    while (this.passt({ ...this.stein, y: y + 1 })) y++;
    return y;
  }
  hardDrop() {
    if (this.tot || this.clearing) return;
    const y = this.geisterY();
    this.score += 2 * (y - this.stein.y);
    this.stein.y = y;
    this.ton("drop");
    this.festsetzen();
  }
  festsetzen() {
    const z = this.zellen();
    for (const [x, y] of z) if (y >= 0) this.feld[y][x] = this.stein.typ;
    // Ganz in den unsichtbaren Zeilen abgelegt: Spielende
    if (z.every(([, y]) => y < VERSTECKT)) { this.tot = true; return; }
    const voll = [];
    for (let y = 0; y < HOEHE; y++) if (this.feld[y].every(Boolean)) voll.push(y);
    if (voll.length) {
      this.clearing = { reihen: voll, t: 0 };
      this.score += LINIEN_PUNKTE[voll.length] * (this.level + 1);
      this.ton(voll.length === 4 ? "tetris" : "line");
    } else {
      this.ton("lock");
      this.spawn();
    }
  }
  raeumen() {
    const { reihen } = this.clearing;
    this.feld = this.feld.filter((_, y) => !reihen.includes(y));
    while (this.feld.length < HOEHE) this.feld.unshift(Array(BREITE).fill(null));
    this.lines += reihen.length;
    const lvl = Math.max(this.startLevel, fdiv(this.lines, 10));
    if (lvl > this.level) { this.level = lvl; this.ton("level"); }
    this.clearing = null;
    this.spawn();
  }
  // Ein Bild (1/60 s). held: gedrückte Tasten. Gibt "over" zurück, wenn das Spiel vorbei ist.
  update(held = new Set()) {
    this.tick++;
    if (this.tot) return "over";
    if (this.clearing) {
      if (++this.clearing.t >= CLEAR_ZEIT) this.raeumen();
      return this.tot ? "over" : null;
    }
    // Seitwärts halten: nach DAS Bildern alle ARR Bilder ein Feld
    const l = haelt(held, LINKS), r = haelt(held, RECHTS), dir = l === r ? 0 : l ? -1 : 1;
    if (dir !== this.dasRichtung) { this.dasRichtung = dir; this.dasZeit = 0; }
    else if (dir && ++this.dasZeit >= DAS && (this.dasZeit - DAS) % ARR === 0) this.schiebe(dir);
    // Fallen: Schwerkraft oder schneller mit ↓
    const tempo = haelt(held, RUNTER) ? Math.min(SOFT, fallTempo(this.level)) : fallTempo(this.level);
    if (!this.amBoden()) {
      this.lock = 0;
      if (++this.fall >= tempo) {
        this.fall = 0; this.stein.y++;
        if (tempo === SOFT && haelt(held, RUNTER)) this.score += 1;
      }
    } else {
      this.fall = 0;
      if (++this.lock >= LOCK) this.festsetzen();
    }
    return this.tot ? "over" : null;
  }
  key(code) {
    if (LINKS.includes(code)) { this.schiebe(-1); this.dasRichtung = -1; this.dasZeit = 0; }
    else if (RECHTS.includes(code)) { this.schiebe(1); this.dasRichtung = 1; this.dasZeit = 0; }
    else if (DREHEN_R.has(code)) this.drehe(1);
    else if (DREHEN_L.has(code)) this.drehe(-1);
    else if (code === "Space") this.hardDrop();
  }

  /* Zeichnen auf ein Hochkant-Bild (24×48). hud: Punkte oben links; der nächste Stein steht immer oben rechts.
     schatten: Helligkeit des Schatten-Steins (wo der Stein landet), 0–1 der Steinfarbe; 0 = kein Schatten. */
  render(b, hud = true, schatten = SCHATTEN) {
    b.fill(SCHWARZ);
    const rahmen = this.clearing?.reihen.length === 4 && (this.clearing.t >> 2) % 2 === 0 ? WEISS : RAHMEN[this.level % RAHMEN.length];
    b.rect(FX - 1, FY - 1, 1, HH - FY + 1, rahmen);
    b.rect(FX + BREITE * Z, FY - 1, 1, HH - FY + 1, rahmen);
    b.rect(FX - 1, HH - 1, BREITE * Z + 2, 1, rahmen);
    const feldPx = (x, y, c) => { if (y >= VERSTECKT) b.rect(FX + x * Z, FY + (y - VERSTECKT) * Z, Z, Z, c); };
    // Volle Reihen verschwinden von der Mitte nach außen
    const weg = this.clearing ? Math.min(5, fdiv(this.clearing.t, 4) + 1) : 0;
    for (let y = 0; y < HOEHE; y++) for (let x = 0; x < BREITE; x++) {
      const t = this.feld[y][x];
      if (!t) continue;
      if (this.clearing?.reihen.includes(y) && x >= 5 - weg && x < 5 + weg) continue;
      feldPx(x, y, FARBEN[t]);
    }
    if (!this.clearing && !this.tot) {
      const gy = this.geisterY(), c = FARBEN[this.stein.typ];
      const s = Math.max(0, Math.min(1, +schatten || 0));
      if (s > 0) {
        const geist = c.map((v) => Math.round(v * s));
        for (const [x, y] of this.zellen({ ...this.stein, y: gy })) feldPx(x, y, geist);
      }
      for (const [x, y] of this.zellen()) feldPx(x, y, c);
    }
    // Nächster Stein: kleine Vorschau oben rechts (1 Pixel je Feld)
    const nz = ZELLEN[this.naechster][0];
    const minX = Math.min(...nz.map(([x]) => x)), minY = Math.min(...nz.map(([, y]) => y));
    const breit = Math.max(...nz.map(([x]) => x)) - minX + 1, hoch = Math.max(...nz.map(([, y]) => y)) - minY + 1;
    const ox = 22 - breit + 1, oy = hoch === 1 ? 2 : 1;
    for (const [x, y] of nz) b.set(ox + x - minX, oy + y - minY, FARBEN[this.naechster]);
    if (hud) FONT.drawText(b, kurz(this.score), 1, 0, PUNKTE_FARBE);
  }
}

// Punkte in höchstens 4 Zeichen (links neben der Vorschau ist Platz für 4 Ziffern)
export const kurz = (n) => (n < 10000 ? String(n) : n < 1e6 ? `${Math.floor(n / 1000)}K` : `${Math.floor(n / 1e6)}M`);
/* Zeichnen: Gibt die App schon ein Hochkant-Bild (24×48), wird direkt darauf gezeichnet und die App
   dreht für die Ausgabe. Bei einem 48×24-Bild dreht Tetris selbst (Richtung über drehung). */
const zeichne = (b, hoch, drehung, f) => {
  if (b.w === HW && b.h === HH) return f(b);
  f(hoch);
  dreheInQuer(hoch, b, drehung());
};
const mitte = (t) => fdiv(HW - FONT.textWidth(t), 2);
const zentriert = (b, t, y, c) => FONT.drawText(b, t, mitte(t), y, c);

/* ── Demo: Tetris spielt sich selbst ───────────────────────────────────────
   Für jeden Stein werden alle Drehungen und Spalten durchgerechnet und nach Höhe, Löchern,
   Unebenheit und vollen Reihen bewertet. „Können“ (0–1) macht die Wahl schlechter (öfter
   eine zufällige, gröbere Bewertung) und die Hand langsamer. Ohne Text, ohne Ton. */
const GEWICHT = { hoehe: -0.510066, linien: 0.760666, loecher: -0.35663, uneben: -0.184483 };

export function bewerte(feld) {
  const hoehen = Array(BREITE).fill(0);
  let loecher = 0;
  for (let x = 0; x < BREITE; x++) {
    let oben = false;
    for (let y = 0; y < HOEHE; y++) {
      if (feld[y][x]) { if (!oben) { hoehen[x] = HOEHE - y; oben = true; } }
      else if (oben) loecher++;
    }
  }
  let uneben = 0;
  for (let x = 1; x < BREITE; x++) uneben += Math.abs(hoehen[x] - hoehen[x - 1]);
  return { hoehe: hoehen.reduce((a, b) => a + b, 0), loecher, uneben };
}

// Beste Ablage für den aktuellen Stein: { rot, x, wert }
export function besteAblage(r, koennen = 1, rnd = Math.random) {
  const kandidaten = [];
  const rots = r.stein.typ === "O" ? [0] : [0, 1, 2, 3];
  for (const rot of rots) for (let x = -2; x < BREITE; x++) {
    const p = { typ: r.stein.typ, rot, x, y: 0 };
    if (!r.passt(p)) continue;
    while (r.passt({ ...p, y: p.y + 1 })) p.y++;
    const feld = r.feld.map((row) => [...row]);
    const z = ZELLEN[p.typ][rot].map(([cx, cy]) => [p.x + cx, p.y + cy]);
    for (const [cx, cy] of z) if (cy >= 0) feld[cy][cx] = p.typ;
    const voll = feld.filter((row) => row.every(Boolean)).length;
    const rest = feld.filter((row) => !row.every(Boolean));
    while (rest.length < HOEHE) rest.unshift(Array(BREITE).fill(null));
    const m = bewerte(rest);
    let wert = GEWICHT.hoehe * m.hoehe + GEWICHT.linien * voll + GEWICHT.loecher * m.loecher + GEWICHT.uneben * m.uneben;
    // Schlechtes Können: Bewertung verrauschen
    wert += (rnd() - 0.5) * 6 * (1 - koennen) ** 2;
    kandidaten.push({ rot, x, wert });
  }
  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => b.wert - a.wert);
  // Ab und zu ein Fehlgriff, je geringer das Können, desto öfter
  if (rnd() < Math.max(0, 0.6 - koennen) * 0.3) return kandidaten[Math.floor(rnd() * Math.min(6, kandidaten.length))];
  return kandidaten[0];
}

export function createTetrisDemo({ koennen = () => 1, drehung = () => "rechts", schatten = () => SCHATTEN, rnd = Math.random } = {}) {
  const hoch = new Bild(HW, HH);
  // Startlevel steigt mit dem Können: bei 100 % fallen die Steine schneller
  const neu = () => new TetrisRunde(() => {}, rnd, Math.round(Math.max(0, Math.min(1, koennen())) * 5));
  let r = neu(), plan = null, warte = 0, pause = 0, geplant = 0;
  return {
    step() {
      if (pause > 0) { if (--pause === 0) { r = neu(); plan = null; geplant = 0; } return; }
      const kn = Math.max(0, Math.min(1, koennen()));
      if (r.nr !== geplant && !r.clearing) { geplant = r.nr; plan = besteAblage(r, kn, rnd); warte = 6; }
      // Eine Handbewegung alle paar Bilder: erst drehen, dann schieben, dann fallen lassen
      if (plan && !r.clearing && --warte <= 0) {
        warte = Math.round(9 - 6 * kn);
        const s = r.stein;
        if (s.rot !== plan.rot) { if (!r.drehe(s.rot === (plan.rot + 1) % 4 ? -1 : 1)) plan.rot = s.rot; }
        else if (s.x !== plan.x) { if (!r.schiebe(Math.sign(plan.x - s.x))) plan.x = s.x; }
        else { plan = null; if (kn >= 0.5) r.hardDrop(); }     // ungeschickt: Stein einfach fallen lassen
      }
      if (r.update(new Set()) === "over") pause = 90;
    },
    render(b) { zeichne(b, hoch, drehung, (h) => r.render(h, false, schatten())); },
    get runde() { return r; },
  };
}

// rekord: { get, set } für den gespeicherten Highscore; drehung: () => "rechts" | "links";
// schatten: () => Helligkeit des Schatten-Steins (0–1)
export function createTetris({ ton = () => {}, rekord, drehung = () => "rechts", schatten = () => SCHATTEN } = {}) {
  let state = "title", game = null, blink = 0, neuerRekord = false, eigener = 0, ende = 0;
  rekord ||= { get: () => eigener, set: (n) => { eigener = n; } };
  const hoch = new Bild(HW, HH);
  const neu = () => { game = new TetrisRunde(ton); state = "playing"; ende = 0; };
  return {
    id: "tetris",
    hochkant: true,
    get state() { return state; },
    get score() { return game?.score || 0; },
    get spiel() { return game; },
    key(code) {
      if (state === "title") { if (code === "Space" || code === "Enter") neu(); }
      else if (state === "playing") game.key(code);
      else if (state === "game_over" && ende > TOPOUT_ZEIT) {
        // KeyX: A am Gamepad
        if (code === "Space" || code === "Enter" || code === "KeyX") neu();
        else if (code === "Escape") state = "title";
      }
    },
    step(held = new Set()) {
      blink++;
      if (state === "playing" && game.update(held) === "over") {
        ton("over");
        neuerRekord = game.score > 0 && game.score > rekord.get();
        if (neuerRekord) rekord.set(game.score);
        state = "game_over";
      }
      if (state === "game_over") ende++;
    },
    // pause: Spielbild abgedunkelt mit „PAUSE“ (hochkant, damit es auf der gedrehten Matrix lesbar ist)
    render(b, pause = false) {
      zeichne(b, hoch, drehung, (h) => {
        if (state === "title") {
          h.fill(SCHWARZ);
          zentriert(h, "TETRIS", 8, FARBEN.T);
          TYPEN.forEach((t, i) => { const [x, y] = [2 + (i % 4) * 5, 20 + fdiv(i, 4) * 6]; for (const [cx, cy] of ZELLEN[t][0]) h.set(x + cx, y + cy, FARBEN[t]); });
          if (fdiv(blink, 30) % 2 === 0) zentriert(h, "START", 36, PUNKTE_FARBE);
        } else if (state === "playing") {
          game.render(h, true, schatten());
          if (pause) {
            for (let i = 0; i < h.px.length; i++) h.px[i] >>= 2;
            h.rect(0, 19, HW, 9, SCHWARZ);
            zentriert(h, "PAUSE", 21, [255, 230, 50]);
          }
        } else if (ende <= TOPOUT_ZEIT) {
          // Spielende: das Feld füllt sich von unten grau
          game.render(h, true, schatten());
          const reihen = Math.min(20, fdiv(ende, 2));
          for (let i = 0; i < reihen; i++) h.rect(FX, HH - 1 - (i + 1) * Z, BREITE * Z, Z, GRAU);
        } else {
          h.fill(SCHWARZ);
          const an = fdiv(blink, 40) % 3 < 2;
          zentriert(h, "GAME", 2, an ? [255, 40, 40] : [120, 20, 20]);
          zentriert(h, "OVER", 8, an ? [255, 40, 40] : [120, 20, 20]);
          zentriert(h, "SCORE", 16, [150, 150, 150]);
          zentriert(h, kurz(game.score), 22, PUNKTE_FARBE);
          if (neuerRekord) zentriert(h, "NEW", 30, [255, 220, 0]);
          else zentriert(h, "BEST", 30, [90, 90, 200]);
          zentriert(h, kurz(Math.max(rekord.get(), game.score)), 36, neuerRekord ? [255, 220, 0] : [90, 90, 200]);
          zentriert(h, `L${game.level} ${game.lines}`.slice(0, 6), 42, [80, 80, 80]);
        }
      });
    },
  };
}
