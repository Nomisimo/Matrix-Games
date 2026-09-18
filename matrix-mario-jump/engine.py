"""
Game class: tile rendering, block activation, camera, HUD, update loop.
Infinite procedural level — tiles generated on demand ahead of the camera.
"""
import pygame
from constants import (
    W, H, TILE, LEVEL_H, GROUND_Y, JUMP_VEL,
    SMALL, BIG, FIRE, DEAD, GROW, SHRINK,
    SKY, COL_WHITE, COL_SCORE, COL_RED,
    MARIO_W, MARIO_SMALL_H, MARIO_BIG_H,
)
from sprites import TILE_MAP, T_QUEST2, draw_sprite
from font import draw_text, text_width
from mario import Mario
from enemies import Goomba, Koopa
from items import Mushroom, FireFlower, Coin, Star, OneUp, spawn_debris
from level_data import gen_column
import sounds


_QUEST_ANIM_SPEED = 30   # frames per ? block frame swap
_GEN_AHEAD = W * 3       # pixels to generate ahead of camera


def _draw_icon(surface, x, y, rows, color):
    """Draw a small single-colour pixel icon from a list of pattern strings ('.' = transparent)."""
    for dy, row_s in enumerate(rows):
        for dx, ch in enumerate(row_s):
            if ch != '.':
                px, py = x + dx, y + dy
                if 0 <= px < W and 0 <= py < H:
                    surface.set_at((px, py), color)


class Game:
    def __init__(self):
        self.canvas = pygame.Surface((W, H))
        self._reset()

    # ── Initialization ────────────────────────────────────────────────────────
    def _reset(self):
        # Infinite tile buffer: tiles[row] is an ever-growing list
        self.tiles     = [[] for _ in range(LEVEL_H)]
        self.level_w   = 0          # number of generated columns so far

        mario_y = GROUND_Y - MARIO_SMALL_H
        self.mario = Mario(float(4 * TILE), float(mario_y))

        self.enemies = []
        self.items   = []

        self.camera_x = 0
        self.score    = 0
        self.coins    = 0
        self.lives    = 3

        self._quest_tick  = 0
        self._quest_frame = 0
        self.game_over    = False
        self.camera_y     = 0

        # Pre-generate the first few screens
        self._ensure_generated((W + _GEN_AHEAD) // TILE)

    def _ensure_generated(self, up_to_col: int):
        """Extend the tile buffer to cover at least up_to_col columns."""
        while self.level_w <= up_to_col:
            col = self.level_w
            col_tiles, enemy_type = gen_column(col)
            for row in range(LEVEL_H):
                self.tiles[row].append(col_tiles[row])
            self.level_w += 1

            if enemy_type:
                ey = float(GROUND_Y - (4 if enemy_type == 'goomba' else 6))
                ex = float(col * TILE)
                if enemy_type == 'goomba':
                    self.enemies.append(Goomba(ex, ey))
                else:
                    self.enemies.append(Koopa(ex, ey))

    # ── Tile helpers ──────────────────────────────────────────────────────────
    def _get_tile(self, col, row):
        if 0 <= row < LEVEL_H and 0 <= col < self.level_w:
            return self.tiles[row][col]
        return ' '

    def _set_tile(self, col, row, ch):
        if 0 <= row < LEVEL_H and 0 <= col < self.level_w:
            self.tiles[row][col] = ch

    # ── Block activation ─────────────────────────────────────────────────────
    def activate_block(self, col, row):
        tile  = self._get_tile(col, row)
        mario = self.mario
        sx    = col * TILE
        sy    = row * TILE

        if tile == '?':
            self._set_tile(col, row, 'H')
            sounds.play('coin')    # block-hit sound (same whether mushroom or flower)
            if mario.state == SMALL:
                self._spawn_mushroom(sx, sy - MARIO_SMALL_H)
            else:
                self._spawn_flower(sx, sy - 5)

        elif tile == 'B':
            if mario.state in (BIG, FIRE):
                self._set_tile(col, row, ' ')
                self.items.extend(spawn_debris(col, row))
                self.score += 50
                sounds.play('brick')

        elif tile == 'N':
            mario.vy = JUMP_VEL * 1.3

    def _spawn_mushroom(self, x, y):
        self.items.append(Mushroom(float(x), float(y)))

    def _spawn_flower(self, x, y):
        self.items.append(FireFlower(float(x), float(y)))

    def _spawn_coin(self, x, y):
        self.items.append(Coin(float(x), float(y - TILE)))
        self.score += 200
        self.coins  += 1
        sounds.play('coin')

    def _spawn_star(self, x, y):
        self.items.append(Star(float(x), float(y)))

    # ── Collision helpers ─────────────────────────────────────────────────────
    def _rects_overlap(self, ax, ay, aw, ah, bx, by, bw, bh):
        return (ax < bx + bw and ax + aw > bx
                and ay < by + bh and ay + ah > by)

    def _mario_hits_enemy(self, enemy):
        m = self.mario
        return self._rects_overlap(m.x, m.y, m.w, m.h,
                                   enemy.x, enemy.y, enemy.w, enemy.h)

    def _mario_stomps_enemy(self, enemy):
        """Mario was in the air, falling (prev_vy≥0), landing on enemy top."""
        m = self.mario
        return (not m._was_on_ground
                and m._prev_vy >= 0
                and m.y + m.h <= enemy.y + 4)

    # ── Main update ───────────────────────────────────────────────────────────
    def update(self, keys):
        if self.game_over:
            return

        # Generate tiles ahead of camera
        ahead_col = (self.camera_x + _GEN_AHEAD) // TILE
        self._ensure_generated(ahead_col)

        mario     = self.mario
        hit_tile  = mario.update(self.tiles, keys)
        if hit_tile:
            self.activate_block(*hit_tile)

        # Pit / fall-off-bottom death
        if mario.y > H and not mario.dead:
            mario.pit_death()

        # ── Enemy updates ─────────────────────────────────────────────────────
        for enemy in self.enemies:
            enemy.update(self.tiles)
            if enemy.remove or not enemy.alive:
                continue
            if not mario.dead and self._mario_hits_enemy(enemy):
                if self._mario_stomps_enemy(enemy):
                    enemy.stomp()
                    self.score += 100
                    mario.stomp_bounce()
                    sounds.play('stomp')
                elif mario.star_timer > 0:
                    enemy.alive  = False
                    enemy.remove = True
                    self.score  += 100
                    sounds.play('stomp')
                elif (hasattr(enemy, 'in_shell') and enemy.in_shell
                      and not enemy.shell_moving):
                    enemy.kick(mario.x)
                    sounds.play('kick')
                else:
                    mario.take_hit()

        # Remove dead enemies and those that have scrolled far off the left
        purge_x = self.camera_x - W * 2
        self.enemies = [e for e in self.enemies
                        if not e.remove and e.x > purge_x]

        # ── Item updates ──────────────────────────────────────────────────────
        for item in self.items:
            item.update(self.tiles)
            if item.remove:
                continue
            if isinstance(item, (Mushroom, OneUp, FireFlower, Star)):
                if self._rects_overlap(mario.x, mario.y, mario.w, mario.h,
                                       item.x, item.y, item.w, item.h):
                    item.collect()
                    if isinstance(item, OneUp):
                        mario.grow()
                        self.score += 1000
                        sounds.play('1up')
                    elif isinstance(item, Mushroom):
                        mario.grow()
                        self.score += 1000
                        sounds.play('powerup')
                    elif isinstance(item, FireFlower):
                        mario.power_up()
                        self.score += 1000
                        sounds.play('powerup')
                    elif isinstance(item, Star):
                        mario.apply_star()
                        self.score += 1000
                        sounds.play('star')

        purge_x_items = self.camera_x - W
        self.items = [i for i in self.items
                      if not i.remove and i.x > purge_x_items]

        # ── Camera (infinite right scroll, never left) ────────────────────────
        target        = int(mario.x) - 10
        self.camera_x = max(self.camera_x, target)
        self.camera_x = max(0, self.camera_x)

        # ── Camera vertical (follow Mario upward, ground stays visible) ────────
        target_y = int(mario.y) - 3    # keep Mario ≥3 px from top
        if target_y < self.camera_y:
            self.camera_y = target_y   # snap up immediately
        elif self.camera_y < 0:
            self.camera_y = min(0, self.camera_y + 1)   # drift back down
        # clamp: camera_y ∈ [-(GROUND_Y - H + 1), 0] so ground stays on screen
        self.camera_y = max(self.camera_y, GROUND_Y - H + 1)   # = -3
        self.camera_y = min(self.camera_y, 0)

        # ── Quest block animation ─────────────────────────────────────────────
        self._quest_tick += 1
        if self._quest_tick >= _QUEST_ANIM_SPEED:
            self._quest_tick  = 0
            self._quest_frame ^= 1

        # ── Death / respawn ───────────────────────────────────────────────────
        if mario.dead_done:
            self.lives -= 1
            if self.lives <= 0:
                self.game_over = True
            else:
                self._reset_after_death()

    def _reset_after_death(self):
        lives = self.lives
        score = self.score
        coins = self.coins
        self._reset()           # full regeneration so enemies reappear
        self.lives = lives
        self.score = score
        self.coins = coins

    # ── Rendering ─────────────────────────────────────────────────────────────
    def render(self):
        canvas = self.canvas
        canvas.fill(SKY)

        cam       = self.camera_x
        cam_y     = self.camera_y
        col_start = cam // TILE
        col_end   = min(self.level_w - 1, (cam + W) // TILE + 1)

        # ── Tiles ─────────────────────────────────────────────────────────────
        for row in range(LEVEL_H):
            for col in range(col_start, col_end + 1):
                tile = self.tiles[row][col]
                if tile == ' ':
                    continue
                sx = col * TILE - cam
                sy = row * TILE - cam_y
                if tile == '?':
                    sprite = T_QUEST2 if self._quest_frame else TILE_MAP['?']
                    draw_sprite(canvas, sprite, sx, sy)
                elif tile in TILE_MAP:
                    draw_sprite(canvas, TILE_MAP[tile], sx, sy)

        # ── Items ─────────────────────────────────────────────────────────────
        for item in self.items:
            item.render(canvas, cam, cam_y)

        # ── Enemies ───────────────────────────────────────────────────────────
        for enemy in self.enemies:
            enemy.render(canvas, cam, cam_y)

        # ── Mario ─────────────────────────────────────────────────────────────
        self.mario.render(canvas, cam, cam_y)

        # ── HUD ───────────────────────────────────────────────────────────────
        self._render_hud(canvas)

        return canvas

    def _render_hud(self, canvas):
        # ── Score (left) ──────────────────────────────────────────────────────
        score_str = str(self.score).zfill(6)
        draw_text(canvas, score_str, 0, 0, COL_SCORE)

        # ── Coin icon + count (center-right) ──────────────────────────────────
        # Diamond coin icon (3×4 px)
        _draw_icon(canvas, 26, 0, [
            '.X.',
            'XXX',
            'XXX',
            '.X.',
        ], (255, 215, 0))
        coin_str = str(self.coins).zfill(2)
        draw_text(canvas, coin_str, 30, 0, COL_WHITE)

        # ── Heart icon + lives (right) ─────────────────────────────────────────
        # Heart icon (3×3 px)
        _draw_icon(canvas, 38, 1, [
            'X.X',
            'XXX',
            '.X.',
        ], COL_RED)
        draw_text(canvas, str(self.lives), 42, 0, COL_WHITE)
