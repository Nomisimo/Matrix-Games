/* ── Spiele für die LED-Matrix (48×24) ─────────────────────────────────────
   Jedes Spiel: key(code) bei Tastendruck, step(held) einmal je Bild (60 fps),
   render(bild). Ein Eintrag mit hochkant: true bekommt eine 24×48-Leinwand; die App dreht
   das Bild dann für die gedrehte Wand (drehen.js). Töne meldet das Spiel über ton(name); die Oberfläche spielt sie ab.

   Startbild: Jedes Spiel beginnt mit einer Demo, in der es sich selbst spielt (ohne Text,
   ohne Ton). Enter/Leertaste startet eine Runde. Zurück zur Demo geht es mit Esc, nach
   einer Runde (Game Over) oder wenn eine einstellbare Zeit (Vorgabe 30 s) keine Taste gedrückt wurde.
   „Können“ (0–1) stellt ein, wie gut sich die Demo schlägt (Snake und Pong). */
import { createSnake, createSnakeDemo } from "./snake.js";
import { createPong, createPongDemo } from "./pong.js";
import { createMario, FONT as MARIO_FONT } from "./mario/index.js";
import { createMarioDemo } from "./mario/demo.js";
import { createTetris, createTetrisDemo } from "./tetris.js";
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
    let modus = "demo", spiel = null, d = demo({ koennen, ...optionen }), leer = 0, ende = 0, pause = false;
    // Was über mehrere Runden gilt (z. B. die Siegesserie bei Pong)
    const sitzung = {};
    const zurDemo = () => { modus = "demo"; spiel = null; pause = false; d = demo({ koennen, ...optionen }); ton("_stop"); };
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
        // Hochkant-Spiele zeichnen die Pause selbst, damit „PAUSE“ auf der gedrehten Matrix lesbar ist
        spiel.render(b, pause);
        if (pause && !spiel.hochkant) pauseBild(b);
      },
    };
  };
}

function pauseBild(b) {
  // Spielbild abdunkeln, darüber „PAUSE“
  for (let i = 0; i < b.px.length; i++) b.px[i] = b.px[i] >> 2;
  const t = "PAUSE", x = MARIO_FONT.center(t, b.w), w = MARIO_FONT.textWidth(t), y = (b.h >> 1) - 2;
  b.rect(x - 2, y - 2, w + 4, 9, [0, 0, 0]);
  MARIO_FONT.drawText(b, t, x, y, PAUSE_FARBE);
}

const ALLGEMEIN = [["P / Start (Gamepad)", "Pause und weiter"], ["Esc / Select (Gamepad)", "zurück zur Demo"]];
const PAD_ALLGEMEIN = [["Start", "Pause und weiter (aus der Demo: Start)"], ["Select", "zurück zur Demo"]];

/* Je Spiel: tasten (Tastatur) und gamepad für die Tabelle in der App und die PDF-Anleitung,
   ziel (worum es geht) und tipps nur für die Anleitung. Ein neues Spiel braucht nur einen
   Eintrag hier, dann taucht es in der Spieleauswahl und in der Anleitung auf. */

export const SPIELE = [
  { id: "snake", name: "Snake",
    create: mitDemo({ create: createSnake, demo: createSnakeDemo, starte: (s) => s.key("Space") }),
    rekord: "Punkte",
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["Pfeile / WASD", "Richtung"], ...ALLGEMEIN],
    gamepad: [["A", "Start (aus der Demo)"], ["Steuerkreuz / linker Stick", "Richtung"], ...PAD_ALLGEMEIN],
    ziel: "Steuere die Schlange über das Feld und friss das Futter. Mit jedem Happen wird sie länger. Die Runde endet, wenn die Schlange gegen die Wand oder sich selbst fährt.",
    tipps: ["Die Schlange kann nicht direkt umkehren."] },
  { id: "pong", name: "Pong",
    create: mitDemo({
      create: createPong, demo: createPongDemo,
      startTasten: new Set([...START, "Digit1", "Digit2", "Numpad1", "Numpad2"]),
      starte: (s, code) => { s.key(/2$/.test(code) ? "Digit2" : "Digit1"); s.key("Space"); },
    }),
    rekord: "Siege in Folge gegen COM",
    tasten: [["Enter / Leertaste oder 1", "Start gegen den Computer"], ["2", "Start zu zweit"], ["W / S", "linker Schläger"], ["↑ / ↓", "rechter Schläger (2 Spieler)"], ...ALLGEMEIN],
    gamepad: [["A oder Start an Controller 1", "Start gegen den Computer"], ["A oder Start an Controller 2", "Start zu zweit"], ["Controller 1: Steuerkreuz ↑ / ↓", "linker Schläger"], ["Controller 2: Steuerkreuz ↑ / ↓", "rechter Schläger"], ...PAD_ALLGEMEIN],
    pads: "Controller 1 spielt links, Controller 2 rechts. Drückt Controller 2 auf A oder Start, beginnt eine Runde zu zweit.",
    ziel: "Schlage den Ball mit deinem Schläger zurück. Geht der Ball an einem Schläger vorbei, bekommt die andere Seite den Punkt. Allein spielst du links gegen den Computer, zu zweit spielt jeder eine Seite.",
    tipps: ["Der Ball wird mit jedem Treffer schneller.", "Die Stärke des Computers lässt sich in den Einstellungen ändern."] },
  { id: "mario", name: "Mario Jump",
    create: mitDemo({ create: createMario, demo: createMarioDemo, starte: (s) => s.key("Enter") }),
    rekord: "Punkte",
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["← / → oder A / D", "Laufen"], ["Leertaste / ↑ / W", "Springen (halten = höher)"], ["Shift / Z / X", "Rennen; als Feuer-Mario Feuerball werfen"], ["↓ / S", "Ducken (groß); auf mancher Röhre: hinein in die Bonuswelt"], ...ALLGEMEIN],
    gamepad: [["A", "Start (aus der Demo), Springen (halten = höher)"], ["Steuerkreuz ← / →", "Laufen"], ["Steuerkreuz ↑", "Springen"], ["B / X", "Rennen; als Feuer-Mario Feuerball werfen"], ["Steuerkreuz ↓", "Ducken; auf mancher Röhre: hinein in die Bonuswelt"], ...PAD_ALLGEMEIN],
    ziel: "Laufe mit Mario durch die Welt bis zum Fahnenmast vor der Burg. Springe über Gruben, sammle Münzen und hüpfe auf Gegner. Danach geht es in die nächste, schwierigere Welt.",
    tipps: ["Pilz macht Mario groß, die Feuerblume lässt ihn Feuerbälle werfen.", "Auf Panzer springen hält sie an, ein zweiter Stoß kickt sie weg.", "Manche Röhren führen nach unten in eine Bonuswelt voller Münzen."] },
  { id: "tetris", name: "Tetris", hochkant: true,
    create: mitDemo({ create: createTetris, demo: createTetrisDemo, starte: (s) => s.key("Enter") }),
    rekord: "Punkte",
    tasten: [["Enter / Leertaste", "Start (aus der Demo)"], ["← / → oder A / D", "Schieben (halten = weiter)"], ["↑ / W / X", "Drehen rechtsrum"], ["Z / Y", "Drehen linksrum"], ["↓ / S", "Schneller fallen"], ["Leertaste", "Fallen lassen (Hard Drop)"], ...ALLGEMEIN],
    gamepad: [["A", "Start (aus der Demo), Drehen rechtsrum"], ["B / X", "Drehen linksrum"], ["Y", "Fallen lassen (Hard Drop)"], ["Steuerkreuz ← / →", "Schieben (halten = weiter)"], ["Steuerkreuz ↑", "Drehen rechtsrum"], ["Steuerkreuz ↓", "Schneller fallen"], ...PAD_ALLGEMEIN],
    pads: "Bei Tetris: A dreht rechtsrum, B dreht linksrum, Y lässt den Stein fallen, ↓ lässt ihn schneller fallen.",
    ziel: "Lege die fallenden Steine so, dass waagerechte Reihen lückenlos voll werden. Volle Reihen verschwinden und bringen Punkte, vier auf einmal (ein Tetris) die meisten. Alle 10 Reihen steigt das Level und die Steine fallen schneller. Die Runde endet, wenn sich die Steine bis oben stapeln. Tetris ist ein Hochkant-Spiel: die beiden Matrizen stehen dafür übereinander.",
    tipps: ["Oben rechts steht der nächste Stein.", "Der blasse Schatten zeigt, wo der Stein landet. Wie hell er ist, lässt sich in den Einstellungen ändern.", "Am Boden bleibt eine halbe Sekunde Zeit, den Stein noch zu schieben oder zu drehen."] },
];
