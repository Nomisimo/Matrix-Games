/* ── Spielmenü auf der Matrix ──────────────────────────────────────────────
   Wird in den App-Einstellungen eingeschaltet. Dann öffnet der Start aus der Demo
   (Enter, Leertaste, A oder Start am Gamepad) erst dieses Menü: ↑/↓ wählt das Spiel,
   bei Pong ←/→ den Modus (1P gegen den Computer, 2P zu zweit), Enter/A/Start startet,
   Esc/Select geht zurück zur Demo. key() gibt zurück, was passieren soll:
   { start: id, taste } (Spiel wählen und mit dieser Taste aus der Demo starten) oder
   { zurueck: true }. verfuegbar (Liste von ids) blendet abgewählte Spiele aus. */
import { FONT } from "./mario/index.js";

const ALLE = [
  { id: "snake", name: "SNAKE", farbe: [0, 255, 80] },
  { id: "pong", name: "PONG", farbe: [255, 50, 180] },
  { id: "mario", name: "MARIO", farbe: [255, 70, 50] },
  { id: "tetris", name: "TETRIS", farbe: [190, 60, 255] },
];
const OK = new Set(["Enter", "NumpadEnter", "Space", "Pause", "Digit1", "Numpad1"]);
const ZEILEN = [2, 10, 18];
const dunkel = ([r, g, b]) => [r >> 2, g >> 2, b >> 2];

export function createMenue({ aktuell = "snake", verfuegbar } = {}) {
  const gewaehlt = verfuegbar ? ALLE.filter((e) => verfuegbar.includes(e.id)) : ALLE;
  const EINTRAEGE = gewaehlt.length ? gewaehlt : ALLE;
  let idx = Math.max(0, EINTRAEGE.findIndex((e) => e.id === aktuell)), modus = 1, tick = 0;
  const start = (zwei) => {
    const e = EINTRAEGE[idx];
    if (e.id !== "pong") return { start: e.id, taste: "Enter" };
    return { start: "pong", taste: zwei || modus === 2 ? "Digit2" : "Digit1" };
  };
  return {
    get auswahl() { return EINTRAEGE[idx].id; },
    get modus() { return modus; },
    key(code) {
      if (code === "ArrowUp" || code === "KeyW") idx = (idx + EINTRAEGE.length - 1) % EINTRAEGE.length;
      else if (code === "ArrowDown" || code === "KeyS") idx = (idx + 1) % EINTRAEGE.length;
      else if (EINTRAEGE[idx].id === "pong" && ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(code)) modus = modus === 1 ? 2 : 1;
      else if (code === "Escape") return { zurueck: true };
      // „2“ (oder A/Start an Controller 2) startet Pong zu zweit
      else if (code === "Digit2" || code === "Numpad2") return start(true);
      else if (OK.has(code)) return start(false);
      return null;
    },
    step() { tick++; },
    render(b) {
      b.fill([0, 0, 0]);
      // Drei Zeilen passen auf die Matrix; bei mehr Spielen läuft die Liste mit der Auswahl mit,
      // bei weniger stehen die Zeilen senkrecht mittig
      const erste = Math.max(0, Math.min(idx - 1, EINTRAEGE.length - ZEILEN.length));
      const versatz = Math.max(0, ZEILEN.length - EINTRAEGE.length) * 4;
      EINTRAEGE.slice(erste, erste + ZEILEN.length).forEach((e, j) => {
        const i = erste + j, an = i === idx, y = ZEILEN[j] + versatz;
        const text = e.id === "pong" ? `${e.name} ${modus}P` : e.name;
        FONT.drawText(b, text, 10, y, an ? e.farbe : dunkel(e.farbe));
        // Pfeil vor der Auswahl blinkt langsam
        if (an && Math.floor(tick / 20) % 3 !== 0) FONT.drawText(b, ">", 4, y, [255, 255, 255]);
      });
    },
  };
}
