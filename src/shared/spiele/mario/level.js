/* ── Mario: Welt 1-1 mit Fahnenmast und Burg ───────────────────────────────
   Jede Welt ist dieselbe Strecke; am Mast ist sie geschafft und die nächste Welt
   beginnt mit schnelleren und mehr Gegnern. Hinter der Burg kommt nur noch Boden. */
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
// Ab Welt 2 kommen mehr Gegner dazu
const ENEMY_COLS_EXTRA = { 50: "goomba", 70: "para", 86: "goomba", 98: "koopa", 108: "para", 126: "goomba", 152: "goomba", 160: "goomba" };
// Pflanzen: Welt 1 nur in zwei Röhren, danach in allen
export const piranhaPipes = (welt) => (welt <= 1 ? PIPES.filter(([c]) => c === 61 || c === 111) : PIPES);

// Inhalt der Blöcke (Spalte,Zeile): ?-Blöcke geben sonst eine Münze, Ziegel sonst nichts
export const BLOCK_INHALT = {
  "17,2": "power", "48,2": "power", "82,2": "power", "101,2": "power", "147,1": "power",
  "56,1": "muenzen", "104,2": "stern", "120,2": "muenzen", "133,2": "oneup",
};

// → [Kacheln je Zeile, Gegnertyp oder null]
export function genColumn(col, welt = 1) {
  const tiles = col < TEMPLATE_W ? TEMPLATE.map((row) => row[col]) : [...Array(LEVEL_H - 1).fill(" "), "G"];
  return [tiles, ENEMY_COLS[col] || (welt >= 2 && ENEMY_COLS_EXTRA[col]) || null];
}
