/* ── Matrix drehen: Hochkant-Spiele und Drehsensor ───────────────────────────
   Die Wand aus zwei 24×24-Matrizen steht normal quer (48×24). Für Hochkant-Spiele
   wird die ganze Wand um 90° gedreht, nach links (gegen den Uhrzeigersinn) oder nach
   rechts (im Uhrzeigersinn). Das Spiel zeichnet dann aufrecht auf 24×48, und drehe()
   legt das Bild so in den 48×24-Puffer, wie ihn die Matrizen (sACN/NDI) erwarten:
   - rechts gedreht: Matrix 1 ist oben, Matrix 2 unten
   - links gedreht:  Matrix 2 ist oben, Matrix 1 unten
   Ein Drehsensor meldet, wie die Wand gerade steht (lageAus liest seine Meldung);
   passt das nicht zum gewählten Spiel, zeigt die Matrix drehHinweis() statt des Spiels. */
import { Bild, W, H } from "./pixel.js";
import { FONT } from "./mario/index.js";

export const QUER = [W, H], HOCHKANT = [H, W];
export const RICHTUNGEN = ["rechts", "links"];

// Leinwand eines Spiels: Hochkant-Spiele bekommen 24×48
export const groesse = (spiel) => (spiel?.hochkant ? HOCHKANT : QUER);

/* Aufrechtes Bild (48×24 oder 24×48) → 48×24-Puffer in der Lage der echten Matrizen.
   richtung gilt nur für 24×48: "rechts" (Wand im Uhrzeigersinn gedreht) oder "links". */
export function drehe(bild, richtung = "rechts", out = new Uint8Array(W * H * 3)) {
  if (bild.w === W && bild.h === H) { out.set(bild.px); return out; }
  const src = bild.px, bw = bild.w, links = richtung === "links";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // rechts: Matrix-Spalte x läuft im Bild nach unten, Zeile y von rechts nach links
    const u = links ? y : H - 1 - y, v = links ? W - 1 - x : x;
    const s = (v * bw + u) * 3, d = (y * W + x) * 3;
    out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2];
  }
  return out;
}

/* Meldung eines Drehsensors lesen. Erlaubt sind Wörter oder ein Winkel in Grad
   (im Uhrzeigersinn, gerundet auf 90°):
   quer / landscape / 0 → "quer"; rechts / cw / 90 → "rechts"; links / ccw / 270 / -90 → "links";
   hochkant / portrait → "hochkant" (Richtung unbekannt); kopf / 180 → "kopf". Sonst null. */
const WOERTER = {
  quer: "quer", landscape: "quer", normal: "quer",
  rechts: "rechts", cw: "rechts", right: "rechts",
  links: "links", ccw: "links", left: "links",
  hochkant: "hochkant", portrait: "hochkant", hoch: "hochkant",
  kopf: "kopf", upsidedown: "kopf",
};
export function lageAus(wert) {
  if (wert == null) return null;
  if (typeof wert === "object") return lageAus(wert.lage ?? wert.ausrichtung ?? wert.orientation ?? wert.winkel ?? wert.angle);
  const t = String(wert).trim().toLowerCase().replace(/[\s_]+/g, "");
  if (!t) return null;
  if (WOERTER[t.replace(/-/g, "")]) return WOERTER[t.replace(/-/g, "")];
  const n = Number(t.replace(/°$/, ""));
  if (!Number.isFinite(n)) return null;
  const q = ((Math.round(n / 90) % 4) + 4) % 4;
  return ["quer", "rechts", "kopf", "links"][q];
}

// Steht die Wand passend zum Spiel? null = unbekannt (kein Sensor, keine Meldung)
export function passt(spiel, lage) {
  if (!lage) return null;
  if (lage === "kopf") return false;
  return !!spiel?.hochkant === (lage !== "quer");
}

// Richtung für drehe(): eine Sensor-Meldung mit Richtung hat Vorrang vor der Einstellung
export const richtungAus = (lage, einstellung) => (lage === "links" || lage === "rechts" ? lage : einstellung === "links" ? "links" : "rechts");

/* ── Bilder für die Matrix ─────────────────────────────────────────────── */
const WEISS = [255, 255, 255], GELB = [255, 220, 0], ROT = [255, 40, 40], GRUEN = [0, 220, 80], BLAU = [60, 120, 255];

// Drehpfeil 11×8 im Uhrzeigersinn; gegen den Uhrzeigersinn ist er gespiegelt
const PFEIL_CW = ["..XXXXX....", ".X.....X...", "X.......X..", "X.......X..", "X.....XXXXX", "X......XXX.", ".X......X..", "..XX......."];
function drehpfeil(b, x, y, cw, c) {
  PFEIL_CW.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) if (row[rx] === "X") b.set(cw ? x + rx : x + row.length - 1 - rx, y + ry, c);
  });
}
const mitte = (b, text, y, c) => FONT.drawText(b, text, FONT.center(text, b.w), y, c);

/* Hinweis „Matrix drehen“, aufrecht für die Lage, in der die Wand gerade steht.
   soll: "quer" oder die Richtung, in die die Wand für das Spiel gedreht sein muss;
   richtung: wie eine hochkant stehende Wand gedreht ist (richtungAus).
   Gibt den fertigen 48×24-Puffer zurück. */
export function drehHinweis({ lage, soll, richtung = "rechts", tick = 0 }) {
  const steht = lage === "quer" || lage === "kopf" || !lage ? "quer" : richtung;
  const b = steht === "quer" ? new Bild(...QUER) : new Bild(...HOCHKANT);
  const an = Math.floor(tick / 30) % 2 === 0;
  // Drehsinn, den man an der Wand ausführen muss
  const cw = soll === "quer" ? steht === "links" : lage === "kopf" ? true : soll === "rechts";
  if (b.w === W) {
    mitte(b, "MATRIX", 2, WEISS);
    mitte(b, "DREHEN", 8, an ? GELB : WEISS);
    drehpfeil(b, 18, 15, cw, an ? GELB : [120, 100, 0]);
  } else {
    mitte(b, "MATRIX", 10, WEISS);
    mitte(b, "DREHEN", 18, an ? GELB : WEISS);
    drehpfeil(b, 7, 28, cw, an ? GELB : [120, 100, 0]);
  }
  // Rahmen, damit man den Hinweis auch aus der Entfernung sieht
  for (let x = 0; x < b.w; x++) { b.set(x, 0, ROT); b.set(x, b.h - 1, ROT); }
  // Hochkant füllt „MATRIX“ die volle Breite: dort nur oben und unten ein Rand
  if (b.w === W) for (let y = 0; y < b.h; y++) { b.set(0, y, ROT); b.set(b.w - 1, y, ROT); }
  return drehe(b, steht);
}

/* Testbild zum Aufbau: Nummer jeder Matrix, Pfeil nach oben, rote Ecke oben links.
   Stimmt die Drehrichtung, stehen Pfeil und Zahlen aufrecht. */
export function testbild({ hochkant = false, richtung = "rechts" } = {}) {
  const b = hochkant ? new Bild(...HOCHKANT) : new Bild(...QUER);
  // Wo liegt welche Matrix auf der aufrechten Leinwand?
  const felder = !hochkant ? [[0, 0, 1], [24, 0, 2]] : richtung === "links" ? [[0, 0, 2], [0, 24, 1]] : [[0, 0, 1], [0, 24, 2]];
  for (const [x0, y0, nr] of felder) {
    const c = nr === 1 ? GRUEN : BLAU;
    for (let i = 0; i < 24; i++) { b.set(x0 + i, y0, c); b.set(x0 + i, y0 + 23, c); b.set(x0, y0 + i, c); b.set(x0 + 23, y0 + i, c); }
    FONT.drawText(b, String(nr), x0 + 15, y0 + 9, c);
    // Pfeil nach oben
    for (let i = 0; i < 4; i++) { b.set(x0 + 7 - i, y0 + 7 + i, WEISS); b.set(x0 + 7 + i, y0 + 7 + i, WEISS); }
    for (let yy = y0 + 7; yy < y0 + 18; yy++) b.set(x0 + 7, yy, WEISS);
  }
  b.rect(0, 0, 3, 3, ROT);
  return drehe(b, richtung);
}
