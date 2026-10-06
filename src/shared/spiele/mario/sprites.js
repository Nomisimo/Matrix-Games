/* ── Mario: Pixel-Grafiken (4 px breit, Kacheln 4×4) ──────────────────────
   Jede Grafik ist eine Liste von Zeilen; je Pixel eine Farbe oder null (durchsichtig). */
const P = {
  R: [220, 50, 0], S: [255, 196, 108], B: [20, 80, 200], W: [120, 65, 15],
  G: [0, 180, 0], D: [0, 110, 0], K: [90, 45, 5], k: [60, 28, 3],
  E: [255, 255, 255], Y: [255, 215, 0], y: [180, 145, 0], O: [185, 85, 30],
  o: [75, 30, 8], L: [185, 105, 30], N: [125, 65, 20], n: [65, 30, 5],
  H: [185, 178, 158], h: [132, 126, 107], T: [210, 40, 40], t: [140, 20, 20],
  F: [255, 80, 0], f: [80, 160, 30], C: [60, 155, 60], c: [30, 90, 30],
  g: [0, 120, 0], x: [25, 12, 4], ".": null,
};
const s = (rows) => rows.map((r) => [...r].map((ch) => P[ch]));

// Mario schaut nach rechts: Mütze mit Schirm, Haare hinten, Auge, Schnurrbart, rote Ärmel, blaue Latzhose
export const MARIO_SMALL = {
  idle: s([".RRR", "WSkS", ".SWW", "RBBR", ".BB.", "W..W"]),
  run1: s([".RRR", "WSkS", ".SWW", "SBBR", "B..B", "W..W"]),
  run2: s([".RRR", "WSkS", ".SWW", "RBBS", ".BB.", ".WW."]),
  jump: s([".RRS", "WSkR", ".SWW", "RBB.", "BB.B", "W..."]),
  dead: s([".RR.", "SkkS", ".WW.", "SBBS", ".BB.", "W..W"]),
};
const BIG_TOP = [".RRR", "WSkS", ".SWW", "RRBR", "RBBR", "SBBS"];
export const MARIO_BIG = {
  idle: s([...BIG_TOP, ".BB.", ".BB.", "B..B", "W..W"]),
  run1: s([...BIG_TOP, ".BB.", "BB.B", "B..B", "W..W"]),
  run2: s([...BIG_TOP, ".BB.", ".BB.", ".BBB", ".WW."]),
  jump: s([".RRS", "WSkR", ".SWW", "RRBR", "RBB.", "BBB.", ".BB.", "BB.B", "B..W", "W..."]),
  duck: s([".RRR", "WSkS", ".SWW", "RBBR", "BBBB", "W..W"]),
};
// Feuer-Mario: weiße Mütze und Hemd, rote Latzhose
const umfaerben = (bank, map) => Object.fromEntries(Object.entries(bank).map(([k, sp]) => [k, sp.map((row) => row.map((c) => {
  for (const [von, nach] of map) if (c === von) return nach;
  return c;
}))]));
export const MARIO_FIRE = umfaerben(MARIO_BIG, [[P.R, P.E], [P.B, P.R]]);

export const GOOMBA = {
  walk1: s([".KK.", "EkkE", "KSSK", "kk.."]),
  walk2: s([".KK.", "EkkE", "KSSK", "..kk"]),
  dead: s(["EkkE", "KKKK"]),
};
// Koopa schaut nach rechts (gespiegelt, wenn er nach links läuft)
export const KOOPA = {
  walk1: s(["..SS", "..Sk", "CCcS", "CcC.", "CCC.", "S..S"]),
  walk2: s(["..SS", "..Sk", "CCcS", "CcC.", "CCC.", ".SS."]),
  shell: s([".CC.", "CcCC", "CCcC", "EEEE"]),
};
export const PARATROOPA = {
  walk1: s(["E.SS", "EESk", "CCcS", "CcC.", "CCC.", "S..S"]),
  walk2: s(["..SS", "EESk", "ECcS", "CcC.", "CCC.", ".SS."]),
};
export const PIRANHA = [
  s([".TT.", "TETE", "ETTT", ".TT.", ".ff.", "ffff"]),
  s(["T..T", "TETE", "ETTT", ".TT.", ".ff.", "ffff"]),
];
export const FIREBALL = [s(["FY", "YF"]), s(["YF", "FY"])];
export const MUSHROOM = s([".TT.", "TTtT", "TETE", ".SS.", ".SS."]);
export const FIRE_FLOWER = s([".FF.", "F.F.", ".fF.", ".f..", ".f.."]);
export const COIN = s([".YY.", "YyyY", "YyyY", ".YY."]);
export const STAR = s([".Y.Y", "yYyy", "yYYy", "y.y."]);
export const ONEUP = s([".GG.", "GGgG", "GEGE", ".SS.", ".SS."]);
export const DEBRIS = s(["OO", "Oo"]);

export const T_QUEST2 = s(["YYYY", "Yyyy", "YYYY", "YyyY"]);
export const TILE_MAP = {
  G: s(["LLNL", "NNNN", "NNNn", "nNNn"]),
  H: s(["HhHH", "HHHH", "HHHH", "hHHH"]),
  B: s(["OoOO", "OOOO", "oOOO", "OOOO"]),
  "?": s(["yYYy", "yYyy", "yYYy", "yyyy"]),
  "[": s(["DDGG", "DGGG", "DGGG", "DGGG"]),
  "]": s(["GGDD", "GGGD", "GGGD", "GGGD"]),
  "(": s(["DGGG", "DGGG", "DGGG", "DGGG"]),
  ")": s(["GGGD", "GGGD", "GGGD", "GGGD"]),
  F: s(["HhHH", "HHHH", "hHHH", "HHHH"]),
  // Ziel: Fahnenmast, Burg mit Zinnen und Tor (Hintergrund, nicht fest)
  "|": s([".f..", ".f..", ".f..", ".f.."]),
  "^": s([".f..", "fff.", ".f..", ".f.."]),
  K: s(["OOoO", "oooo", "OoOO", "oooo"]),
  M: s(["O.O.", "OOOO", "OoOO", "oooo"]),
  D: s(["xxxx", "xxxx", "xxxx", "xxxx"]),
  d: s(["Oxxx", "xxxx", "xxxx", "xxxx"]),
  e: s(["xxxO", "xxxx", "xxxx", "xxxx"]),
};
export const FLAG = s(["EEE", ".Ef", "..E"]);

export function drawSprite(bild, sprite, x, y) {
  sprite.forEach((row, ri) => row.forEach((c, ci) => { if (c) bild.set(x + ci, y + ri, c); }));
}
export const flipH = (sprite) => sprite.map((row) => [...row].reverse());
export const flipV = (sprite) => [...sprite].reverse();
