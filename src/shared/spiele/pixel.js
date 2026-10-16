/* ── Spiele: Pixel-Leinwand und Bitmap-Schrift ─────────────────────────────
   Alle Spiele zeichnen auf eine 48×24-Leinwand (zwei LED-Matrizen à 24×24).
   Das Bild ist ein reiner RGB-Puffer ohne DOM, damit es im Test, in der Vorschau
   und für sACN/NDI gleich aussieht. */
export const W = 48, H = 24;

// Python-Ganzzahlen nachbilden: int() schneidet ab, // rundet ab
export const int = Math.trunc;
export const fdiv = (a, b) => Math.floor(a / b);

export class Bild {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }
  fill([r, g, b]) {
    const p = this.px;
    for (let i = 0; i < p.length; i += 3) { p[i] = r; p[i + 1] = g; p[i + 2] = b; }
  }
  // Wie pygame set_at: Punkte außerhalb werden ignoriert
  set(x, y, c) {
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2];
  }
  get(x, y) {
    const i = (y * this.w + x) * 3;
    return [this.px[i], this.px[i + 1], this.px[i + 2]];
  }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  copy(from) { this.px.set(from.px); }
}

/* Schrift aus Glyphen (Zeilen mit „X“/„1“ für gesetzte Pixel). Die drei Python-Spiele
   hatten je eigene Fonts mit leicht anderer Breitenberechnung; das bleibt so, damit
   Zentrierung und Abstände pixelgenau wie im Original sind.
   - luecke: Abstand nach jedem Zeichen
   - endLuecke: Breite zählt den Abstand nach dem letzten Zeichen mit (Pong)
   - fest: feste Breite je Zeichen (Mario: 3 px + 1 px Abstand) */
export function schrift(glyphen, { endLuecke = false, fest = 0 } = {}) {
  const g = (ch) => glyphen[ch] || glyphen[" "];
  const breite = (rows) => rows[0].length;
  const textWidth = (text) => {
    text = String(text).toUpperCase();
    if (fest) return text ? text.length * (fest + 1) - 1 : 0;
    let w = 0;
    [...text].forEach((ch, i) => { w += breite(g(ch)); if (endLuecke || i < text.length - 1) w += 1; });
    return w;
  };
  const drawText = (bild, text, x, y, color) => {
    let cx = x;
    for (const ch of String(text).toUpperCase()) {
      const rows = g(ch);
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === "X" || row[rx] === "1") bild.set(cx + rx, y + ry, color);
      });
      cx += (fest || breite(rows)) + 1;
    }
  };
  return { drawText, textWidth, center: (text) => fdiv(W - textWidth(text), 2) };
}

/* Hochkant-Spiele (z. B. Tetris) zeichnen auf ein Bild von 24×48 (die beiden Matrizen
   übereinander) und drehen es für die Ausgabe in den 48×24-Frame.
   - "rechts": Matrix im Uhrzeigersinn gedreht, oben im Spiel = linke Kante des Frames
   - "links":  Matrix gegen den Uhrzeigersinn gedreht, oben im Spiel = rechte Kante */
export function dreheInQuer(hoch, quer, richtung = "rechts") {
  const hp = hoch.px, qp = quer.px, hw = hoch.w, hh = hoch.h, qw = quer.w;
  const links = richtung === "links";
  for (let py = 0; py < hh; py++) for (let px = 0; px < hw; px++) {
    const qx = links ? hh - 1 - py : py, qy = links ? px : hw - 1 - px;
    const i = (py * hw + px) * 3, j = (qy * qw + qx) * 3;
    qp[j] = hp[i]; qp[j + 1] = hp[i + 1]; qp[j + 2] = hp[i + 2];
  }
}
