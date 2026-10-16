/* ── Spiele für die LED-Matrix (48×24) ─────────────────────────────────────
   Jedes Spiel: key(code) bei Tastendruck, step(held) einmal je Bild (60 fps),
   render(bild). Töne meldet das Spiel über ton(name); die Oberfläche spielt sie ab.

   Startbild: Jedes Spiel beginnt mit einer Demo, in der es sich selbst spielt (ohne Text,
   ohne Ton). Enter/Leertaste startet eine Runde. Zurück zur Demo geht es mit Esc, nach
   einer Runde (Game Over) oder wenn eine einstellbare Zeit (Vorgabe 30 s) keine Taste gedrückt wurde.
   „Können“ (0–1) stellt ein, wie gut sich die Demo schlägt (Snake und Pong). */
import { createSnake, createSnakeDemo } from "./snake.js";
import { createPong, createPongDemo } from "./pong.js";
import { createMario, FONT as MARIO_FONT } from "./mario/index.js";
import { createMarioDemo } from "./mario/demo.js";
export { Bild, W, H } from "./pixel.js";

const FPS = 60;
export const LEERLAUF = 30 * FPS, NACH_RUNDE = 5 * FPS;
const START = new Set(["Enter", "Space", "NumpadEnter", "Pause"]);
// „Pause“ ist die Start-Taste am Gamepad; P auf der Tastatur
const PAUSE = new Set(["KeyP", "Pause"]), WEITER = new Set(["KeyP", "Pause", "Space", "Enter", "NumpadEnter"]);
const PAUSE_FARBE = [255, 230, 50];

/* Spiel mit Demo als Startbild. starte(spiel, code) bringt eine frische Runde direkt ins Spiel.
   Optionen beim Anlegen: ton, koennen (0–1, Demo), leerlauf (Sekunden ohne Taste bis zur Demo,
   0 = nie) und rekord ({ get, set }: gespeicherter Highscore). Weitere Optionen gehen an das Spiel.
   Pause gilt für alle Spiele gleich: P oder Start am Gamepad. */
export function mitDemo({ create, demo, starte, startTasten = START }) {
  return ({ ton = () => {}, koennen = () => 1, leerlauf = () => LEERLAUF / FPS, rekord, ...optionen } = {}) => {
    let modus = "demo", spiel = null, d = demo({ koennen }), leer = 0, ende = 0, pause = false;
    // Was über mehrere Runden gilt (z. B. die Siegesserie bei Pong)
    const sitzung = {};
    const zurDemo = () => { modus = "demo"; spiel = null; pause = false; d = demo({ koennen }); ton("_stop"); };
    const pausierbar = () => modus === "spiel" && !["title", "game_over"].includes(spiel.state);
    const setzePause = (p) => {
      if (p === pause || (p && !pausierbar())) return;
      pause = p;
      // Mario: Musik anhalten und beim Weiterspielen neu starten
      if (pause) ton("_stop"); else if (spiel.state === "playing" && spiel.id === "mario") ton("_music");
    };
    return {
      get state() { return modus === "demo" ? "demo" : pause ? "paused" : spiel.state; },
      get spiel() { return spiel; },
      get pausiert() { return pause; },
      pausieren(p = !pause) { leer = 0; setzePause(p); },
      key(code) {
        leer = 0;
        if (modus === "demo") {
          if (!startTasten.has(code)) return;
          spiel = create({ ton, rekord, sitzung, ...optionen });
          modus = "spiel"; ende = 0; pause = false;
          starte(spiel, code);
          return;
        }
        if (code === "Escape") return zurDemo();
        if (pause) { if (WEITER.has(code)) setzePause(false); return; }
        if (PAUSE.has(code)) {
          if (pausierbar()) return setzePause(true);
          code = "Space";            // im Game Over: Start am Gamepad wie Leertaste
        }
        spiel.key(code);
      },
      step(held) {
        if (modus === "demo") return d.step();
        if (pause) return;           // Pause hält auch den Leerlauf an
        if (held.size) leer = 0;
        spiel.step(held);
        const st = spiel.state;
        // Titelbild des Spiels gibt es nicht mehr: dort steht die Demo
        if (st === "title") return zurDemo();
        if (st === "game_over") { if (++ende > NACH_RUNDE) return zurDemo(); } else ende = 0;
        const grenze = Math.round((+leerlauf() || 0) * FPS);
        if (grenze > 0 && ++leer > grenze) zurDemo();
      },
      render(b) {
        if (modus === "demo") return d.render(b, MARIO_FONT);
        spiel.render(b);
        if (pause) pauseBild(b);
      },
    };
  };
}

function pauseBild(b) {
  // Spielbild abdunkeln, darüber „PAUSE“
  for (let i = 0; i < b.px.length; i++) b.px[i] = b.px[i] >> 2;
  const t = "PAUSE", x = MARIO_FONT.center(t), w = MARIO_FONT.textWidth(t);
  b.rect(x - 2, 8, w + 4, 9, [0, 0, 0]);
  MARIO_FONT.drawText(b, t, x, 10, PAUSE_FARBE);
}

const ALLGEMEIN = [["P / Start (Gamepad)", "Pause und weiter"], ["Esc / Select (Gamepad)", "zurück zur Demo"]];

export const SPIELE = [
  { id: "snake", name: "Snake",
    create: mitDemo({ create: createSnake, demo: createSnakeDemo, starte: (s) => s.key("Space") }),
    rekord: "Punkte",
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["Pfeile / WASD", "Richtung"], ...ALLGEMEIN] },
  { id: "pong", name: "Pong",
    create: mitDemo({
      create: createPong, demo: createPongDemo,
      startTasten: new Set([...START, "Digit1", "Digit2", "Numpad1", "Numpad2"]),
      starte: (s, code) => { s.key(/2$/.test(code) ? "Digit2" : "Digit1"); s.key("Space"); },
    }),
    rekord: "Siege in Folge gegen COM",
    tasten: [["Enter / Leertaste oder 1", "Start gegen den Computer"], ["2", "Start zu zweit"], ["W / S", "linker Schläger"], ["↑ / ↓", "rechter Schläger (2 Spieler)"], ...ALLGEMEIN],
    pads: "Controller 1 spielt links, Controller 2 rechts. Drückt Controller 2 auf A oder Start, beginnt eine Runde zu zweit." },
  { id: "mario", name: "Mario Jump",
    create: mitDemo({ create: createMario, demo: createMarioDemo, starte: (s) => s.key("Enter") }),
    rekord: "Punkte",
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["← / → oder A / D", "Laufen"], ["Leertaste / ↑ / W", "Springen (halten = höher)"], ["Shift / Z / X", "Rennen; als Feuer-Mario Feuerball werfen"], ["↓ / S", "Ducken (groß); auf mancher Röhre: hinein in die Bonuswelt"], ...ALLGEMEIN] },
];
