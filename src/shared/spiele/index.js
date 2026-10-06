/* ── Spiele für die LED-Matrix (48×24) ─────────────────────────────────────
   Jedes Spiel: key(code) bei Tastendruck, step(held) einmal je Bild (60 fps),
   render(bild). Töne meldet das Spiel über ton(name); die Oberfläche spielt sie ab.

   Startbild: Jedes Spiel beginnt mit einer Demo, in der es sich selbst spielt (ohne Text,
   ohne Ton). Enter/Leertaste startet eine Runde. Zurück zur Demo geht es mit Esc, nach
   einer Runde (Game Over) oder wenn 30 Sekunden lang keine Taste gedrückt wurde. */
import { createSnake, createSnakeDemo } from "./snake.js";
import { createPong, createPongDemo } from "./pong.js";
import { createMario, FONT as MARIO_FONT } from "./mario/index.js";
import { createMarioDemo } from "./mario/demo.js";
export { Bild, W, H } from "./pixel.js";

const FPS = 60;
export const LEERLAUF = 30 * FPS, NACH_RUNDE = 5 * FPS;
const START = new Set(["Enter", "Space", "NumpadEnter"]);

// Spiel mit Demo als Startbild. starte(spiel, code) bringt eine frische Runde direkt ins Spiel.
export function mitDemo({ create, demo, starte, startTasten = START }) {
  return ({ ton = () => {} } = {}) => {
    let modus = "demo", spiel = null, d = demo(), leer = 0, ende = 0;
    const zurDemo = () => { modus = "demo"; spiel = null; d = demo(); ton("_stop"); };
    return {
      get state() { return modus === "demo" ? "demo" : spiel.state; },
      get spiel() { return spiel; },
      key(code) {
        leer = 0;
        if (modus === "demo") {
          if (!startTasten.has(code)) return;
          spiel = create({ ton });
          modus = "spiel"; ende = 0;
          starte(spiel, code);
          return;
        }
        if (code === "Escape") return zurDemo();
        spiel.key(code);
      },
      step(held) {
        if (modus === "demo") return d.step();
        if (held.size) leer = 0;
        spiel.step(held);
        const st = spiel.state;
        // Titelbild des Spiels gibt es nicht mehr: dort steht die Demo
        if (st === "title") return zurDemo();
        if (st === "game_over") { if (++ende > NACH_RUNDE) return zurDemo(); } else ende = 0;
        if (++leer > LEERLAUF) zurDemo();
      },
      render(b) { if (modus === "demo") d.render(b, MARIO_FONT); else spiel.render(b); },
    };
  };
}

export const SPIELE = [
  { id: "snake", name: "Snake",
    create: mitDemo({ create: createSnake, demo: createSnakeDemo, starte: (s) => s.key("Space") }),
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["Pfeile / WASD", "Richtung"], ["P", "Pause"], ["Esc", "zurück zur Demo"]] },
  { id: "pong", name: "Pong",
    create: mitDemo({
      create: createPong, demo: createPongDemo,
      startTasten: new Set([...START, "Digit1", "Digit2", "Numpad1", "Numpad2"]),
      starte: (s, code) => { s.key(/2$/.test(code) ? "Digit2" : "Digit1"); s.key("Space"); },
    }),
    tasten: [["Enter / Leertaste oder 1", "Start gegen den Computer"], ["2", "Start zu zweit"], ["W / S", "linker Schläger"], ["↑ / ↓", "rechter Schläger (2 Spieler)"], ["Esc", "zurück zur Demo"]] },
  { id: "mario", name: "Mario Jump",
    create: mitDemo({ create: createMario, demo: createMarioDemo, starte: (s) => s.key("Enter") }),
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["← / → oder A / D", "Laufen"], ["Leertaste / ↑ / W", "Springen (halten = höher)"], ["Shift / Z / X", "Rennen; als Feuer-Mario Feuerball werfen"], ["↓ / S", "Ducken (groß)"], ["Esc", "zurück zur Demo"]] },
];
