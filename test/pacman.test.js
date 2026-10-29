/* ── Pac-Man: Labyrinth und Verhalten der Geister wie im Original ─────────── */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PacRunde, KARTE, MB, MH, pacFrei, START, TUER, ECKEN, OBEN, LINKS, UNTEN, RECHTS,
  modusZeiten, angstDauer, hausGrenze, createPacman, createPacmanDemo, HW, HH,
} from "../src/shared/spiele/pacman.js";
import { SPIELE, Bild } from "../src/shared/spiele/index.js";

const zufall = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const runde = () => new PacRunde(() => {}, zufall());
const laufen = (r) => { r.phase = "laeuft"; r.zeit = 0; };
const alleFrei = (r) => r.geister.forEach((g) => r.losLaufen(g));

test("Pac-Man: Labyrinth ist spiegelgleich, ohne Sackgassen, mit 246 Punkten und 4 Kraftpillen", () => {
  assert.equal(KARTE.length, MH);
  for (const row of KARTE) { assert.equal(row.length, MB); assert.equal(row, [...row].reverse().join("")); }
  const alle = KARTE.join("");
  assert.equal([...alle].filter((c) => c === ".").length, 246);
  assert.equal([...alle].filter((c) => c === "o").length, 4);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
    if (!pacFrei(x, y)) continue;
    const n = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => pacFrei(x + dx, y + dy)).length;
    assert.ok(n >= 2, `Sackgasse bei ${x},${y}`);
  }
  // Tunnel: links hinaus, rechts wieder herein
  assert.ok(pacFrei(-1, 17) && pacFrei(MB, 17));
  assert.ok(pacFrei(START.x, START.y) && pacFrei(TUER.x, TUER.y));
});

test("Pac-Man: Ziele der vier Geister wie im Original (mit dem Fehler nach oben)", () => {
  const r = runde();
  r.modusIdx = 1;   // Chase
  const [blinky, pinky, inky, clyde] = r.geister;
  Object.assign(r.pac, { x: 10, y: 24, dir: RECHTS });
  Object.assign(blinky, { x: 4, y: 20 });
  assert.deepEqual(r.ziel(blinky), { x: 10, y: 24 });
  assert.deepEqual(r.ziel(pinky), { x: 14, y: 24 });
  // Inky: Feld 2 vor Pac-Man (12,24), Blinky daran gespiegelt
  assert.deepEqual(r.ziel(inky), { x: 20, y: 28 });
  // Nach oben: 4 hoch und 4 nach links (Überlauf im Original), bei Inky 2 und 2
  r.pac.dir = OBEN;
  assert.deepEqual(r.ziel(pinky), { x: 6, y: 20 });
  assert.deepEqual(r.ziel(inky), { x: 2 * 8 - 4, y: 2 * 22 - 20 });
  // Clyde: weiter als 8 Felder weg → Pac-Man, sonst seine Ecke
  Object.assign(clyde, { x: 1, y: 36 });
  assert.deepEqual(r.ziel(clyde), { x: 10, y: 24 });
  Object.assign(clyde, { x: 10, y: 30 });
  assert.deepEqual(r.ziel(clyde), ECKEN.clyde);
  // Scatter: jeder in seine Ecke
  r.modusIdx = 0;
  for (const g of r.geister) assert.deepEqual(r.ziel(g), ECKEN[g.name]);
});

test("Pac-Man: Geister wählen den kürzesten Luftlinien-Weg, bei Gleichstand oben vor links vor unten vor rechts", () => {
  const r = runde();
  const g = r.geister[0];
  g.zustand = "frei"; r.modusIdx = 1;
  // Kreuzung (4,6): von unten kommend, Ziel genau oben → oben
  Object.assign(r.pac, { x: 4, y: 1 });
  assert.equal(r.waehle(g, 4, 6, OBEN), OBEN);
  // Ziel rechts unten: rechts ist näher
  Object.assign(r.pac, { x: 9, y: 9 });
  assert.equal(r.waehle(g, 4, 6, RECHTS), RECHTS);
  // Gleich weit nach links und rechts (Ziel genau darunter, unten zu) → links
  Object.assign(r.pac, { x: 11, y: 30 });
  assert.equal(r.waehle(g, 11, 6, OBEN), LINKS);
  // Umkehren ist nie dabei, auch wenn das Ziel hinter dem Geist liegt
  Object.assign(r.pac, { x: 1, y: 6 });
  assert.notEqual(r.waehle(g, 6, 6, RECHTS), LINKS);
});

test("Pac-Man: über dem Geisterhaus biegt kein Geist nach oben ab, außer mit Angst", () => {
  const r = runde();
  const g = r.geister[0];
  g.zustand = "frei"; r.modusIdx = 1;
  Object.assign(r.pac, { x: 10, y: 1, dir: LINKS });
  // (10,14): oben wäre der kürzeste Weg, ist aber gesperrt
  assert.equal(r.waehle(g, 10, 14, LINKS), LINKS);
  assert.equal(r.waehle(g, 9, 14, LINKS), LINKS);
  assert.equal(r.waehle(g, 4, 14, LINKS), OBEN);   // anderswo darf er
});

test("Pac-Man: Scatter und Chase wechseln nach der Tabelle, jeder Wechsel lässt die Geister umdrehen", () => {
  assert.deepEqual(modusZeiten(1), [420, 1200, 420, 1200, 300, 1200, 300]);
  assert.deepEqual(modusZeiten(2).slice(-2), [1033 * 60, 1]);
  assert.equal(modusZeiten(5)[0], 300);
  const r = runde();
  laufen(r); alleFrei(r);
  Object.assign(r.pac, { x: 1, y: 36 });
  for (let i = 0; i < 419; i++) r.update();
  assert.equal(r.modusIdx, 0);
  r.update();
  assert.equal(r.modusIdx, 1);
  assert.ok(r.geister.every((g) => g.umkehren));
  // Bis zur nächsten Feldgrenze haben alle umgedreht
  for (let i = 0; i < 12; i++) r.update();
  assert.ok(r.geister.every((g) => !g.umkehren));
});

test("Pac-Man: Kraftpille macht die Geister blau, die Uhr steht, gefressene Geister bringen 200, 400 …", () => {
  assert.equal(angstDauer(1), 360);
  assert.equal(angstDauer(17), 0);
  assert.equal(angstDauer(30), 0);
  const r = runde();
  laufen(r); alleFrei(r);
  r.modusZeit = 100;
  r.punkte[r.pac.y][r.pac.x] = "o";
  r.fressen();
  assert.equal(r.angstZeit, 360);
  assert.ok(r.geister.every((g) => g.angst && g.umkehren));
  r.update();
  assert.equal(r.modusZeit, 100);   // steht während der Angst
  const g = r.geister[1];
  Object.assign(g, { x: r.pac.x, y: r.pac.y, zustand: "frei" });
  const vor = r.score;
  r.treffen();
  assert.equal(r.score - vor, 200);
  assert.equal(g.zustand, "augen");
  assert.equal(r.phase, "gefressen");
  const h = r.geister[2];
  Object.assign(h, { x: r.pac.x, y: r.pac.y, zustand: "frei", angst: true });
  r.treffen();
  assert.equal(r.score - vor, 600);
});

test("Pac-Man: Augen laufen zurück ins Haus und der Geist kommt wieder heraus", () => {
  const r = runde();
  laufen(r);
  const g = r.geister[0];
  Object.assign(g, { x: 1, y: 36, zustand: "augen", off: 0, dir: OBEN, am: OBEN });
  g.plan = r.waehle(g, 1, 35, OBEN);
  Object.assign(r.pac, { x: 22, y: 1 });
  const seen = new Set();
  for (let i = 0; i < 60 * 20 && !(seen.has("raus") && g.zustand === "frei"); i++) {
    r.bewege(g, r.geschwindigkeit(g), () => { r.geistSchritt(g); });
    seen.add(g.zustand);
  }
  assert.ok(seen.has("rein") && seen.has("raus"));
  assert.equal(g.zustand, "frei");
  assert.deepEqual([g.x, g.y], [TUER.x, TUER.y]);
});

test("Pac-Man: Geisterhaus nach Punkten (Level 1: Inky 30, Clyde 60) und nach einem Leben gemeinsam", () => {
  assert.equal(hausGrenze("pinky", 1), 0);
  assert.equal(hausGrenze("inky", 1), 30);
  assert.equal(hausGrenze("clyde", 1), 60);
  assert.equal(hausGrenze("clyde", 2), 50);
  assert.equal(hausGrenze("inky", 3), 0);
  const r = runde();
  laufen(r);
  const z = (n) => r.geist(n).zustand;
  r.hausPruefen();
  assert.equal(z("pinky"), "raus");
  r.geist("pinky").zustand = "frei";
  for (let i = 0; i < 29; i++) { r.zaehler[r.bevorzugt().name]++; r.hausPruefen(); }
  assert.equal(z("inky"), "haus");
  r.zaehler.inky++; r.hausPruefen();
  assert.equal(z("inky"), "raus");
  // Clyde zählt erst jetzt
  assert.equal(r.zaehler.clyde, 0);
  // Gemeinsamer Zähler nach einem verlorenen Leben
  r.aufstellen(); r.globalAn = true; r.globalZ = 6;
  r.hausPruefen();
  assert.equal(z("pinky"), "haus");
  r.globalZ = 7; r.hausPruefen();
  assert.equal(z("pinky"), "raus");
  // Ohne Punkte kommt nach 4 Sekunden der nächste
  r.seitPunkt = 240; r.hausPruefen();
  assert.equal(z("inky"), "raus");
});

test("Pac-Man: Pac-Man frisst Punkte, hält dabei an und biegt am Abzweig ab", () => {
  const r = runde();
  laufen(r);
  r.geister.forEach((g) => { g.zustand = "haus"; });
  for (let i = 0; i < 60; i++) { r.seitPunkt = 0; r.update(); }
  assert.ok(r.score >= 30, `Punkte ${r.score}`);
  assert.equal(r.pac.y, START.y);
  assert.ok(r.pac.x < START.x);
  r.key("ArrowUp");
  for (let i = 0; i < 120; i++) { r.seitPunkt = 0; r.update(); }
  assert.ok(r.pac.y < START.y, "nach oben abgebogen");
});

test("Pac-Man: Demo spielt und frisst Punkte, mit vollem Können länger als ohne", () => {
  const punkte = (k) => {
    const d = createPacmanDemo({ koennen: () => k, rnd: zufall(7) });
    let best = 0;
    for (let i = 0; i < 60 * 120; i++) { d.step(); best = Math.max(best, d.runde.score); }
    return best;
  };
  const gut = punkte(1), schlecht = punkte(0);
  assert.ok(gut > 1000, `Demo ${gut}`);
  assert.ok(gut >= schlecht, `gut ${gut}, schlecht ${schlecht}`);
});

test("Pac-Man steht in der Spieleliste als Hochkant-Spiel, Spiel und Game Over", () => {
  const def = SPIELE.find((s) => s.id === "pacman");
  assert.ok(def?.hochkant);
  const g = def.create({});
  g.key("Enter");
  assert.equal(g.state, "playing");
  g.pausieren(true);
  assert.equal(g.state, "paused");
  let best = 0;
  const p = createPacman({ rekord: { get: () => best, set: (n) => { best = n; } } });
  p.key("Enter");
  p.spiel.score = 1234; p.spiel.phase = "over";
  p.step();
  assert.equal(p.state, "game_over");
  assert.equal(best, 1234);
  const hoch = new Bild(HW, HH), quer = new Bild();
  p.render(hoch); p.render(quer);
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) assert.deepEqual(quer.get(y, HW - 1 - x), hoch.get(x, y));
});
