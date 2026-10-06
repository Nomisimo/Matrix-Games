/* ── Mario Jump (Port von matrix-mario-jump) ───────────────────────────────
   Jump'n'Run in Welt 1-1 mit Ziel und immer schnelleren Welten.
   Zustände: title → intro → playing → clear → intro … → game_over → title */
import { schrift } from "../pixel.js";
import { MarioWelt, SKY, COL_WHITE, COL_SCORE, COL_RED, weltName } from "./welt.js";
import { MARIO_SMALL, MARIO_BIG, MARIO_FIRE, drawSprite } from "./sprites.js";

const COL_GREEN = [80, 230, 80];

export const FONT = schrift({
  0: ["111", "101", "101", "101", "111"], 1: ["110", "010", "010", "010", "111"],
  2: ["111", "001", "011", "100", "111"], 3: ["111", "001", "011", "001", "111"],
  4: ["101", "101", "111", "001", "001"], 5: ["111", "100", "110", "001", "110"],
  6: ["011", "100", "111", "101", "111"], 7: ["111", "001", "001", "010", "010"],
  8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "011"],
  A: ["011", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["011", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"], N: ["101", "111", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"], P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "011", "001"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "101", "111", "010"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"],
  ":": ["010", "000", "010", "000", "000"], ".": ["000", "000", "000", "000", "010"],
  "!": ["010", "010", "010", "000", "010"], _: ["000", "000", "000", "000", "111"],
  ">": ["100", "010", "001", "010", "100"],
}, { fest: 3 });
const centered = (b, text, y, c) => FONT.drawText(b, text, FONT.center(text), y, c);
// Drei Textzeilen à 5 px mit je 3 px Abstand: y = 2, 10, 18
const ZEILEN = [2, 10, 18];

// Tasten wie im Original: Pfeile/WASD, Sprung Leertaste/↑/W, Rennen und Feuer Shift/Z, Ducken ↓/S
export const marioKeys = (held) => ({
  left: held.has("ArrowLeft") || held.has("KeyA"),
  right: held.has("ArrowRight") || held.has("KeyD"),
  jump: held.has("Space") || held.has("ArrowUp") || held.has("KeyW"),
  run: held.has("ShiftLeft") || held.has("ShiftRight") || held.has("KeyZ") || held.has("KeyY") || held.has("KeyX"),
  duck: held.has("ArrowDown") || held.has("KeyS"),
});

const INTRO = 150, CLEAR = 240;

export function createMario({ ton = () => {} } = {}) {
  let state = "title", game = null, tick = 0, timer = 0;
  const intro = () => { state = "intro"; timer = INTRO; ton("_stop"); };
  const start = () => { game = new MarioWelt(ton); tick = 0; intro(); };
  const naechste = () => { game.naechsteWelt(); intro(); };
  return {
    id: "mario",
    get state() { return state; },
    get welt() { return game; },
    key(code) {
      if (code === "Escape") { if (state !== "title") { state = "title"; ton("_stop"); } return; }
      const ok = code === "Enter" || code === "Space";
      if ((state === "title" || state === "game_over") && ok) start();
      else if (state === "clear" && ok && timer < CLEAR - 60) naechste();
      else if (state === "intro" && ok && timer < INTRO - 30) timer = 1;
    },
    step(held) {
      tick++;
      if (state === "intro") {
        if (--timer <= 0) { state = "playing"; ton("_music"); }
      } else if (state === "playing") {
        const lives = game.lives;
        game.update(marioKeys(held));
        if (game.gameOver) { state = "game_over"; tick = 0; }
        else if (game.courseClear) { state = "clear"; timer = CLEAR; }
        // Nach einem verlorenen Leben: Weltanzeige mit den übrigen Leben, dann geht es weiter
        else if (game.lives < lives) intro();
      } else if (state === "clear") {
        if (--timer <= 0) naechste();
      }
    },
    render(b) {
      const blink = Math.floor(tick / 30) % 2 === 0;
      if (state === "title") {
        b.fill(SKY);
        centered(b, "SUPER MARIO", ZEILEN[0], COL_SCORE);
        centered(b, "BROS", ZEILEN[1], COL_SCORE);
        if (blink) centered(b, "PRESS ENTER", ZEILEN[2], COL_WHITE);
      } else if (state === "intro") {
        b.fill([0, 0, 0]);
        centered(b, "WORLD " + weltName(game.welt), 4, COL_WHITE);
        // Mario und die Leben: kleines Bild, „x“ und Zahl
        const sp = { small: MARIO_SMALL, big: MARIO_BIG, fire: MARIO_FIRE }[game.mario.state]?.idle || MARIO_SMALL.idle;
        drawSprite(b, sp, 16, 20 - sp.length);
        FONT.drawText(b, "X", 23, 14, COL_WHITE);
        FONT.drawText(b, String(game.lives), 29, 14, COL_WHITE);
      } else if (state === "playing") game.render(b, FONT);
      else if (state === "clear") {
        b.fill(SKY);
        centered(b, "WORLD " + weltName(game.welt), ZEILEN[0], COL_WHITE);
        centered(b, "CLEAR!", ZEILEN[1], COL_GREEN);
        centered(b, String(game.score).padStart(6, "0"), ZEILEN[2], COL_SCORE);
      } else {
        b.fill(SKY);
        centered(b, "GAME OVER", ZEILEN[0], COL_RED);
        centered(b, String(game.score).padStart(6, "0"), ZEILEN[1], COL_SCORE);
        if (blink) centered(b, "PRESS ENTER", ZEILEN[2], COL_WHITE);
      }
    },
  };
}
