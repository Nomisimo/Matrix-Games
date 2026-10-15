import { CHANGELOG, compareVersions, neuesteVersion } from "../src/shared/version.js";
import pkg from "../package.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import { SPIELE, Bild, LEERLAUF } from "../src/shared/spiele/index.js";
import { createMarioDemo } from "../src/shared/spiele/mario/demo.js";
import { SnakeRunde, TICK_RATES, snakeZug, demoZug, FELDER, Vorhersage, zufall } from "../src/shared/spiele/snake.js";
import { PongRunde, WINNING_SCORE } from "../src/shared/spiele/pong.js";
import { MarioWelt, Goomba, Koopa, GROUND_Y, MARIO_SMALL_H, TILE, weltName } from "../src/shared/spiele/mario/welt.js";
import { genColumn, POLE_COL, TEMPLATE_W } from "../src/shared/spiele/mario/level.js";
import { schrift } from "../src/shared/spiele/pixel.js";
import ausgabe from "../src/main/spiele/ausgabe.js";

/* ── Leinwand & Schrift ─────────────────────────────────────────────────── */
test("Bild ignoriert Pixel außerhalb wie pygame", () => {
  const b = new Bild();
  b.set(-1, 0, [255, 0, 0]); b.set(48, 0, [255, 0, 0]); b.set(0, 24, [255, 0, 0]);
  assert.ok(b.px.every((v) => v === 0));
  b.set(47, 23, [1, 2, 3]);
  assert.deepEqual(b.get(47, 23), [1, 2, 3]);
});

test("Schriftbreiten wie in den drei Python-Fonts", () => {
  const g = { A: ["X.X"], N: ["X..X"], " ": ["..."] };
  assert.equal(schrift(g).textWidth("AN"), 3 + 1 + 4);                  // Snake: ohne Endabstand
  assert.equal(schrift(g, { endLuecke: true }).textWidth("AN"), 3 + 1 + 4 + 1); // Pong: mit Endabstand
  assert.equal(schrift(g, { fest: 3 }).textWidth("AN"), 7);              // Mario: len*4-1
});

/* ── Alle Spiele laufen ohne Fehler ─────────────────────────────────────── */
test("jedes Spiel übersteht 5000 Bilder mit zufälligen Tasten", () => {
  const codes = ["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS", "KeyA", "KeyD", "ShiftLeft", "Digit2", "Escape"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const s of SPIELE) {
    const g = s.create({});
    const b = new Bild();
    const held = new Set();
    for (let i = 0; i < 5000; i++) {
      if (rnd() < 0.05) { const c = codes[Math.floor(rnd() * codes.length)]; if (c !== "Escape" || rnd() < 0.1) g.key(c); held.add(c); }
      if (rnd() < 0.05) held.clear();
      g.step(held);
      g.render(b);
    }
    assert.ok(b.px.some((v) => v > 0), `${s.id} zeichnet etwas`);
  }
});

/* ── Snake ──────────────────────────────────────────────────────────────── */
test("Snake: Futter lässt wachsen, Wand beendet das Spiel", () => {
  const t = [];
  const r = new SnakeRunde((n) => t.push(n), () => 0.5);
  const [hx, hy] = r.head;
  r.food = [hx + 1, hy];
  r.tick();
  assert.equal(r.score, 10);
  assert.equal(r.growth, 2);
  assert.equal(r.body.length, 4);
  assert.deepEqual(t, ["eat"]);
  let dead = false;
  for (let i = 0; i < 60 && !dead; i++) { r.food = null; dead = r.tick(); }
  assert.ok(dead);
  assert.equal(t.at(-1), "die");
});

test("Snake: kein direktes Umkehren, Schwanz darf nachrücken", () => {
  const r = new SnakeRunde(() => {}, () => 0.5);
  r.setDir(-1, 0);
  assert.deepEqual(r.pending, [1, 0]);
  // 2×2-Kreis: Kopf läuft auf das Feld, das der Schwanz gerade verlässt
  r.body = [[10, 10], [11, 10], [11, 11], [10, 11]];
  r.dir = [0, -1]; r.pending = [0, 1]; r.food = null;
  assert.equal(r.tick(), false);
  assert.equal(TICK_RATES[0], 0.2);
});

/* ── Snake: Eingabe-Vorhersage ─────────────────────────────────────────── */
const DT = 1 / 60;
const vhRunde = (seed = 7) => {
  const z = zufall(seed), t = [];
  const g = new SnakeRunde(() => {}, z.rnd);
  g.food = null;
  return { g, vh: new Vorhersage(g, z, (n) => t.push(n)), t };
};
const laufen = (vh, sek, lat) => { let r = null; for (let i = 0; i < Math.round(sek * 60) && !r; i++) r = vh.schritt(DT, lat); return r; };

test("Vorhersage aus: Taste wirkt wie bisher beim nächsten Schritt", () => {
  const { g, vh } = vhRunde();
  laufen(vh, 0.5, 0);
  const vorher = g.head.slice();
  vh.eingabe(0, -1, 0);
  assert.deepEqual(g.head, vorher);          // nichts zurückgerechnet
  laufen(vh, 0.21, 0);
  assert.equal(g.head[0], vorher[0]);
  assert.ok(g.head[1] < vorher[1]);
});

test("Vorhersage: Taste gilt für das Bild von vor der Verzögerung", () => {
  // Zwei gleiche Runden: eine biegt sofort ab, die andere 300 ms später mit 300 ms Ausgleich
  const a = vhRunde(3), b = vhRunde(3);
  laufen(a.vh, 1.0, 0); a.vh.eingabe(0, 1, 0); laufen(a.vh, 0.3, 0);
  laufen(b.vh, 1.0, 0.3); laufen(b.vh, 0.3, 0.3); b.vh.eingabe(0, 1, 0.3);
  assert.deepEqual(b.g.body, a.g.body);
  assert.deepEqual(b.g.dir, [0, 1]);
});

test("Vorhersage: nur gedrückte Tasten, keine Umkehr, Reihenfolge bleibt", () => {
  const { g, vh } = vhRunde();
  laufen(vh, 1.0, 0.2);
  const vorher = g.body.map((p) => p.slice());
  vh.eingabe(-1, 0, 0.2);                    // Umkehr: wird ignoriert
  assert.deepEqual(g.body, vorher);
  vh.eingabe(0, -1, 0.2); vh.eingabe(1, 0, 0.2);   // hoch, dann rechts
  laufen(vh, 0.6, 0.2);
  assert.deepEqual(g.dir, [1, 0]);
  assert.ok(g.head[1] < vorher[0][1]);       // ist erst nach oben gefahren
});

test("Vorhersage: Schlange stirbt erst nach der Verzögerung, rechtzeitige Taste rettet", () => {
  const { g, vh, t } = vhRunde();
  // Bis kurz vor die rechte Wand fahren
  let r = null, n = 0;
  while (g.head[0] < 46 && n++ < 2000) r = vh.schritt(DT, 0.25);
  assert.equal(r, null);
  let tot = false;
  for (let i = 0; i < 20 && !tot; i++) { vh.schritt(DT, 0.25); tot = vh.tot !== null; }
  assert.ok(tot, "an die Wand gestoßen");
  assert.equal(vh.schritt(DT, 0.25), null);  // noch nicht vorbei
  assert.ok(!t.includes("die"));
  vh.eingabe(0, -1, 0.25);                   // für das gesehene Bild noch rechtzeitig
  assert.equal(vh.tot, null);
  assert.equal(laufen(vh, 0.5, 0.25), null);
  assert.deepEqual(g.dir, [0, -1]);          // abgebogen, ohne die Wand zu treffen
  assert.ok(g.head[0] >= 45);
  // ohne Taste ist nach der Verzögerung Schluss
  const b = vhRunde();
  n = 0; while (b.g.head[0] < 46 && n++ < 2000) b.vh.schritt(DT, 0.25);
  assert.equal(laufen(b.vh, 1, 0.25), "dead");
  assert.deepEqual(b.t, ["die"]);
});

test("Vorhersage: Futter liegt nach dem Zurückrechnen gleich", () => {
  // Gleicher Zufall: dieselbe Runde mit und ohne Zurückrechnen hat dasselbe Futter
  const a = vhRunde(11), b = vhRunde(11);
  a.g.spawnFood(); b.g.spawnFood();
  a.g.food = b.g.food = [a.g.head[0] + 2, a.g.head[1] - 4];
  laufen(a.vh, 0.5, 0); a.vh.eingabe(0, -1, 0); laufen(a.vh, 1.5, 0);
  laufen(b.vh, 0.5, 0.3); laufen(b.vh, 0.3, 0.3); b.vh.eingabe(0, -1, 0.3); laufen(b.vh, 1.2, 0.3);
  assert.equal(b.g.score, a.g.score);
  assert.ok(a.g.score > 0);
  assert.deepEqual(b.g.food, a.g.food);
});

/* ── Pong ───────────────────────────────────────────────────────────────── */
test("Pong: Schläger wirft den Ball zurück und beschleunigt ihn", () => {
  const g = new PongRunde(true);
  Object.assign(g.ball, { x: 2.2, y: 10, vx: -0.5, vy: 0 });
  g.left.y = 8;
  g.update(new Set());
  assert.ok(g.ball.vx > 0.5);
  assert.equal(g.ball.x, 2);
});

test("Pong: Punkt rechts, wenn der Ball links hinaus geht", () => {
  const g = new PongRunde(true);
  Object.assign(g.ball, { x: -1.9, y: 2, vx: -0.5, vy: 0 });
  g.left.y = 17;
  assert.equal(g.update(new Set()), 1);
  assert.equal(g.scoreRight, 1);
  assert.equal(WINNING_SCORE, 7);
});

/* ── Mario ──────────────────────────────────────────────────────────────── */
test("Mario steht auf dem Boden und springt", () => {
  const w = new MarioWelt();
  const keys = { left: false, right: false, jump: false, run: false, duck: false };
  for (let i = 0; i < 10; i++) w.update(keys);
  assert.equal(w.mario.y, GROUND_Y - MARIO_SMALL_H);
  assert.ok(w.mario.onGround);
  w.update({ ...keys, jump: true });
  assert.ok(w.mario.vy < 0);
});

test("Mario: ?-Blöcke geben Münzen, besondere einen Pilz", () => {
  const w = new MarioWelt();
  w.activateBlock(13, 2);
  assert.equal(w.getTile(13, 2), "H");
  assert.equal(w.items[0].kind, "coin");
  assert.equal(w.coins, 1);
  w.activateBlock(17, 2);
  assert.equal(w.items.at(-1).kind, "mushroom");
});

test("Mario-Level: Grube, Gegner, Mast und Burg, danach nur Boden", () => {
  assert.equal(genColumn(66)[0][5], " ");      // Grube
  assert.equal(genColumn(20)[1], "goomba");
  assert.equal(genColumn(POLE_COL)[0][4], "F");
  assert.equal(genColumn(POLE_COL)[0][2], "|");
  assert.deepEqual(genColumn(250)[0], [" ", " ", " ", " ", " ", "G"]);
  assert.equal(genColumn(50, 1)[1], null);     // Zusatzgegner erst ab Welt 2
  assert.equal(genColumn(50, 2)[1], "goomba");
});

const KEINE = { left: false, right: false, jump: false, run: false, duck: false };

test("Mario bleibt links im Bild", () => {
  const w = new MarioWelt();
  w.cameraX = 40;
  w.mario.x = 42;
  for (let i = 0; i < 30; i++) w.update({ ...KEINE, left: true });
  assert.ok(w.mario.x >= w.cameraX);
});

test("Mario: Feuerball wirft einen Gumba um", () => {
  const w = new MarioWelt();
  w.enemies = [];
  w.mario.state = "fire"; w.mario.applySize();
  for (let i = 0; i < 5; i++) w.update(KEINE);
  const g = new Goomba(w.mario.x + 14, GROUND_Y - 4);
  w.enemies.push(g);
  w.update({ ...KEINE, run: true });
  assert.equal(w.items.filter((i) => i.kind === "fireball").length, 1);
  for (let i = 0; i < 30; i++) w.update(KEINE);
  assert.ok(g.knocked && !g.alive);
});

test("Mario: Panzer anhalten und wegkicken", () => {
  const k = new Koopa(40, GROUND_Y - 6);
  k.stomp(30);
  assert.ok(k.inShell && !k.shellMoving);
  k.shellKickDelay = 0;
  assert.ok(k.kick(30));
  assert.ok(k.shellMoving && k.vx > 0);
  k.stomp(30);
  assert.ok(!k.shellMoving);
});

test("Mario: am Mast ist die Welt geschafft, danach kommt Welt 1-2", () => {
  const w = new MarioWelt();
  w.enemies = [];
  w.ensureGenerated(TEMPLATE_W);
  w.mario.x = POLE_COL * TILE - 10; w.mario.y = 0; w.cameraX = 700;
  let n = 0;
  while (!w.courseClear && n++ < 2000) w.update({ ...KEINE, right: true });
  assert.ok(w.courseClear, "Ziel nicht erreicht");
  assert.ok(w.score >= 100);
  const score = w.score;
  w.naechsteWelt();
  assert.equal(w.welt, 2);
  assert.equal(weltName(w.welt), "1-2");
  assert.equal(w.score, score);
  assert.ok(!w.courseClear && w.mario.x < 40);
});

test("Mario: auf hohen Blöcken bleibt die Kamera ruhig", () => {
  const w = new MarioWelt();
  w.enemies = [];
  w.ensureGenerated(100);
  w.mario.x = 55 * TILE; w.mario.y = TILE - MARIO_SMALL_H - 2; w.cameraX = 200;   // über der Ziegelreihe in Zeile 1
  for (let i = 0; i < 10; i++) w.update(KEINE);
  const y = w.cameraY;
  for (let i = 0; i < 30; i++) { w.update(KEINE); assert.equal(w.cameraY, y, "Kamera wackelt"); }
});

test("Mario: nach hohem Sprung an den Mast fährt die Kamera zurück, die Burgfahne steigt", () => {
  const w = new MarioWelt();
  w.enemies = [];
  w.ensureGenerated(TEMPLATE_W);
  w.mario.x = POLE_COL * TILE - 7; w.mario.y = -14; w.cameraX = 690; w.cameraY = -14;
  let n = 0;
  while (!(w.ziel && w.ziel.phase === "laufen") && n++ < 500) w.update({ ...KEINE, right: true });
  assert.equal(w.cameraY, 0, "Boden nicht im Bild, während Mario zur Burg läuft");
  while (!w.courseClear && n++ < 2000) w.update(KEINE);
  assert.ok(w.courseClear);
  assert.ok(w.burgFlagge > 0, "Fahne über der Burg ist nicht gestiegen");
});

/* ── Ausgabe: sACN wie sacn_output.py ───────────────────────────────────── */
test("Matrix-Zuordnung: Kacheln spaltenweise, Pixel zeilenweise", () => {
  const b = new Bild();
  b.set(0, 0, [1, 2, 3]);       // Matrix 1, Kachel 0, Pixel 0
  b.set(4, 0, [4, 5, 6]);       // Matrix 1, Kachel 6 (Spalte 1)
  b.set(1, 4, [7, 8, 9]);       // Matrix 1, Kachel 1, Pixel 1
  b.set(24, 0, [10, 11, 12]);   // Matrix 2, erstes Pixel
  const m1 = ausgabe.matrixDmx(b.px, 0), m2 = ausgabe.matrixDmx(b.px, 24);
  assert.equal(m1.length, 1728);
  assert.deepEqual([...m1.slice(0, 3)], [1, 2, 3]);
  assert.deepEqual([...m1.slice(6 * 16 * 3, 6 * 16 * 3 + 3)], [4, 5, 6]);
  assert.deepEqual([...m1.slice((16 + 1) * 3, (16 + 1) * 3 + 3)], [7, 8, 9]);
  assert.deepEqual([...m2.slice(0, 3)], [10, 11, 12]);
});

test("E1.31-Paket: Kopf, Universe, Länge", () => {
  const cid = Buffer.alloc(16, 0xab);
  const p = ausgabe.sacnPaket(29, Buffer.from([1, 2, 3]), 5, cid, "Matrix Games");
  assert.equal(p.length, 129);
  assert.equal(p.toString("latin1", 4, 13), "ASC-E1.17");
  assert.equal(p.readUInt16BE(16), 0x7000 | (110 + 3));
  assert.equal(p.readUInt16BE(113), 29);
  assert.equal(p[111], 5);
  assert.equal(p[108], 100);
  assert.equal(p.readUInt16BE(123), 4);
  assert.deepEqual([...p.slice(126)], [1, 2, 3]);
  assert.equal(ausgabe.multicast(29), "239.255.0.29");
  assert.equal(ausgabe.multicast(300), "239.255.1.44");
});

test("Universes je Matrix: 144 Fixtures → 4 Universes à 432 Kanäle", () => {
  const u = ausgabe.universes(new Uint8Array(1728), 144);
  assert.equal(u.length, 4);
  assert.ok(u.every((c) => c.length === 432));
  assert.equal(ausgabe.universes(new Uint8Array(1728), 170).length, 4);
  assert.equal(ausgabe.universes(new Uint8Array(1728), 170)[3].length, 1728 - 3 * 510);
});

test("NDI-Bild: 10× hochskaliert, BGRA", () => {
  const b = new Bild();
  b.set(0, 0, [10, 20, 30]);
  const f = ausgabe.ndiBild(b.px, 10);
  assert.equal(f.length, 480 * 240 * 4);
  assert.deepEqual([...f.slice(0, 4)], [30, 20, 10, 255]);
  assert.deepEqual([...f.slice(9 * 4, 9 * 4 + 4)], [30, 20, 10, 255]);
  assert.deepEqual([...f.slice(10 * 4, 10 * 4 + 4)], [0, 0, 0, 255]);
  assert.deepEqual([...f.slice((9 * 480) * 4, (9 * 480) * 4 + 4)], [30, 20, 10, 255]);
});

/* ── Versionen (Update-Hinweis) ─────────────────────────────────────────── */
test("Versionen: Betas vor der fertigen Version, neueste aus der Release-Liste", () => {
  assert.ok(compareVersions("1.0.0-beta.2", "1.0.0-beta.1") > 0);
  assert.ok(compareVersions("1.0.0-beta.10", "1.0.0-beta.9") > 0);
  assert.ok(compareVersions("1.0.0", "1.0.0-beta.9") > 0);
  assert.equal(compareVersions("v1.0.0", "1.0.0"), 0);
  const n = neuesteVersion([{ tag_name: "v1.0.0-beta.1" }, { tag_name: "v1.0.0-beta.3", draft: true }, { tag_name: "v1.0.0-beta.2" }]);
  assert.equal(n.tag_name, "v1.0.0-beta.2");
  assert.ok(CHANGELOG[pkg.version], "Changelog-Eintrag für die Version in package.json fehlt");
});

/* ── Demo als Startbild ─────────────────────────────────────────────────── */
test("Demo: jedes Spiel startet als Demo, Enter startet, Esc und Leerlauf führen zurück", () => {
  for (const def of SPIELE) {
    const g = def.create();
    assert.equal(g.state, "demo", def.id);
    const b = new Bild();
    for (let i = 0; i < 600; i++) { g.step(new Set()); g.render(b); }
    assert.ok(b.px.some((v) => v > 0), `${def.id}: Demo zeichnet etwas`);
    g.key("Enter");
    assert.notEqual(g.state, "demo", def.id);
    g.key("Escape");
    assert.equal(g.state, "demo", def.id);
    g.key("Enter");
    for (let i = 0; i <= LEERLAUF; i++) g.step(new Set());
    assert.equal(g.state, "demo", `${def.id}: nach 30 s ohne Taste zurück`);
  }
});

test("Demo: Snake-KI und Mario-Demo kommen voran", () => {
  const s = new SnakeRunde(() => {}, () => 0.37);
  let gefressen = 0;
  for (let i = 0; i < 4000; i++) {
    const m = snakeZug(s); if (m) s.setDir(...m);
    const vorher = s.foodCount;
    if (s.update(1 / 60) === "dead") break;
    gefressen += s.foodCount - vorher;
  }
  assert.ok(gefressen >= 5, `nur ${gefressen} gefressen`);
  const d = createMarioDemo();
  for (let i = 0; i < 60 * 40; i++) d.step();
  assert.ok(d.welt.welt > 1 || d.welt.mario.x > 400, "Mario-Demo kommt nicht voran");
});

test("Demo-Können: Snake füllt bei 100 % das ganze Feld, bei 0 % stirbt sie früh", () => {
  const voll = () => {
    const g = Object.assign(new SnakeRunde(), { ohneHud: true });
    for (let i = 0; i < 400000; i++) {
      const m = demoZug(g, 1);
      if (m) g.setDir(...m);
      if (g.update(1 / 60) === "dead") return g.body.length;
      if (!g.food && g.growth <= 0) break;
    }
    return g.body.length;
  };
  assert.equal(voll(), FELDER, "mit vollem Können muss das Feld ganz voll werden");
  let kurz = 0, rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const g = Object.assign(new SnakeRunde(), { ohneHud: true });
  for (; kurz < 400000; kurz++) {
    const m = demoZug(g, 0, rnd);
    if (m) g.setDir(...m);
    if (g.update(1 / 60) === "dead") break;
  }
  assert.ok(g.body.length < FELDER / 4, `ohne Können wurde die Schlange ${g.body.length} lang`);
});

test("Mario-Demo: gleiches Tempo, kein Rundenende", () => {
  const d = createMarioDemo();
  let maxTempo = 0;
  for (let i = 0; i < 60 * 60 * 3; i++) {
    d.step();
    maxTempo = Math.max(maxTempo, Math.abs(d.welt.mario.vx));
    assert.ok(!d.welt.courseClear && !d.welt.gameOver && !d.welt.ziel, "Demo darf nicht ins Zielbild laufen");
    assert.equal(d.welt.welt, 1, "Demo-Welt soll nicht schneller werden");
  }
  assert.ok(maxTempo <= 0.61, `Mario läuft mit ${maxTempo} zu schnell`);
});
