import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fern from "../src/main/spiele/fernsteuerung.js";

const seitePfad = path.join(process.cwd(), "src", "main", "spiele", "fernsteuerung.html");
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (port, body) => fetch(`http://127.0.0.1:${port}/eingabe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let naechsterPort = 18790;
async function starte() {
  const eingaben = [], status = [];
  const f = fern.createFernsteuerung({ onEingabe: (e) => eingaben.push(e), onStatus: (s) => status.push(s), seitePfad });
  // Freien Port suchen
  let st;
  for (let p = naechsterPort; p < naechsterPort + 100; p++) { st = await f.anwenden({ on: true, port: p, spiel: "Snake", spielId: "snake" }); if (st.on) break; }
  naechsterPort = st.port + 1;   // jeder Test eigener Port: keine alten Keep-Alive-Verbindungen
  return { f, port: st.port, eingaben, status };
}

test("Knopf-Namen und Nummern", () => {
  assert.equal(fern.knopfNr("a"), 0);
  assert.equal(fern.knopfNr("Start"), 9);
  assert.equal(fern.knopfNr("rechts"), 15);
  assert.equal(fern.knopfNr("12"), 12);
  assert.equal(fern.knopfNr("17"), null);
  assert.equal(fern.knopfNr("hüpfen"), null);
  const e = fern.eingabeAus({ tasten: ["Space", "<script>", 5], pads: [{ spieler: 2, knoepfe: [0, "start", 99, 0] }] });
  assert.deepEqual(e, { tasten: ["Space"], pads: [{ spieler: 1, knoepfe: [0, 9] }] });
});

test("Controller-Seite, Status und Eingaben über HTTP", async () => {
  const { f, port, eingaben, status } = await starte();
  try {
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /MATRIX GAMES/);
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/status`)).json(), { ok: true, app: "matrix-games", spiel: "Snake", spielId: "snake" });

    let r = await post(port, { id: "handy1", seq: 2, name: "Android", tasten: [], pads: [{ spieler: 1, knoepfe: [0] }] });
    assert.equal(r.status, 200);
    assert.deepEqual(eingaben.at(-1), { id: "handy1", tasten: [], pads: [{ spieler: 0, knoepfe: [0] }] });
    assert.equal(status.at(-1).controller.length, 1);
    assert.equal(status.at(-1).controller[0].name, "Android");

    // Eine ältere Meldung, die später ankommt, drückt nichts
    await post(port, { id: "handy1", seq: 1, tasten: [], pads: [{ spieler: 1, knoepfe: [15] }] });
    assert.deepEqual(eingaben.at(-1).pads[0].knoepfe, [0]);
    // Gleicher Stand als Herzschlag: keine neue Eingabe
    const n = eingaben.length;
    await post(port, { id: "handy1", seq: 3, tasten: [], pads: [{ spieler: 1, knoepfe: [0] }] });
    assert.equal(eingaben.length, n);

    r = await post(port, { seq: 1 });
    assert.equal(r.status, 400);

    // Meldet sich der Controller nicht mehr, lässt er alles los
    await warte(fern.TIMEOUT_MS + 50);
    f.pruefen();
    assert.deepEqual(eingaben.at(-1), { id: "handy1", tasten: [], pads: [] });
    assert.equal(f.status().controller.length, 0);
  } finally { await f.stop(); }
});

test("/knopf tippt kurz an und hält mit /an bis /aus", async () => {
  const { f, port, eingaben } = await starte();
  try {
    let r = await fetch(`http://127.0.0.1:${port}/knopf/start?spieler=2&dauer=40`);
    assert.equal(r.status, 200);
    assert.deepEqual(eingaben.at(-1).pads, [{ spieler: 1, knoepfe: [9] }]);
    await warte(80);
    assert.deepEqual(eingaben.at(-1).pads, []);

    await fetch(`http://127.0.0.1:${port}/knopf/rechts/an`);
    await warte(fern.TIMEOUT_MS + 50);
    f.pruefen();
    assert.deepEqual(eingaben.at(-1).pads, [{ spieler: 0, knoepfe: [15] }], "gehaltener HTTP-Knopf bleibt gedrückt");
    await fetch(`http://127.0.0.1:${port}/knopf/rechts/aus`);
    assert.deepEqual(eingaben.at(-1).pads, []);

    r = await fetch(`http://127.0.0.1:${port}/knopf/hüpfen`);
    assert.equal(r.status, 400);
  } finally { await f.stop(); }
});

test("Fernsteuerung aus: Port frei, Controller losgelassen", async () => {
  const { f, port, eingaben } = await starte();
  await post(port, { id: "laptop", seq: 1, tasten: ["ArrowLeft"], pads: [] });
  const st = await f.anwenden({ on: false, port });
  assert.equal(st.on, false);
  assert.deepEqual(eingaben.at(-1), { id: "laptop", tasten: [], pads: [] });
  await assert.rejects(fetch(`http://127.0.0.1:${port}/status`));
});
