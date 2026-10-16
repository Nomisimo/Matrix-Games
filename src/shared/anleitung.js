/* ── Anleitung als PDF ──────────────────────────────────────────────────────
   Baut eine druckfertige HTML-Seite mit Anleitung, Tastatur- und Gamepad-Belegung, aber nur
   für die Spiele, die in den Einstellungen verfügbar sind. Die Desktop-App macht daraus mit
   printToPDF eine PDF-Datei, im Browser öffnet sich der Druckdialog („Als PDF sichern“).
   Alles kommt aus den Einträgen in SPIELE (tasten, gamepad, ziel, tipps). */

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tabelle = (kopf, zeilen) => !zeilen?.length ? "" :
  `<table><thead><tr><th>${esc(kopf)}</th><th>Funktion</th></tr></thead><tbody>${zeilen.map(([k, f]) => `<tr><td class="k">${esc(k)}</td><td>${esc(f)}</td></tr>`).join("")}</tbody></table>`;

// Spiele, die verfügbar sind: alle außer denen in „aus“. Neue Spiele sind damit von selbst an.
export const verfuegbareSpiele = (spiele, aus = []) => spiele.filter((s) => !aus.includes(s.id));

export function anleitungHtml({ spiele, version = "", menue = false, leerlauf = 30 }) {
  const demo = leerlauf ? `nach ${leerlauf < 60 ? `${leerlauf} Sekunden` : `${leerlauf / 60} Minuten`} ohne Eingabe` : "";
  const abschnitte = spiele.map((s) => `
    <section class="spiel">
      <h2>${esc(s.name)}</h2>
      ${s.ziel ? `<p>${esc(s.ziel)}</p>` : ""}
      <div class="spalten">
        <div><h3>Tastatur</h3>${tabelle("Taste", s.tasten)}</div>
        <div><h3>Gamepad</h3>${tabelle("Taste", s.gamepad)}${s.pads ? `<p class="hinweis">${esc(s.pads)}</p>` : ""}</div>
      </div>
      ${s.tipps?.length ? `<h3>Tipps</h3><ul>${s.tipps.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${s.rekord ? `<p class="hinweis">Highscore zählt: ${esc(s.rekord)}</p>` : ""}
    </section>`).join("");

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Matrix Games – Anleitung</title><style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: #1d232a; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  header { border-bottom: 3px solid #1f9d55; padding-bottom: 8px; margin-bottom: 14px; display: flex; align-items: baseline; gap: 12px; }
  header h1 { margin: 0; font-size: 20pt; color: #1f9d55; letter-spacing: 1px; }
  header span { color: #56616d; font-size: 9.5pt; }
  h2 { font-size: 15pt; margin: 0 0 6px; color: #10151b; border-left: 4px solid #1f9d55; padding-left: 8px; }
  h3 { font-size: 10.5pt; margin: 10px 0 4px; color: #38414b; text-transform: uppercase; letter-spacing: .3px; }
  p { margin: 0 0 6px; }
  .spiel { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e5e9ed; }
  .spalten { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; padding: 4px 6px; border-bottom: 2px solid #d3d9df; color: #56616d; font-size: 8pt; text-transform: uppercase; }
  td { padding: 4px 6px; border-bottom: 1px solid #e5e9ed; vertical-align: top; }
  td.k { font-weight: 600; white-space: nowrap; width: 1%; }
  ul { margin: 0; padding-left: 18px; }
  .hinweis { color: #6f7a86; font-size: 9pt; margin-top: 6px; }
  .allgemein { background: #f6f8fa; border: 1px solid #d3d9df; border-radius: 6px; padding: 10px 12px; margin-bottom: 18px; }
  .allgemein ul { padding-left: 16px; }
</style></head><body>
  <header><h1>MATRIX GAMES</h1><span>Anleitung und Tastenbelegung${version ? ` · Version ${esc(version)}` : ""}</span></header>
  <div class="allgemein">
    <h3 style="margin-top:0">So geht's los</h3>
    <ul>
      <li>Im Startbild spielt sich jedes Spiel als Demo selbst. Enter, die Leertaste, A oder Start am Gamepad beginnt eine Runde.</li>
      ${menue ? `<li>Beim Start öffnet sich das Spielmenü auf der Matrix: ↑/↓ wählt das Spiel${spiele.some((s) => s.id === "pong") ? ", bei Pong ←/→ 1 oder 2 Spieler" : ""}, Enter oder A startet.</li>` : ""}
      <li>P oder Start am Gamepad hält das Spiel an und lässt es weiterlaufen. Esc oder Select geht zurück zur Demo.</li>
      <li>Nach dem Game Over${demo ? ` und ${demo}` : ""} läuft wieder die Demo.</li>
    </ul>
  </div>
  ${abschnitte || "<p>Keine Spiele ausgewählt.</p>"}
</body></html>`;
}
