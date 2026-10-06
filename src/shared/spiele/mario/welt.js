/* ── Mario: Physik, Figuren, Gegenstände und Spielwelt ─────────────────────
   Port von matrix-mario-jump (physics.py, mario.py, enemies.py, items.py, engine.py).
   Ganzzahl-Rundungen folgen Python (int() schneidet ab, // rundet ab), damit die
   Kollisionen genau wie im Original greifen. */
import { W, H, int, fdiv } from "../pixel.js";
import { LEVEL_H, genColumn, piranhaPipes, BLOCK_INHALT, POLE_COL, CASTLE_COL } from "./level.js";
import {
  MARIO_SMALL, MARIO_BIG, MARIO_FIRE, GOOMBA, KOOPA, PARATROOPA, PIRANHA, FIREBALL, MUSHROOM, FIRE_FLOWER, COIN, STAR, ONEUP, DEBRIS,
  TILE_MAP, T_QUEST2, FLAG, drawSprite, flipH, flipV,
} from "./sprites.js";

/* ── Konstanten ─────────────────────────────────────────────────────────── */
export const TILE = 4, GROUND_ROW = 5, GROUND_Y = GROUND_ROW * TILE;
export const MARIO_W = 4, MARIO_SMALL_H = 6, MARIO_BIG_H = 10;
export const GRAVITY = 0.38, MAX_FALL = 3.5, WALK_SPEED = 0.6, RUN_SPEED = 1.4;
export const JUMP_VEL = -2.9, JUMP_VEL_RUN = -3.4;   // aus dem Stand über die hohen Röhren
const GRAVITY_RISE = 0.28, GRAVITY_FALL = 0.50, GRAVITY_ABORT = 0.58;
const ACCEL_WALK = 0.06, ACCEL_RUN = 0.09, DECEL = 0.04, DECEL_SKID = 0.07;
export const SKY = [92, 148, 252], COL_WHITE = [255, 255, 255], COL_SCORE = [255, 220, 0], COL_RED = [255, 60, 60];
export const SMALL = "small", BIG = "big", FIRE = "fire", DEAD = "dead", GROW = "grow", SHRINK = "shrink";
const SOLID = new Set("GH?B[]()IN");
const ACTIVATABLE = new Set("?BIN");
const COYOTE_FRAMES = 6, STAR_DURATION = 480;
const QUEST_ANIM_SPEED = 30, GEN_AHEAD = W * 3;

/* ── Kachel-Kollision (erst x, dann y) ──────────────────────────────────── */
const getTile = (tiles, col, row) => (row >= 0 && row < LEVEL_H && col >= 0 && col < tiles[0].length ? tiles[row][col] : " ");
const isSolid = (t) => SOLID.has(t);

export function resolveX(e, tiles) {
  if (e.vx === 0) return;
  const top = Math.max(0, fdiv(int(e.y), TILE));
  const bot = Math.min(LEVEL_H - 1, fdiv(int(e.y + e.h - 1), TILE));
  if (e.vx > 0) {
    const col = fdiv(int(e.x + e.w - 1), TILE);
    for (let row = top; row <= bot; row++) if (isSolid(getTile(tiles, col, row))) { e.x = col * TILE - e.w; e.vx = 0; return; }
  } else {
    const col = fdiv(int(e.x), TILE);
    for (let row = top; row <= bot; row++) if (isSolid(getTile(tiles, col, row))) { e.x = (col + 1) * TILE; e.vx = 0; return; }
  }
  if (e.x < 0) { e.x = 0; e.vx = 0; }
}

// → [col, row] eines von unten getroffenen aktivierbaren Blocks oder null
export function resolveY(e, tiles, prevY) {
  const left = Math.max(0, fdiv(int(e.x), TILE));
  const right = Math.min(tiles[0].length - 1, fdiv(int(e.x + e.w - 1), TILE));
  if (e.vy >= 0) {
    const row = Math.min(LEVEL_H - 1, fdiv(int(e.y + e.h), TILE));
    for (let col = left; col <= right; col++) {
      if (!isSolid(getTile(tiles, col, row))) continue;
      const top = row * TILE;
      if (prevY + e.h <= top) { e.y = top - e.h; e.vy = 0; e.onGround = true; return null; }
    }
  } else {
    const row = Math.max(0, fdiv(int(e.y), TILE));
    for (let col = left; col <= right; col++) {
      const t = getTile(tiles, col, row);
      if (!isSolid(t)) continue;
      const bottom = (row + 1) * TILE;
      if (prevY >= bottom) { e.y = bottom; e.vy = 0; return ACTIVATABLE.has(t) ? [col, row] : null; }
    }
  }
  return null;
}

function stepEntity(e, tiles) {
  e.onGround = false;
  e.x += e.vx;
  resolveX(e, tiles);
  const prevY = e.y;
  e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
  e.y += e.vy;
  return resolveY(e, tiles, prevY);
}

// Gegner drehen an Abgründen um
function turnAtEdge(e, tiles) {
  if (!e.onGround) return;
  const ahead = e.vx > 0 ? fdiv(int(e.x + e.w), TILE) : fdiv(int(e.x - 1), TILE);
  if (getTile(tiles, ahead, fdiv(int(e.y + e.h), TILE)) === " ") e.vx = -e.vx;
}
// An Wänden umdrehen: resolveX hat vx auf 0 gesetzt
function walk(e, tiles) {
  const prev = e.vx;
  stepEntity(e, tiles);
  if (prev !== 0 && e.vx === 0) e.vx = -prev;
}

/* ── Mario ──────────────────────────────────────────────────────────────── */
export class Mario {
  constructor(x, y, ton) {
    Object.assign(this, { x, y, vx: 0, vy: 0, onGround: false, state: SMALL, w: MARIO_W, h: MARIO_SMALL_H, ton });
    this.facingRight = true; this.animTick = 0; this.animFrame = 0;
    this.coyote = 0; this.jumped = false; this.jumpHeld = false; this.skidding = false; this.ducking = false;
    this.wasOnGround = false; this.prevVy = 0;
    this.transitionTimer = 0; this.prevState = SMALL;
    this.starTimer = 0; this.starVisible = true;
    this.dead = false; this.deadTimer = 0; this.deadDone = false;
    this.combo = 0; this.hidden = false;
  }
  applySize() {
    const nh = [GROW, SHRINK].includes(this.state) ? MARIO_BIG_H : [SMALL, DEAD].includes(this.state) ? MARIO_SMALL_H : MARIO_BIG_H;
    if (nh !== this.h) { this.y -= nh - this.h; this.h = nh; }
  }
  jump() {
    if (this.dead || this.state === GROW || this.state === SHRINK) return;
    if (this.onGround || this.coyote > 0) {
      const r = Math.min(1, Math.abs(this.vx) / RUN_SPEED);
      this.vy = JUMP_VEL + (JUMP_VEL_RUN - JUMP_VEL) * r;
      this.onGround = false; this.coyote = 0;
      this.ton("jump");
    }
  }
  stompBounce() { this.vy = JUMP_VEL * 0.55; }
  grow() {
    if (this.state !== SMALL) return;
    this.prevState = BIG; this.state = GROW; this.transitionTimer = 60; this.applySize();
  }
  powerUp() { if (this.state === BIG || this.state === FIRE) this.state = FIRE; else if (this.state === SMALL) this.grow(); }
  applyStar() { this.starTimer = STAR_DURATION; }
  takeHit() {
    if (this.starTimer > 0 || this.state === DEAD) return;
    if ([BIG, FIRE, SHRINK].includes(this.state)) {
      this.ton("block");
      this.state = SHRINK; this.prevState = SMALL; this.transitionTimer = 60; this.applySize();
    } else if (this.state === SMALL) this.die();
  }
  die() {
    this.state = DEAD; this.dead = true; this.vy = -3.5; this.vx = 0; this.deadTimer = 110;
    this.ton("death");
  }
  pitDeath() { if (!this.dead) { this.dead = true; this.state = DEAD; this.deadDone = true; } }

  update(tiles, keys) {
    if (this.dead) {
      if (!this.deadDone) {
        this.deadTimer--;
        this.vy = Math.min(this.vy + 0.38, 6.0);
        this.y += this.vy;
        if (this.deadTimer <= 0) this.deadDone = true;
      }
      return null;
    }
    const trans = this.state === GROW || this.state === SHRINK;
    if (trans && --this.transitionTimer <= 0) { this.state = this.prevState; this.applySize(); }
    this.movement(keys, trans);
    this.wasOnGround = this.onGround;
    this.prevVy = this.vy;
    const hit = this.physStep(tiles);
    this.postStep();
    if (!trans && this.starTimer > 0) {
      this.starTimer--;
      this.starVisible = fdiv(this.starTimer, 4) % 2 === 0;
    }
    return hit;
  }
  physStep(tiles) {
    const grav = this.vy < 0 && this.jumpHeld ? GRAVITY_RISE : this.vy < 0 ? GRAVITY_ABORT : GRAVITY_FALL;
    this.onGround = false;
    this.x += this.vx;
    resolveX(this, tiles);
    const prevY = this.y;
    this.vy = Math.min(this.vy + grav, MAX_FALL);
    this.y += this.vy;
    return resolveY(this, tiles, prevY);
  }
  movement(keys, slow) {
    const { run, left, right, jump, duck } = keys;
    this.jumpHeld = !!jump;
    const s = slow ? 0.5 : 1;
    const maxSpd = (run ? RUN_SPEED : WALK_SPEED) * s, accel = (run ? ACCEL_RUN : ACCEL_WALK) * s;
    const decel = DECEL * s, skid = DECEL_SKID * s;

    this.ducking = false;
    if (duck && (this.state === BIG || this.state === FIRE)) {
      this.ducking = true;
      if (this.h !== 6) { this.y += this.h - 6; this.h = 6; }
      if (right) { this.vx = Math.min(this.vx + accel * 0.5, maxSpd * 0.5); this.facingRight = true; }
      else if (left) { this.vx = Math.max(this.vx - accel * 0.5, -maxSpd * 0.5); this.facingRight = false; }
      else this.vx *= 0.85;
      return;                                     // kein Springen im Ducken
    } else if ((this.state === BIG || this.state === FIRE) && this.h === 6) {
      this.h = MARIO_BIG_H; this.y -= MARIO_BIG_H - 6;
    }

    this.skidding = false;
    if (right) {
      if (this.vx < 0) { this.skidding = true; this.vx = Math.min(0, this.vx + skid); }
      else if (this.vx < maxSpd) this.vx = Math.min(this.vx + accel, maxSpd);
      else if (this.vx > maxSpd) this.vx = Math.max(this.vx - decel, maxSpd);
      this.facingRight = true;
    } else if (left) {
      if (this.vx > 0) { this.skidding = true; this.vx = Math.max(0, this.vx - skid); }
      else if (this.vx > -maxSpd) this.vx = Math.max(this.vx - accel, -maxSpd);
      else if (this.vx < -maxSpd) this.vx = Math.min(this.vx + decel, -maxSpd);
      this.facingRight = false;
    } else if (this.vx > 0) this.vx = Math.max(0, this.vx - decel);
    else if (this.vx < 0) this.vx = Math.min(0, this.vx + decel);

    if (jump && !this.jumped) { this.jump(); this.jumped = true; }
    if (!jump) this.jumped = false;
  }
  postStep() {
    if (this.onGround) { this.coyote = COYOTE_FRAMES; this.combo = 0; }
    else if (this.coyote > 0) this.coyote--;
    if (Math.abs(this.vx) > 0.1) {
      if (++this.animTick >= 8) { this.animTick = 0; this.animFrame ^= 1; }
    } else { this.animFrame = 0; this.animTick = 0; }
  }
  render(b, camX, camY = 0) {
    if (this.hidden || (this.starTimer > 0 && !this.starVisible)) return;
    let sp = this.sprite();
    if (!this.facingRight) sp = flipH(sp);
    drawSprite(b, sp, int(this.x) - camX, int(this.y) - camY);
  }
  sprite() {
    const st = this.state;
    if (st === DEAD) return MARIO_SMALL.dead;
    if (st === GROW || st === SHRINK) return (fdiv(this.transitionTimer, 5) % 2 === 0 ? MARIO_BIG : MARIO_SMALL).idle;
    const bank = { [SMALL]: MARIO_SMALL, [BIG]: MARIO_BIG, [FIRE]: MARIO_FIRE }[st] || MARIO_SMALL;
    if (!this.onGround) return bank.jump;
    if (this.ducking) return bank.duck || bank.idle;
    if (this.skidding && Math.abs(this.vx) > 0.05) return bank.idle;
    if (Math.abs(this.vx) > 0.1) return this.animFrame === 0 ? bank.run1 : bank.run2;
    return bank.idle;
  }
}

/* ── Gegner ─────────────────────────────────────────────────────────────── */
// Gemeinsam: von Feuerball, Panzer, Stern oder Block getroffen → umgedreht aus dem Bild fallen
class Gegner {
  knock() {
    this.alive = false; this.knocked = true; this.vx = 0; this.vy = -2.2;
  }
  fallOut() {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.y += this.vy;
    if (this.y > H + 8) this.remove = true;
  }
  draw(b, sp, camX, camY) {
    drawSprite(b, this.knocked ? flipV(sp) : sp, int(this.x) - camX, int(this.y) - camY);
  }
}

export class Goomba extends Gegner {
  constructor(x, y, tempo = 1) {
    super();
    Object.assign(this, { x, y, w: 4, h: 4, vx: -0.5 * tempo, vy: 0, onGround: false, alive: true, squished: false, remove: false });
    this.squishTimer = 0; this.animTick = 0; this.animFrame = 0;
  }
  update(tiles) {
    if (this.knocked) return this.fallOut();
    if (!this.alive) { if (this.squished && --this.squishTimer <= 0) this.remove = true; return; }
    turnAtEdge(this, tiles);
    walk(this, tiles);
    if (++this.animTick >= 15) { this.animTick = 0; this.animFrame ^= 1; }
  }
  stomp() { this.alive = false; this.squished = true; this.squishTimer = 30; this.vx = 0; this.vy = 0; return 0; }
  render(b, camX, camY = 0) {
    const sp = this.squished ? GOOMBA.dead : this.animFrame === 0 ? GOOMBA.walk1 : GOOMBA.walk2;
    this.draw(b, sp, camX, camY + (this.squished ? -2 : 0));
  }
}

export class Koopa extends Gegner {
  constructor(x, y, tempo = 1, fluegel = false) {
    super();
    Object.assign(this, { x, y, w: 4, vx: -0.4 * tempo, vy: 0, onGround: false, inShell: false, shellMoving: false, alive: true, remove: false });
    this.animTick = 0; this.animFrame = 0; this.shellKickDelay = 0; this.fluegel = fluegel; this.shellTimer = 0;
  }
  get h() { return this.inShell ? 4 : 6; }
  update(tiles) {
    if (this.knocked) return this.fallOut();
    if (!this.alive) { this.remove = true; return; }
    if (this.inShell && !this.shellMoving) {
      this.shellKickDelay = Math.max(0, this.shellKickDelay - 1);
      // Nach einer Weile kriecht er wieder heraus
      if (++this.shellTimer > 420) { this.inShell = false; this.y -= 2; this.vx = -0.4; this.shellTimer = 0; }
      stepEntity(this, tiles);
      return;
    }
    if (this.fluegel) {
      walk(this, tiles);
      if (this.onGround) this.vy = -2.6;          // Paratroopa hüpft
    } else {
      if (!this.shellMoving) turnAtEdge(this, tiles);
      walk(this, tiles);
    }
    if (++this.animTick >= 18) { this.animTick = 0; this.animFrame ^= 1; }
  }
  // → 1, wenn ein Panzer per Draufspringen angehalten wurde (zählt wie ein Treffer)
  stomp(marioX) {
    if (this.fluegel) { this.fluegel = false; this.vy = 0; return 0; }
    if (!this.inShell) { this.inShell = true; this.shellMoving = false; this.vx = 0; this.shellKickDelay = 20; this.shellTimer = 0; this.y += 2; return 0; }
    if (this.shellMoving) { this.shellMoving = false; this.vx = 0; this.shellKickDelay = 20; this.shellTimer = 0; return 0; }
    if (this.shellKickDelay <= 0) this.kick(marioX);
    return 0;
  }
  // → true, wenn der Panzer losrollt
  kick(marioX) {
    if (!(this.inShell && !this.shellMoving && this.shellKickDelay <= 0)) return false;
    this.shellMoving = true; this.shellTimer = 0; this.kette = 0;
    this.vx = marioX < this.x ? 2.5 : -2.5;
    this.shellKickDelay = 10;
    return true;
  }
  render(b, camX, camY = 0) {
    const bank = this.fluegel ? PARATROOPA : KOOPA;
    let sp = this.inShell ? KOOPA.shell : this.animFrame === 0 ? bank.walk1 : bank.walk2;
    if (!this.inShell && this.vx < 0) sp = flipH(sp);
    this.draw(b, sp, camX, camY);
  }
}

// Piranha-Pflanze: steigt aus der Röhre, wartet, taucht ab. Kommt nicht heraus, wenn Mario direkt daneben steht.
export class Piranha extends Gegner {
  constructor(col, topRow) {
    super();
    this.x = col * TILE + 2; this.w = 4; this.top = topRow * TILE;
    this.y = this.top; this.h = 6; this.vx = 0; this.vy = 0;
    this.alive = true; this.remove = false; this.phase = 0; this.timer = 60; this.anim = 0;
  }
  // sichtbarer Teil über der Röhre
  get hitbox() { return { x: this.x, y: this.y, w: this.w, h: Math.max(0, this.top - this.y) }; }
  update(_tiles, mario) {
    if (this.knocked) return this.fallOut();
    this.anim++;
    if (--this.timer > 0) {
      if (this.phase === 1 && this.anim % 3 === 0) this.y = Math.max(this.top - 6, this.y - 1);
      if (this.phase === 3 && this.anim % 3 === 0) this.y = Math.min(this.top, this.y + 1);
      return;
    }
    const nah = mario && Math.abs(mario.x + 2 - (this.x + 2)) < 8;
    if (this.phase === 0 && nah) { this.timer = 20; return; }
    this.phase = (this.phase + 1) % 4;
    this.timer = [90, 18, 70, 18][this.phase];
  }
  render(b, camX, camY = 0) {
    if (this.y >= this.top && !this.knocked) return;
    this.draw(b, PIRANHA[fdiv(this.anim, 12) % 2], camX, camY);
  }
}

/* ── Gegenstände ────────────────────────────────────────────────────────── */
class Item {
  constructor(kind, x, y, extra) { Object.assign(this, { kind, x, y, vx: 0, vy: 0, onGround: false, remove: false, ...extra }); }
  collect() { this.remove = true; }
  render(b, camX, camY = 0) { drawSprite(b, this.sp, int(this.x) - camX, int(this.y) - camY); }
}
export const mushroom = (x, y, oneUp = false) => Object.assign(new Item(oneUp ? "oneup" : "mushroom", x, y, { w: 4, h: 5, vx: 0.6, vy: JUMP_VEL * 0.4, sp: oneUp ? ONEUP : MUSHROOM }), {
  update(tiles) { if (!this.remove) { walk(this, tiles); if (this.y > H + 8) this.remove = true; } },
});
const fireFlower = (x, y) => Object.assign(new Item("flower", x, y, { w: 4, h: 5, sp: FIRE_FLOWER, baseY: y, tick: 0 }), {
  update() { if (!this.remove) this.y = this.baseY + Math.sin(++this.tick * Math.PI / 30); },
});
export const coin = (x, y) => Object.assign(new Item("coin", x, y, { sp: COIN, startY: y, timer: 20 }), {
  update() {
    if (this.remove) return;
    this.timer--;
    this.y = this.startY - (1 - this.timer / 20) * 6;
    if (this.timer <= 0) this.remove = true;
  },
  render(b, camX, camY = 0) { if (!this.remove) drawSprite(b, COIN, int(this.x) - camX, int(this.y) - camY); },
});
export const star = (x, y) => Object.assign(new Item("star", x, y, { w: 4, h: 4, vx: 1.2, vy: JUMP_VEL * 0.6, sp: STAR }), {
  update(tiles) {
    if (this.remove) return;
    walk(this, tiles);
    if (this.onGround) this.vy = JUMP_VEL * 0.9;
    if (this.y > H + 8) this.remove = true;
  },
});
// Feuerball: springt über den Boden, verschwindet an Wänden und außerhalb des Bildes
export const fireball = (x, y, rechts) => Object.assign(new Item("fireball", x, y, { w: 2, h: 2, vx: rechts ? 2.2 : -2.2, vy: 1, tick: 0 }), {
  update(tiles) {
    if (this.remove) return;
    const vx = this.vx;
    this.tick++;
    stepEntity(this, tiles);
    if (this.vx === 0 && vx !== 0) { this.remove = true; return; }
    if (this.onGround) this.vy = -1.7;
    if (this.y > H + 4) this.remove = true;
  },
  render(b, camX, camY = 0) { drawSprite(b, FIREBALL[fdiv(this.tick, 4) % 2], int(this.x) - camX, int(this.y) - camY); },
});
const debris = (x, y, vx, vy) => Object.assign(new Item("debris", x, y, { vx, vy, sp: DEBRIS }), {
  update() {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.x += this.vx; this.y += this.vy;
    if (this.y > 24 || this.y < -8) this.remove = true;
  },
});
export function spawnDebris(col, row) {
  const cx = col * 4 + 2, cy = row * 4 + 2;
  return [debris(cx - 2, cy - 2, -1.5, -2.5), debris(cx, cy - 2, 1.5, -2.5), debris(cx - 2, cy, -1.5, 1.5), debris(cx, cy, 1.5, 1.5)];
}

/* ── Spielwelt ──────────────────────────────────────────────────────────── */
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const hits = (a, e) => { const h = e.hitbox || e; return overlap(a.x, a.y, a.w, a.h, h.x, h.y, h.w, h.h); };
// Punkte für mehrere Gegner hintereinander ohne Landen (wie im Original)
const COMBO = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
const POLE_X = POLE_COL * TILE + 1, DOOR_X = (CASTLE_COL + 1) * TILE + 2;
const CAM_MAX = (CASTLE_COL + 4) * TILE + 2 - W;
const CAM_Y_MIN = -14;   // am Ende stehen Mast und Burg im Bild
export const weltName = (n) => `${1 + fdiv(n - 1, 4)}-${((n - 1) % 4) + 1}`;

export class MarioWelt {
  constructor(ton = () => {}, welt = 1) { this.ton = ton; this.welt = welt; this.reset(); }
  reset(mitnehmen = null) {
    this.tiles = Array.from({ length: LEVEL_H }, () => []);
    this.levelW = 0;
    this.mario = new Mario(4 * TILE, GROUND_Y - MARIO_SMALL_H, this.ton);
    // Groß oder Feuer bleibt beim Weltwechsel erhalten
    if (mitnehmen && mitnehmen !== SMALL) { this.mario.state = mitnehmen; this.mario.applySize(); }
    this.enemies = []; this.items = []; this.bumps = []; this.used = {};
    this.cameraX = 0; this.cameraY = 0;
    this.score = 0; this.coins = 0; this.lives = 3;
    this.questTick = 0; this.questFrame = 0; this.gameOver = false;
    this.ziel = null; this.courseClear = false; this.flagY = 1; this.prevRun = false;
    this.tempo = Math.min(1.6, 1 + 0.15 * (this.welt - 1));
    for (const [col, h] of piranhaPipes(this.welt)) this.enemies.push(new Piranha(col, LEVEL_H - 1 - h));
    this.ensureGenerated(fdiv(W + GEN_AHEAD, TILE));
  }
  ensureGenerated(upTo) {
    while (this.levelW <= upTo) {
      const col = this.levelW;
      const [colTiles, enemy] = genColumn(col, this.welt);
      for (let r = 0; r < LEVEL_H; r++) this.tiles[r].push(colTiles[r]);
      this.levelW++;
      if (enemy === "goomba") this.enemies.push(new Goomba(col * TILE, GROUND_Y - 4, this.tempo));
      else if (enemy === "para") this.enemies.push(new Koopa(col * TILE, GROUND_Y - 6, this.tempo, true));
      else if (enemy) this.enemies.push(new Koopa(col * TILE, GROUND_Y - 6, this.tempo));
    }
  }
  getTile(col, row) { return getTile(this.tiles, col, row); }
  setTile(col, row, ch) { if (row >= 0 && row < LEVEL_H && col >= 0 && col < this.levelW) this.tiles[row][col] = ch; }

  addScore(n) { this.score += n; }
  addCoin() {
    this.coins++; this.addScore(200); this.ton("coin");
    if (this.coins >= 100) { this.coins -= 100; this.lives++; this.ton("1up"); }
  }

  // Block von unten getroffen: Inhalt freigeben, kurz hochhüpfen, Gegner darauf umwerfen
  activateBlock(col, row) {
    const t = this.getTile(col, row), m = this.mario, sx = col * TILE, sy = row * TILE;
    const inhalt = BLOCK_INHALT[`${col},${row}`];
    let bump = true;
    if (t === "?") {
      this.setTile(col, row, "H");
      if (inhalt === "power") {
        this.ton("block");
        this.items.push(m.state === SMALL ? mushroom(sx, sy - 5) : fireFlower(sx, sy - 5));
      } else { this.items.push(coin(sx, sy - 4)); this.addCoin(); }
    } else if (t === "B" && inhalt && !this.used[`${col},${row}`]) {
      if (inhalt === "muenzen") {
        // Münzblock: bis zu 10 Münzen, dann leer
        const n = (this.used[`m${col},${row}`] || 0) + 1;
        this.used[`m${col},${row}`] = n;
        this.items.push(coin(sx, sy - 4)); this.addCoin();
        if (n >= 10) { this.used[`${col},${row}`] = true; this.setTile(col, row, "H"); }
      } else {
        this.used[`${col},${row}`] = true; this.setTile(col, row, "H"); this.ton("block");
        this.items.push(inhalt === "stern" ? star(sx, sy - 4) : mushroom(sx, sy - 5, true));
      }
    } else if (t === "B") {
      if (m.state === BIG || m.state === FIRE) {
        this.setTile(col, row, " ");
        this.items.push(...spawnDebris(col, row));
        this.addScore(50);
        this.ton("brick");
        bump = false;
      } else this.ton("block");
    } else if (t === "N") m.vy = JUMP_VEL * 1.3;
    else bump = false;
    if (bump) this.bumps.push({ col, row, t: 8 });
    // Gegner, die auf dem Block stehen, fliegen weg
    for (const e of this.enemies) {
      if (!e.alive || e instanceof Piranha) continue;
      if (Math.abs(e.y + e.h - sy) < 1 && e.x + e.w > sx && e.x < sx + TILE) { e.knock(); this.addScore(100); this.ton("kick"); }
    }
  }

  // Zielsequenz: am Mast herunterrutschen, Punkte nach Höhe, in die Burg laufen
  startZiel() {
    const m = this.mario;
    const hoehe = int(m.y + m.h);
    const bonus = hoehe <= 4 ? 5000 : hoehe <= 8 ? 2000 : hoehe <= 12 ? 800 : hoehe <= 16 ? 400 : 100;
    this.addScore(bonus);
    this.ziel = { phase: "rutschen", t: 0, bonus };
    if (m.state === GROW || m.state === SHRINK) { m.state = m.prevState; m.applySize(); }
    // Am Mast festhalten (unten am Sockel greift er knapp darüber)
    m.x = POLE_X - m.w; m.vx = 0; m.vy = 0; m.starTimer = 0; m.starVisible = true;
    m.y = Math.min(m.y, 4 * TILE - m.h);
    this.items = this.items.filter((i) => i.kind !== "fireball");
    this.ton("_stop"); this.ton("flag");
  }
  updateZiel() {
    const z = this.ziel, m = this.mario;
    z.t++;
    const boden = 4 * TILE - m.h;    // auf dem Sockel
    if (z.phase === "rutschen") {
      if (m.y < boden) m.y = Math.min(boden, m.y + 1);
      if (this.flagY < 4 * TILE - 4) this.flagY++;
      if (m.y >= boden && this.flagY >= 4 * TILE - 4) { z.phase = "warten"; z.t = 0; m.facingRight = false; }
    } else if (z.phase === "warten") {
      if (z.t >= 20) { z.phase = "laufen"; z.t = 0; m.facingRight = true; this.ton("clear"); }
    } else if (z.phase === "laufen") {
      m.update(this.tiles, { right: true, left: false, jump: false, run: false, duck: false });
      if (m.x >= DOOR_X) { m.hidden = true; z.phase = "burg"; z.t = 0; }
    } else if (z.phase === "burg" && z.t >= 90) this.courseClear = true;
    for (const it of this.items) it.update(this.tiles);
    this.items = this.items.filter((i) => !i.remove);
  }

  update(keys) {
    if (this.gameOver || this.courseClear) return;
    if (++this.questTick >= QUEST_ANIM_SPEED) { this.questTick = 0; this.questFrame ^= 1; }
    if (this.ziel) return this.updateZiel();
    this.ensureGenerated(fdiv(this.cameraX + GEN_AHEAD, TILE));
    const m = this.mario;

    // Feuerball: Rennen-Taste neu gedrückt, höchstens zwei gleichzeitig
    const run = !!keys.run;
    if (run && !this.prevRun && m.state === FIRE && !m.dead && !m.ducking
      && this.items.filter((i) => i.kind === "fireball").length < 2) {
      this.items.push(fireball(m.facingRight ? m.x + m.w : m.x - 2, m.y + 2, m.facingRight));
      this.ton("fire");
    }
    this.prevRun = run;

    const hit = m.update(this.tiles, keys);
    if (hit) this.activateBlock(...hit);
    // Mario bleibt im Bild: die Kamera fährt nur nach rechts
    if (m.x < this.cameraX) { m.x = this.cameraX; if (m.vx < 0) m.vx = 0; }
    if (m.y > H && !m.dead) m.pitDeath();
    if (!m.dead && m.x + m.w >= POLE_COL * TILE) return this.startZiel();

    for (const b of this.bumps) b.t--;
    this.bumps = this.bumps.filter((b) => b.t > 0);

    const sichtbar = this.cameraX + W + 4;
    for (const e of this.enemies) {
      // Gegner laufen erst los, wenn sie ins Bild kommen
      if (!e.aktiv) { if (e.x < sichtbar) e.aktiv = true; else continue; }
      e.update(this.tiles, m);
      if (e.remove || !e.alive) continue;
      if (e.y > H + 4) { e.remove = true; continue; }
      // Rollender Panzer wirft andere Gegner um
      if (e.shellMoving) {
        for (const o of this.enemies) {
          if (o === e || !o.alive || !o.aktiv || !hits(e, o)) continue;
          o.knock(); e.kette = (e.kette || 0) + 1;
          this.addScore(COMBO[Math.min(e.kette, COMBO.length - 1)]); this.ton("kick");
        }
      }
      if (m.dead || !hits(m, e)) continue;
      // Stern, und in der Demo: Gegner fliegen weg statt Mario zu treffen
      if (m.starTimer > 0 || (this.demo && !(!(e instanceof Piranha) && !m.wasOnGround && m.prevVy >= 0 && m.y + m.h <= e.y + 4))) {
        e.knock(); this.addScore(200); this.ton("kick"); continue;
      }
      // Draufspringen: Mario fällt und landet auf der Oberseite (nicht bei Pflanzen)
      if (!(e instanceof Piranha) && !m.wasOnGround && m.prevVy >= 0 && m.y + m.h <= e.y + 4) {
        e.stomp(m.x);
        this.addScore(COMBO[Math.min(m.combo++, COMBO.length - 1)]);
        m.stompBounce(); this.ton("stomp");
      } else if (e.inShell && !e.shellMoving) {
        if (e.kick(m.x)) { this.addScore(400); this.ton("kick"); }
      } else if (!(e.shellMoving && e.shellKickDelay > 0)) m.takeHit();
    }
    for (const e of this.enemies) if (e.shellKickDelay > 0 && e.shellMoving) e.shellKickDelay--;
    const purge = this.cameraX - W * 2;
    this.enemies = this.enemies.filter((e) => !e.remove && e.x > purge);

    for (const it of this.items) {
      it.update(this.tiles);
      if (it.remove) continue;
      if (it.kind === "fireball") {
        if (it.x < this.cameraX - 4 || it.x > this.cameraX + W + 4) { it.remove = true; continue; }
        const e = this.enemies.find((o) => o.alive && o.aktiv && hits(it, o));
        if (e) { e.knock(); it.remove = true; this.addScore(200); this.ton("kick"); }
        continue;
      }
      if (!["mushroom", "oneup", "flower", "star"].includes(it.kind)) continue;
      if (!overlap(m.x, m.y, m.w, m.h, it.x, it.y, it.w, it.h)) continue;
      it.collect();
      if (it.kind === "oneup") { this.lives++; this.ton("1up"); }
      else if (it.kind === "mushroom") { this.addScore(1000); m.grow(); this.ton("powerup"); }
      else if (it.kind === "flower") { this.addScore(1000); m.powerUp(); this.ton("powerup"); }
      else { this.addScore(1000); m.applyStar(); this.ton("star"); }
    }
    const purgeItems = this.cameraX - W;
    this.items = this.items.filter((i) => !i.remove && i.x > purgeItems);

    // Kamera: nur nach rechts, am Ende der Strecke stehen bleiben; nach oben sofort folgen, langsam zurück
    this.cameraX = Math.min(CAM_MAX, Math.max(0, Math.max(this.cameraX, int(m.x) - 16)));
    const ty = int(m.y) - 3;
    if (ty < this.cameraY) this.cameraY = ty;
    else if (this.cameraY < 0) this.cameraY = Math.min(0, this.cameraY + 1);
    // Hohe Sprünge (von Röhren und Treppen) bleiben im Bild; beim Fallen folgt die Kamera nach unten
    this.cameraY = Math.min(0, Math.max(this.cameraY, CAM_Y_MIN, int(m.y + m.h) - H + 1));

    if (m.deadDone) {
      this.lives--;
      if (this.lives <= 0) this.gameOver = true;
      else this.resetAfterDeath();
    }
  }
  resetAfterDeath() {
    const { lives, score, coins } = this;
    this.reset();
    Object.assign(this, { lives, score, coins });
  }
  // Nächste Welt: Punkte, Münzen, Leben und Größe bleiben
  naechsteWelt() {
    const { lives, score, coins } = this, st = this.mario.state;
    this.welt++;
    this.reset(st === GROW ? BIG : st === SHRINK ? SMALL : st);
    Object.assign(this, { lives, score, coins });
  }

  render(b, font, hud = true) {
    b.fill(SKY);
    const cam = this.cameraX, camY = this.cameraY;
    // Pflanzen hinter den Röhren zeichnen
    for (const e of this.enemies) if (e instanceof Piranha && !e.knocked) e.render(b, cam, camY);
    const c0 = fdiv(cam, TILE), c1 = Math.min(this.levelW - 1, fdiv(cam + W, TILE) + 1);
    for (let row = 0; row < LEVEL_H; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = this.tiles[row][col];
        if (t === " ") continue;
        const sp = t === "?" && this.questFrame ? T_QUEST2 : TILE_MAP[t];
        const bump = this.bumps.find((u) => u.col === col && u.row === row);
        if (sp) drawSprite(b, sp, col * TILE - cam, row * TILE - camY - (bump && bump.t > 4 ? 1 : 0));
      }
    }
    // Fahne am Mast
    if (POLE_COL * TILE + 4 > cam) drawSprite(b, FLAG, POLE_X - 3 - cam, this.flagY - camY);
    for (const it of this.items) it.render(b, cam, camY);
    for (const e of this.enemies) if (!(e instanceof Piranha) || e.knocked) e.render(b, cam, camY);
    this.mario.render(b, cam, camY);

    if (!hud) return;
    // HUD: Punkte links, Münzen, Herz und Leben rechts
    font.drawText(b, String(this.score).padStart(6, "0"), 0, 0, COL_SCORE);
    icon(b, 26, 0, [".X.", "XXX", "XXX", ".X."], [255, 215, 0]);
    font.drawText(b, String(this.coins).padStart(2, "0"), 30, 0, COL_WHITE);
    icon(b, 38, 1, ["X.X", "XXX", ".X."], COL_RED);
    font.drawText(b, String(Math.min(this.lives, 9)), 42, 0, COL_WHITE);
  }
}

function icon(b, x, y, rows, c) {
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== ".") b.set(x + dx, y + dy, c); }));
}
