/* ── Mario: Strecken mit Fahnenmast und Burg ───────────────────────────────
   Welt 1-1 ist die feste Strecke; jede weitere Welt bekommt eine neu erzeugte Karte
   gleicher Länge (Treppe, Mast und Burg am Ende bleiben gleich), mit schnelleren und mehr
   Gegnern. In einer Röhre geht es in eine Bonuswelt unter der Erde, aus einer späteren
   wieder heraus. Hinter der Burg kommt nur noch Boden. */
export const LEVEL_H = 6;
export const TEMPLATE_W = 200, POLE_COL = 186, CASTLE_COL = 189;

function buildTemplate() {
  const grid = Array.from({ length: LEVEL_H }, () => Array(TEMPLATE_W).fill(" "));
  const hline = (row, c0, c1, ch) => { for (let c = c0; c <= c1; c++) grid[row][c] = ch; };
  const pipe = (col, height) => {
    const top = LEVEL_H - 1 - height;
    grid[top][col] = "["; grid[top][col + 1] = "]";
    for (let r = top + 1; r < LEVEL_H - 1; r++) { grid[r][col] = "("; grid[r][col + 1] = ")"; }
  };
  const reihe = (row, c0, chars) => [...chars].forEach((ch, i) => { grid[row][c0 + i] = ch; });

  hline(5, 0, 65, "G");
  hline(5, 68, TEMPLATE_W - 1, "G");   // Grube bei 66–67
  grid[2][13] = "?";
  reihe(2, 16, "B?B?BBB");
  for (const [c, h] of PIPES) pipe(c, h);
  reihe(2, 45, "?BB?BB?B");
  hline(1, 54, 58, "B");
  reihe(2, 77, "BB?BB?BB?B");
  hline(1, 89, 93, "B");
  grid[2][97] = "?"; grid[2][100] = "B"; grid[2][101] = "?"; grid[2][104] = "B"; grid[2][107] = "?";
  hline(2, 115, 120, "B");
  grid[2][117] = "?"; grid[2][119] = "?";
  grid[2][131] = "?"; grid[2][133] = "B"; grid[2][135] = "?";
  hline(1, 145, 149, "B");
  grid[1][147] = "?";
  const treppe = (c0, n, top) => { for (let i = 0; i < n; i++) for (let r = Math.max(0, top(i)); r < 5; r++) grid[r][c0 + i] = "H"; };
  treppe(155, 8, (i) => 4 - i);
  treppe(164, 4, (i) => 4 - (3 - i));
  treppe(172, 8, (i) => 4 - i);
  // Fahnenmast auf einem Sockel, dahinter die Burg mit Zinnen, Fenster und Tor
  grid[0][POLE_COL] = "^";
  for (let r = 1; r < 4; r++) grid[r][POLE_COL] = "|";
  grid[4][POLE_COL] = "F";
  reihe(1, CASTLE_COL, "MMMM");
  reihe(2, CASTLE_COL, "KDKK");
  reihe(3, CASTLE_COL, "KKKK");
  reihe(4, CASTLE_COL, "KdeK");
  return grid;
}
// Röhren: [Spalte, Höhe]; in manchen wohnt eine Piranha-Pflanze
export const PIPES = [[28, 2], [38, 2], [61, 3], [65, 3], [111, 2], [141, 2]];
const TEMPLATE = buildTemplate();

const ENEMY_COLS = {
  20: "goomba", 25: "goomba", 32: "goomba", 36: "goomba", 42: "goomba", 43: "goomba", 60: "goomba",
  72: "goomba", 73: "goomba", 80: "goomba", 90: "koopa", 105: "goomba", 115: "goomba", 116: "goomba",
  125: "para", 132: "goomba", 145: "koopa", 165: "goomba",
};
// Inhalt der Blöcke (Spalte,Zeile): ?-Blöcke geben sonst eine Münze, Ziegel sonst nichts
export const BLOCK_INHALT = {
  "17,2": "power", "48,2": "power", "82,2": "power", "101,2": "power", "147,1": "power",
  "56,1": "muenzen", "104,2": "stern", "120,2": "muenzen", "133,2": "oneup",
};

// Welt 1-1: Pflanzen nur in zwei Röhren; durch die vierte Röhre geht es in die Bonuswelt
export const KLASSISCH = {
  grid: TEMPLATE, gegner: ENEMY_COLS, inhalt: BLOCK_INHALT,
  pflanzen: PIPES.filter(([c]) => c === 61 || c === 111), bonus: { rein: 65, raus: 141 },
};

/* ── Erzeugte Strecken ──────────────────────────────────────────────────── */
const ENDE_COL = 150;     // ab hier Treppe, Mast und Burg wie in 1-1

// Kleiner Zufallsgenerator mit Startwert, damit eine Welt nach einem Leben gleich bleibt
function zufall(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.wahl = (liste) => liste[Math.floor(r() * liste.length)];
  return r;
}

export function erzeugeLevel(welt, seed) {
  const r = zufall(seed);
  const grid = Array.from({ length: LEVEL_H }, () => Array(TEMPLATE_W).fill(" "));
  for (let c = 0; c < TEMPLATE_W; c++) grid[5][c] = "G";
  for (let c = ENDE_COL; c < TEMPLATE_W; c++) for (let row = 0; row < LEVEL_H; row++) grid[row][c] = TEMPLATE[row][c];
  const gegner = {}, inhalt = {}, pipes = [];
  const gegnerTyp = () => (welt >= 3 && r() < 0.2 ? "para" : r() < 0.25 ? "koopa" : "goomba");
  const pipe = (col, h) => {
    const top = LEVEL_H - 1 - h;
    grid[top][col] = "["; grid[top][col + 1] = "]";
    for (let row = top + 1; row < LEVEL_H - 1; row++) { grid[row][col] = "("; grid[row][col + 1] = ")"; }
    pipes.push([col, h]);
  };
  // Blockreihe: ?-Blöcke und Ziegel, ab und zu mit besonderem Inhalt
  const reihe = (row, c0, n) => {
    for (let i = 0; i < n; i++) {
      const c = c0 + i, frage = r() < 0.35;
      grid[row][c] = frage ? "?" : "B";
      if (frage && r() < 0.3) inhalt[`${c},${row}`] = "power";
      else if (!frage && r() < 0.08) inhalt[`${c},${row}`] = r.wahl(["muenzen", "muenzen", "stern", "oneup"]);
    }
  };
  const abschnitte = {
    roehren: (c) => {
      pipe(c, r.int(2, 3));
      if (r() < 0.5) { const c2 = c + 2 + r.int(3, 5); pipe(c2, r.int(2, 3)); return c2 + 2 - c; }
      return 2;
    },
    grube: (c) => {
      const n = welt >= 4 && r() < 0.3 ? 3 : 2;
      for (let i = 0; i < n; i++) grid[5][c + i] = " ";
      return n;
    },
    bloecke: (c) => {
      const n = r.int(3, 6);
      reihe(2, c, n);
      if (r() < 0.5) gegner[c + r.int(0, n - 1)] = gegnerTyp();
      // darüber und versetzt eine zweite Reihe
      if (r() < 0.45) { const n2 = r.int(3, 5); reihe(1, c + n + 1, n2); return n + 1 + n2; }
      return n;
    },
    treppe: (c) => {
      const h = r.int(2, 3), luecke = r() < 0.5 ? 2 : 0;
      for (let i = 0; i < h; i++) for (let row = 4 - i; row < 5; row++) grid[row][c + i] = "H";
      if (luecke) for (let i = 0; i < luecke; i++) grid[5][c + h + i] = " ";
      for (let i = 0; i < h; i++) for (let row = 4 - (h - 1 - i); row < 5; row++) grid[row][c + h + luecke + i] = "H";
      return 2 * h + luecke;
    },
    gegner: (c) => {
      const n = Math.min(4, r.int(1, 2) + (welt >= 3 ? 1 : 0));
      for (let i = 0; i < n; i++) gegner[c + i * 2] = gegnerTyp();
      return n * 2;
    },
  };
  const arten = ["roehren", "roehren", "grube", "bloecke", "bloecke", "bloecke", "treppe", "gegner", "gegner"];
  // Zwei Röhren sind fest eingeplant: rein in die Bonuswelt und wieder heraus
  const bonus = { rein: r.int(34, 60), raus: r.int(112, 132) };
  grid[2][r.int(7, 10)] = "?";
  const plan = [[bonus.rein, r.int(2, 3)], [bonus.raus, 2]];
  let c = 16;
  while (c < ENDE_COL - 6) {
    const naechste = plan[0], grenze = naechste ? naechste[0] - 2 : ENDE_COL - 6;
    if (naechste && c >= grenze) {
      pipe(naechste[0], naechste[1]);
      c = naechste[0] + 2 + r.int(3, 5);
      plan.shift();
      continue;
    }
    // nicht in die eingeplanten Röhren hineinbauen
    const frei = grenze - c;
    if (frei < 9) { c = grenze; continue; }
    const w = abschnitte[frei < 14 ? "gegner" : r.wahl(arten)](c);
    c = Math.min(c + w + r.int(3, 5), grenze);
  }
  // Gegner nur auf freiem Boden und nicht direkt an einer Grube
  for (const col of Object.keys(gegner).map(Number)) {
    let grube = false;
    for (let d = -4; d <= 4; d++) if (grid[5][col + d] === " ") grube = true;
    if (grube || grid[4][col] !== " " || grid[3][col] !== " ") delete gegner[col];
  }
  if (welt >= 2) gegner[165] = "goomba";
  // Pflanzen in allen Röhren außer den beiden Bonus-Röhren
  const pflanzen = pipes.filter(([col]) => col !== bonus.rein && col !== bonus.raus);
  return { grid, gegner, inhalt, pflanzen, bonus, seed };
}

// Welt 1 ist die feste Strecke, danach wird erzeugt
export const levelFuer = (welt, seed) => (welt <= 1 ? KLASSISCH : erzeugeLevel(welt, seed));

// → [Kacheln je Zeile, Gegnertyp oder null]
export function genColumn(col, level = KLASSISCH) {
  const tiles = col < TEMPLATE_W ? level.grid.map((row) => row[col]) : [...Array(LEVEL_H - 1).fill(" "), "G"];
  return [tiles, level.gegner[col] || null];
}

/* ── Bonuswelt unter der Erde ───────────────────────────────────────────── */
// Von oben fällt Mario hinein; zwei Reihen Münzen, rechts führt eine liegende Röhre wieder hinaus
export const BONUS_W = 16, BONUS_RAUS = 13;
export const BONUS_GRID = [
  "U  UUUUUUUUUUUUU",
  "U              U",
  "U   ooooooo    U",
  "U            {=U",
  "U  ooooooooo }_U",
  "GGGGGGGGGGGGGGGG",
].map((z) => [...z]);
