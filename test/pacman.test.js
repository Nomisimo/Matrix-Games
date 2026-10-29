/* ── Pac-Man: Labyrinth und Verhalten der Geister wie im Original ─────────── */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PacRunde, KARTE, MB, MH, pacFrei, START, TUER, ECKEN, OBEN, LINKS, UNTEN, RECHTS,
  modusZeiten, angstDauer, hausGrenze, anteil, ALLE_PUNKTE, LABYRINTHE, createPacman, createPacmanDemo, HW, HH,
} from "../src/shared/spiele/pacman.js";
import { SPIELE, Bild } from "../src/shared/spiele/index.js";

const zufall = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const runde = () => new PacRunde(() => {}, zufall());
const laufen = (r) => { r.phase = "laeuft"; r.zeit = 0; };
const alleFrei = (r) => r.geister.forEach((g) => r.losLaufen(g));

test("Pac-Man: Labyrinth ist spiegelgleich, ohne Sackgassen, mit Punkten und 4 Kraftpillen", () => {
  assert.equal(KARTE.length, MH);
  for (const row of KARTE) { assert.equal(row.length, MB); assert.equal(row, [...row].reverse().join("")); }
  const alle = KARTE.join("");
  assert.ok([...alle].filter((c) => c === ".").length > 80);
  assert.equal(ALLE_PUNKTE, [...alle].filter((c) => c === "." || c === "o").length);
  assert.equal([...alle].filter((c) => c === "o").length, 4);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MB; x++) {
    if (!pacFrei(x, y)) continue;
    const n = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => pacFrei(x + dx, y + dy)).length;
    assert.ok(n >= 2, `Sackgasse bei ${x},${y}`);
  }
  // Tunnel: links hinaus, rechts wieder herein
  assert.ok(pacFrei(-1, 20) && pacFrei(MB, 20));
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
  // Kreuzung (6,6): von unten kommend, Ziel genau oben → oben
  Object.assign(r.pac, { x: 6, y: 1 });
  assert.equal(r.waehle(g, 6, 6, OBEN), OBEN);
  // Ziel rechts unten: rechts ist näher
  Object.assign(r.pac, { x: 16, y: 12 });
  assert.equal(r.waehle(g, 6, 6, RECHTS), RECHTS);
  // Gleich weit nach links und rechts (Ziel genau darunter, unten ist hinter ihm) → links
  Object.assign(r.pac, { x: 11, y: 38 });
  assert.equal(r.waehle(g, 11, 29, OBEN), LINKS);
  // Umkehren ist nie dabei, auch wenn das Ziel hinter dem Geist liegt
  Object.assign(r.pac, { x: 1, y: 6 });
  assert.equal(r.waehle(g, 4, 6, RECHTS), RECHTS);
});

test("Pac-Man: über dem Geisterhaus biegt kein Geist nach oben ab, außer mit Angst", () => {
  const r = runde();
  const g = r.geister[0];
  g.zustand = "frei"; r.modusIdx = 1;
  Object.assign(r.pac, { x: 6, y: 1, dir: LINKS });
  // (6,15): oben wäre der kürzeste Weg, ist aber gesperrt
  assert.equal(r.waehle(g, 6, 15, LINKS), LINKS);
  assert.equal(r.waehle(g, 6, 6, LINKS), OBEN);   // anderswo darf er
  g.angst = true;
  assert.ok([OBEN, LINKS].includes(r.waehle(g, 6, 15, LINKS)));
});

test("Pac-Man: Scatter und Chase wechseln nach der Tabelle, jeder Wechsel lässt die Geister umdrehen", () => {
  assert.deepEqual(modusZeiten(1), [420, 1200, 420, 1200, 300, 1200, 300]);
  assert.deepEqual(modusZeiten(2).slice(-2), [1033 * 60, 1]);
  assert.equal(modusZeiten(5)[0], 300);
  const r = runde();
  laufen(r); alleFrei(r);
  Object.assign(r.pac, { x: 2, y: 37 });
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
  Object.assign(g, { x: 2, y: 37, zustand: "augen", off: 0, dir: OBEN, am: OBEN });
  g.plan = r.waehle(g, 2, 36, OBEN);
  Object.assign(r.pac, { x: 20, y: 2 });
  const seen = new Set();
  for (let i = 0; i < 60 * 20 && !(seen.has("raus") && g.zustand === "frei"); i++) {
    r.bewege(g, r.geschwindigkeit(g), () => { r.geistSchritt(g); });
    seen.add(g.zustand);
  }
  assert.ok(seen.has("rein") && seen.has("raus"));
  assert.equal(g.zustand, "frei");
  assert.deepEqual([g.x, g.y], [TUER.x, TUER.y]);
});

test("Pac-Man: Geisterhaus nach Punkten (Level 1: Inky 30, Clyde 60 von 244, anteilig) und nach einem Leben gemeinsam", () => {
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
  for (let i = 0; i < anteil(30) - 1; i++) { r.zaehler[r.bevorzugt().name]++; r.hausPruefen(); }
  assert.equal(z("inky"), "haus");
  r.zaehler.inky++; r.hausPruefen();
  assert.equal(z("inky"), "raus");
  // Clyde zählt erst jetzt
  assert.equal(r.zaehler.clyde, 0);
  // Gemeinsamer Zähler nach einem verlorenen Leben
  r.aufstellen(); r.globalAn = true; r.globalZ = anteil(7) - 1;
  r.hausPruefen();
  assert.equal(z("pinky"), "haus");
  r.globalZ = anteil(7); r.hausPruefen();
  assert.equal(z("pinky"), "raus");
  // Ohne Punkte kommt nach 4 Sekunden der nächste
  r.seitPunkt = 240; r.hausPruefen();
  assert.equal(z("inky"), "raus");
});

test("Pac-Man: Pac-Man frisst Punkte, hält dabei an und biegt am Abzweig ab", () => {
  const r = runde();
  laufen(r);
  r.geister.forEach((g) => { g.zustand = "haus"; });
  for (let i = 0; i < 90; i++) { r.seitPunkt = 0; r.update(); }
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
  assert.ok(gut > 500, `Demo ${gut}`);
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

test("Pac-Man: beide Darstellungen haben ein gültiges Labyrinth, Original mit 246 Punkten", () => {
  for (const L of Object.values(LABYRINTHE)) {
    for (const row of L.karte) assert.equal(row, [...row].reverse().join(""), L.name);
    for (let y = 0; y < L.MH; y++) for (let x = 0; x < L.MB; x++) {
      if (!L.frei(x, y)) continue;
      const n = [[0, -1], [-1, 0], [0, 1], [1, 0]].filter(([dx, dy]) => L.frei(x + dx, y + dy)).length;
      assert.ok(n >= 2, `${L.name}: Sackgasse bei ${x},${y}`);
    }
    assert.ok(L.frei(L.start.x, L.start.y) && L.frei(L.tuer.x, L.tuer.y) && L.frei(-1, L.tunnelY));
    for (const k of L.rot) { const [x, y] = k.split(",").map(Number); assert.ok(L.frei(x, y) && L.frei(x, y - 1), `${L.name}: rotes Feld ${k}`); }
  }
  assert.equal(LABYRINTHE.original.karte.join("").split("").filter((c) => c === ".").length, 246);
  assert.equal(LABYRINTHE.original.anteil(30), 31);
});

test("Pac-Man: Original-Labyrinth spielt sich, Augen finden heim, Umschalten gilt ab der nächsten Runde", () => {
  const d = createPacmanDemo({ labyrinth: () => "original", rnd: zufall(5) });
  let best = 0;
  for (let i = 0; i < 60 * 90; i++) { d.step(); best = Math.max(best, d.runde.score); }
  assert.equal(d.runde.lab.name, "original");
  assert.ok(best > 500, `Demo ${best}`);
  const r = new PacRunde(() => {}, zufall(), { labyrinth: "original" });
  laufen(r);
  const g = r.geister[0];
  Object.assign(g, { x: 1, y: 36, zustand: "augen", off: 0, dir: OBEN, am: OBEN });
  g.plan = r.waehle(g, 1, 35, OBEN);
  for (let i = 0; i < 60 * 20 && g.zustand !== "frei"; i++) r.bewege(g, r.geschwindigkeit(g), () => { r.geistSchritt(g); });
  assert.deepEqual([g.zustand, g.x, g.y], ["frei", r.lab.tuer.x, r.lab.tuer.y]);
  let lab = "gross";
  const p = createPacman({ labyrinth: () => lab });
  p.key("Enter");
  assert.equal(p.spiel.lab.name, "gross");
  lab = "original";
  assert.equal(p.spiel.lab.name, "gross");
  p.spiel.phase = "over"; p.step();
  for (let i = 0; i < 70; i++) p.step();
  p.key("Enter");
  assert.equal(p.spiel.lab.name, "original");
  // Die Demo wechselt sofort
  const demo = createPacmanDemo({ labyrinth: () => lab });
  lab = "gross"; demo.step();
  assert.equal(demo.runde.lab.name, "gross");
});
