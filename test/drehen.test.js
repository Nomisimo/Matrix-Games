import test from "node:test";
import assert from "node:assert/strict";
import { Bild } from "../src/shared/spiele/pixel.js";
import { drehe, lageAus, passt, richtungAus, groesse, drehHinweis, testbild, HOCHKANT } from "../src/shared/spiele/drehen.js";
import { createMenue } from "../src/shared/spiele/menue.js";
import { SPIELE } from "../src/shared/spiele/index.js";
import drehsensor from "../src/main/spiele/drehsensor.js";
import ausgabe from "../src/main/spiele/ausgabe.js";

const px = (buf, x, y) => [...buf.subarray((y * 48 + x) * 3, (y * 48 + x) * 3 + 3)];

test("Querbild geht unverändert an die Matrizen", () => {
  const b = new Bild();
  b.set(5, 7, [1, 2, 3]);
  assert.deepEqual(drehe(b, "links"), b.px);
});

test("Hochkant rechts gedreht: Matrix 1 oben, oben links landet an der Ecke oben rechts der liegenden Wand", () => {
  const b = new Bild(...HOCHKANT);
  b.set(0, 0, [255, 0, 0]);       // oben links auf der aufrechten Wand
  b.set(23, 47, [0, 0, 255]);     // unten rechts
  b.set(0, 24, [0, 255, 0]);      // erstes Pixel der unteren Matrix
  const out = drehe(b, "rechts");
  // Wand im Uhrzeigersinn gedreht: ihre alte linke Kante (x = 0) ist jetzt oben, die alte untere Kante links
  assert.deepEqual(px(out, 0, 23), [255, 0, 0]);
  assert.deepEqual(px(out, 47, 0), [0, 0, 255]);
  assert.deepEqual(px(out, 24, 23), [0, 255, 0]);  // untere Hälfte = Matrix 2 (Spalten 24–47)
});

test("Hochkant links gedreht: Matrix 2 oben", () => {
  const b = new Bild(...HOCHKANT);
  b.set(0, 0, [255, 0, 0]);
  b.set(0, 47, [0, 255, 0]);
  const out = drehe(b, "links");
  assert.deepEqual(px(out, 47, 0), [255, 0, 0]);
  assert.deepEqual(px(out, 0, 0), [0, 255, 0]);
});

test("Drehen ist umkehrbar: jedes Pixel kommt genau einmal an", () => {
  for (const r of ["links", "rechts"]) {
    const b = new Bild(...HOCHKANT);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 24; x++) b.set(x, y, [x, y, 7]);
    const out = drehe(b, r), seen = new Set();
    for (let i = 0; i < out.length; i += 3) seen.add(out[i] * 100 + out[i + 1]);
    assert.equal(seen.size, 24 * 48);
  }
});

test("Sensor-Meldungen: Wörter und Winkel", () => {
  for (const [w, l] of [["quer", "quer"], ["Landscape", "quer"], ["0", "quer"], [360, "quer"], ["rechts", "rechts"], ["90", "rechts"], ["85°", "rechts"],
    ["links", "links"], ["-90", "links"], [270, "links"], ["hochkant", "hochkant"], ["portrait", "hochkant"], ["180", "kopf"], [{ lage: "cw" }, "rechts"], [{ winkel: -95 }, "links"]]) {
    assert.equal(lageAus(w), l, String(JSON.stringify(w)));
    assert.equal(drehsensor.lageAus(w), l, "Hauptprozess: " + JSON.stringify(w));
  }
  for (const w of ["", "schief", null, undefined, "abc90"]) { assert.equal(lageAus(w), null); assert.equal(drehsensor.lageAus(w), null); }
});

test("passt: Querspiel braucht quer, Hochkant-Spiel hochkant", () => {
  const quer = { id: "snake" }, hoch = { id: "tetris", hochkant: true };
  assert.equal(passt(quer, null), null);
  assert.equal(passt(quer, "quer"), true);
  assert.equal(passt(quer, "rechts"), false);
  assert.equal(passt(hoch, "quer"), false);
  assert.equal(passt(hoch, "links"), true);
  assert.equal(passt(hoch, "hochkant"), true);
  assert.equal(passt(hoch, "kopf"), false);
  assert.equal(richtungAus("links", "rechts"), "links");
  assert.equal(richtungAus("hochkant", "links"), "links");
  assert.deepEqual(groesse(hoch), [24, 48]);
  assert.deepEqual(groesse(quer), [48, 24]);
});

test("Hinweis und Testbild liefern einen 48×24-Puffer mit Inhalt", () => {
  for (const a of [{ lage: "quer", soll: "rechts" }, { lage: "rechts", soll: "quer", richtung: "rechts" }, { lage: "kopf", soll: "quer" }]) {
    const out = drehHinweis(a);
    assert.equal(out.length, 48 * 24 * 3);
    assert.ok(out.some((v) => v > 0));
  }
  // Testbild hochkant rechts: rote Ecke oben links der aufrechten Wand = Spalte 0, unterste Zeile
  const t = testbild({ hochkant: true, richtung: "rechts" });
  assert.deepEqual(px(t, 0, 23), [255, 40, 40]);
  assert.deepEqual(px(testbild(), 0, 0), [255, 40, 40]);
});

test("Pause-Einblendung passt auch auf eine Hochkant-Leinwand", () => {
  const g = SPIELE[0].create({});
  g.key("Enter"); g.step(new Set());
  g.pausieren(true);
  const b = new Bild(...HOCHKANT);
  g.render(b);
  assert.equal(g.state, "paused");
});

test("Spielmenü: DREH stellt die Drehrichtung um", () => {
  const m = createMenue({ aktuell: "mario", drehung: "rechts" });
  m.key("ArrowDown");
  assert.equal(m.auswahl, "drehen");
  assert.deepEqual(m.key("ArrowLeft"), { drehung: "links" });
  assert.deepEqual(m.key("Enter"), { drehung: "rechts" });
  assert.equal(m.key("Digit2"), null);
  const b = new Bild();
  m.render(b);   // Liste rollt: DREH ist sichtbar
  assert.ok(b.px.some((v) => v > 0));
});

test("Drehsensor-Endpoint: GET, POST, Fehler und Abschalten", async () => {
  const meldungen = [];
  const d = drehsensor.createDrehsensor((st) => meldungen.push(st));
  const st = await d.anwenden({ on: true, port: 18787, spiel: "tetris", braucht: "hochkant" });
  assert.equal(st.err, "");
  assert.equal(st.on, true);
  const url = "http://127.0.0.1:18787/ausrichtung";
  let r = await (await fetch(url)).json();
  assert.deepEqual([r.lage, r.spiel, r.braucht], [null, "tetris", "hochkant"]);
  r = await (await fetch(url + "?lage=rechts")).json();
  assert.equal(r.lage, "rechts");
  assert.equal(d.status().lage, "rechts");
  r = await (await fetch(url + "/quer")).json();
  assert.equal(r.lage, "quer");
  r = await (await fetch(url, { method: "POST", body: JSON.stringify({ winkel: 270 }) })).json();
  assert.equal(r.lage, "links");
  r = await (await fetch(url, { method: "POST", body: "hochkant" })).json();
  assert.equal(r.lage, "hochkant");
  assert.equal((await fetch(url + "?lage=schief")).status, 400);
  assert.equal((await fetch("http://127.0.0.1:18787/anders")).status, 404);
  assert.ok(meldungen.some((m) => m.lage === "links"));
  // Zweiter Sensor auf demselben Port meldet den Fehler, statt abzustürzen
  const d2 = drehsensor.createDrehsensor();
  assert.match((await d2.anwenden({ on: true, port: 18787 })).err, /belegt/);
  await d.anwenden({ on: false, port: 18787 });
  assert.equal(d.status().on, false);
  assert.equal(d.status().lage, null);
  await assert.rejects(fetch(url));
});

test("Ausgabe-Puffer nach dem Drehen hat die Größe, die sACN erwartet", () => {
  const out = drehe(new Bild(...HOCHKANT), "rechts");
  assert.equal(ausgabe.matrixDmx(out, 0).length, 24 * 24 * 3);
});
