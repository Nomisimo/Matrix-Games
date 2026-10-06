/* ── Mario-Demo: Mario läuft selbst durch die Welten ───────────────────────
   Läuft nach rechts und springt vor Wänden, Gruben und Gegnern. Ohne Text und Ton,
   Gegner können ihm nichts anhaben, Leben gehen nie aus; am Ziel geht es in die nächste Welt. */
import { MarioWelt, TILE } from "./welt.js";
import { LEVEL_H } from "./level.js";
import { int, fdiv } from "../pixel.js";

const SOLID = new Set("GH?B[]()IN");

export function marioZug(w, s) {
  const m = w.mario, keys = { left: false, right: true, jump: false, run: true, duck: false };
  if (m.dead || w.ziel) return keys;
  const fest = (x, y) => { const c = fdiv(int(x), TILE), r = fdiv(int(y), TILE); return r >= 0 && r < LEVEL_H && SOLID.has(w.getTile(c, r)); };
  const vorn = m.x + m.w, fuss = m.y + m.h;
  let springen = false;
  if (m.onGround) {
    // Wand oder Röhre direkt voraus
    s.wand = false;
    for (let dx = 1; dx <= 5 && !springen; dx++) for (let y = m.y; y < fuss; y += 2) if (fest(vorn + dx, y)) { springen = s.wand = true; break; }
    // Grube voraus: kein Boden unter den nächsten Pixeln
    if (!fest(vorn + 3, fuss + 1) && !fest(vorn + 6, fuss + 1)) springen = true;
    // Gegner voraus (Pflanzen nur, wenn sie draußen sind)
    for (const e of w.enemies) {
      if (!e.alive || !e.aktiv) continue;
      const hb = e.hitbox || e;
      if (hb.h <= 0) continue;
      const d = hb.x - vorn;
      if (d > -2 && d < 14 && hb.y < fuss + 2 && hb.y + hb.h > m.y - 6) springen = true;
    }
    // Hängt fest: springen
    if (s.stand > 40) springen = s.wand = true;
  }
  // Sprungtaste halten (höherer Sprung); vor dem nächsten Sprung einmal loslassen, sonst zählt er nicht
  if (springen && m.onGround && s.halten === 0 && !s.gedrueckt) s.halten = s.wand ? 16 : 9;
  if (s.halten > 0) { s.halten--; keys.jump = true; }
  s.gedrueckt = keys.jump;
  return keys;
}

const neueWelt = () => Object.assign(new MarioWelt(), { demo: true });

export function createMarioDemo() {
  let w = neueWelt(), s = { halten: 0, stand: 0, lastX: 0, gedrueckt: false }, ziel = 0;
  return {
    step() {
      if (w.courseClear) { if (++ziel > 60) { ziel = 0; w.naechsteWelt(); if (w.welt > 4) w = neueWelt(); else w.demo = true; } return; }
      if (w.gameOver) w = neueWelt();
      w.lives = 3;
      const x = w.mario.x;
      s.stand = Math.abs(x - s.lastX) < 0.05 ? s.stand + 1 : 0;
      s.lastX = x;
      w.update(marioZug(w, s));
    },
    render(b, font) { w.render(b, font, false); },
    get welt() { return w; },
  };
}
