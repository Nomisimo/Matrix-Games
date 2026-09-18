"""
Mario entity — NES-style physics, state machine, animation.

Physics highlights
──────────────────
• Sub-pixel inertia   : vx accelerates/decelerates toward the speed cap each
                        frame instead of snapping instantly.
• Skid                : reversing direction on the ground bleeds off momentum
                        at a higher decel rate (DECEL_SKID) before flipping.
• Variable-height jump: apex scales linearly with |vx| at the moment of launch
                        (JUMP_VEL at zero speed → JUMP_VEL_RUN at RUN_SPEED).
• Asymmetric gravity  : three gravity modes —
                          GRAVITY_RISE  while rising and A held   (floaty)
                          GRAVITY_ABORT while rising but A released (cut short)
                          GRAVITY_FALL  while falling              (snappy)
"""
import pygame
from constants import (
    TILE, MARIO_W, MARIO_SMALL_H, MARIO_BIG_H,
    WALK_SPEED, RUN_SPEED, MAX_FALL,
    JUMP_VEL, JUMP_VEL_RUN,
    GRAVITY_RISE, GRAVITY_FALL, GRAVITY_ABORT,
    ACCEL_WALK, ACCEL_RUN, DECEL, DECEL_SKID,
    SMALL, BIG, FIRE, DEAD, GROW, SHRINK,
)
from sprites import MARIO_SMALL, MARIO_BIG, MARIO_FIRE, draw_sprite, flip_h
from physics import resolve_x, resolve_y
import sounds


COYOTE_FRAMES = 6    # frames after walking off a ledge where jump still works
STAR_DURATION = 480  # 8 seconds at 60 fps


class Mario:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False

        self.state = SMALL
        self.w = MARIO_W
        self.h = MARIO_SMALL_H

        self.facing_right = True
        self._anim_tick  = 0
        self._anim_frame = 0       # 0 or 1  (run1 / run2)

        self._coyote = 0           # coyote-time frame counter
        self._jumped  = False      # True while jump key held (debounce)
        self._jump_held   = False  # True while jump held during this arc
        self._skidding    = False  # True while reversing direction on ground
        self._ducking     = False

        self._was_on_ground = False
        self._prev_vy       = 0.0

        # Size-transition timers
        self._transition_timer = 0
        self._prev_state = SMALL

        self.star_timer    = 0
        self._star_visible = True

        # Death
        self.dead       = False
        self._dead_timer = 0
        self.dead_done  = False

    # ── Dimensions ────────────────────────────────────────────────────────────
    def _apply_size(self):
        new_h = MARIO_SMALL_H if self.state in (SMALL, DEAD) else MARIO_BIG_H
        if self.state == GROW:
            new_h = MARIO_BIG_H
        elif self.state == SHRINK:
            new_h = MARIO_BIG_H
        if new_h != self.h:
            self.y -= (new_h - self.h)
            self.h  = new_h

    # ── Public actions ────────────────────────────────────────────────────────
    def jump(self):
        """Initiate a jump.  Apex scales with current horizontal speed."""
        if self.dead or self.state in (GROW, SHRINK):
            return
        if self.on_ground or self._coyote > 0:
            speed_ratio = min(1.0, abs(self.vx) / RUN_SPEED)
            self.vy = JUMP_VEL + (JUMP_VEL_RUN - JUMP_VEL) * speed_ratio
            self.on_ground = False
            self._coyote   = 0
            sounds.play('jump')

    def stomp_bounce(self):
        self.vy = JUMP_VEL * 0.55

    def grow(self):
        if self.state == SMALL:
            self._prev_state = BIG
            self.state = GROW
            self._transition_timer = 60
            self._apply_size()

    def power_up(self):
        if self.state in (BIG, FIRE):
            self.state = FIRE
        elif self.state == SMALL:
            self.grow()

    def apply_star(self):
        self.star_timer = STAR_DURATION

    def take_hit(self):
        if self.star_timer > 0:
            return
        if self.state == DEAD:
            return
        if self.state in (BIG, FIRE, SHRINK):
            sounds.play('block')   # shrink-hit thump
            self.state = SHRINK
            self._prev_state = SMALL
            self._transition_timer = 60
            self._apply_size()
        elif self.state == SMALL:
            self._die()

    def _die(self):
        self.state = DEAD
        self.dead  = True
        self.vy    = -3.5   # fixed death-bounce height
        self.vx    = 0.0
        self._dead_timer = 180
        sounds.play('death', stop_all=True)

    def pit_death(self):
        if not self.dead:
            self.dead      = True
            self.state     = DEAD
            self.dead_done = True

    # ── Update ────────────────────────────────────────────────────────────────
    def update(self, tiles, keys):
        if self.dead:
            self._update_dead()
            return None

        if self.state in (GROW, SHRINK):
            self._transition_timer -= 1
            if self._transition_timer <= 0:
                self.state = self._prev_state
                self._apply_size()
            self._update_movement(keys, slow=True)
            self._was_on_ground = self.on_ground
            self._prev_vy = self.vy
            hit = self._phys_step(tiles)
            self._post_step()
            return hit

        # Normal update
        self._update_movement(keys, slow=False)
        self._was_on_ground = self.on_ground
        self._prev_vy       = self.vy
        hit = self._phys_step(tiles)
        self._post_step()

        if self.star_timer > 0:
            self.star_timer -= 1
            self._star_visible = (self.star_timer // 4) % 2 == 0

        return hit

    def _phys_step(self, tiles):
        """
        NES-style variable-gravity physics step.
        Returns (col, row) of any ceiling tile activated, or None.
        """
        # Select gravity for this frame
        if self.vy < 0 and self._jump_held:
            grav = GRAVITY_RISE    # holding A while rising  → floaty arc
        elif self.vy < 0:
            grav = GRAVITY_ABORT   # released A while rising → cut short
        else:
            grav = GRAVITY_FALL    # falling                 → snappy drop

        self.on_ground = False
        self.x += self.vx
        resolve_x(self, tiles)

        prev_y   = self.y
        self.vy  = min(self.vy + grav, MAX_FALL)
        self.y  += self.vy
        return resolve_y(self, tiles, prev_y)

    def _update_dead(self):
        if self.dead_done:
            return
        self._dead_timer -= 1
        self.vy  = min(self.vy + 0.38, 6.0)
        self.y  += self.vy
        if self._dead_timer <= 0:
            self.dead_done = True

    def _update_movement(self, keys, slow=False):
        run          = keys.get('run', False)
        left         = keys.get('left', False)
        right        = keys.get('right', False)
        jump_pressed = keys.get('jump', False)
        duck         = keys.get('duck', False)

        # Track for variable gravity in _phys_step
        self._jump_held = jump_pressed

        # Scale factors during size-transition animation
        s       = 0.5 if slow else 1.0
        max_spd = (RUN_SPEED  if run else WALK_SPEED) * s
        accel   = (ACCEL_RUN  if run else ACCEL_WALK) * s
        decel   = DECEL      * s
        skid    = DECEL_SKID * s

        # ── Duck (big/fire only) ──────────────────────────────────────────────
        self._ducking = False
        if duck and self.state in (BIG, FIRE):
            self._ducking = True
            if self.h != 6:
                self.y += self.h - 6
                self.h = 6
            # Slide at half speed while crouching
            if right:
                self.vx = min(self.vx + accel * 0.5, max_spd * 0.5)
                self.facing_right = True
            elif left:
                self.vx = max(self.vx - accel * 0.5, -max_spd * 0.5)
                self.facing_right = False
            else:
                self.vx *= 0.85
            return   # no jumping while ducking
        else:
            if self.state in (BIG, FIRE) and self.h == 6:
                self.h  = MARIO_BIG_H
                self.y -= MARIO_BIG_H - 6

        # ── Horizontal inertia (NES sub-pixel feel) ───────────────────────────
        self._skidding = False
        if right:
            if self.vx < 0:                    # reversing: bleed off leftward speed
                self._skidding = True
                self.vx = min(0.0, self.vx + skid)
            elif self.vx < max_spd:            # accelerate toward cap
                self.vx = min(self.vx + accel, max_spd)
            elif self.vx > max_spd:            # over-speed (was running): coast down
                self.vx = max(self.vx - decel, max_spd)
            self.facing_right = True
        elif left:
            if self.vx > 0:
                self._skidding = True
                self.vx = max(0.0, self.vx - skid)
            elif self.vx > -max_spd:
                self.vx = max(self.vx - accel, -max_spd)
            elif self.vx < -max_spd:
                self.vx = min(self.vx + decel, -max_spd)
            self.facing_right = False
        else:
            # No directional key: decelerate to rest
            if self.vx > 0:
                self.vx = max(0.0, self.vx - decel)
            elif self.vx < 0:
                self.vx = min(0.0, self.vx + decel)

        # ── Jump ─────────────────────────────────────────────────────────────
        if jump_pressed and not self._jumped:
            self.jump()
            self._jumped = True
        if not jump_pressed:
            self._jumped = False

    def _post_step(self):
        if self.on_ground:
            self._coyote = COYOTE_FRAMES
        elif self._coyote > 0:
            self._coyote -= 1

        # Run animation
        if abs(self.vx) > 0.1:
            self._anim_tick += 1
            if self._anim_tick >= 8:
                self._anim_tick  = 0
                self._anim_frame ^= 1
        else:
            self._anim_frame = 0
            self._anim_tick  = 0

    # ── Render ────────────────────────────────────────────────────────────────
    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        if self.star_timer > 0 and not self._star_visible:
            return

        sprite = self._pick_sprite()
        if sprite is None:
            return

        if not self.facing_right:
            sprite = flip_h(sprite)

        draw_sprite(surface, sprite, int(self.x) - cam_x, int(self.y) - cam_y)

    def _pick_sprite(self):
        s = self.state
        if s == DEAD:
            return MARIO_SMALL['dead']
        if s in (GROW, SHRINK):
            bank = MARIO_BIG if (self._transition_timer // 5) % 2 == 0 else MARIO_SMALL
            return bank['idle']

        bank = {SMALL: MARIO_SMALL, BIG: MARIO_BIG, FIRE: MARIO_FIRE}.get(s, MARIO_SMALL)

        if not self.on_ground:
            return bank['jump']
        if self._ducking:
            return bank.get('duck', bank['idle'])
        if self._skidding and abs(self.vx) > 0.05:
            return bank['idle']   # planted-feet skid (no dedicated skid sprite)
        if abs(self.vx) > 0.1:
            return bank['run1'] if self._anim_frame == 0 else bank['run2']
        return bank['idle']
