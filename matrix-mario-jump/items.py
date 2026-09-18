"""
Collectible items: Mushroom, FireFlower, Coin, Star, Debris.
"""
import math
import pygame
from constants import TILE, JUMP_VEL, GRAVITY, MAX_FALL
from sprites import MUSHROOM, FIRE_FLOWER, COIN, STAR, ONEUP, DEBRIS, draw_sprite, flip_h
from physics import step_entity, resolve_x


class Mushroom:
    """Pops out of a block, falls with gravity, slides right, turns at walls."""
    w = 4
    h = 5

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = 0.6
        self.vy = JUMP_VEL * 0.4   # small initial pop
        self.on_ground = False
        self.collected = False
        self.remove = False

    def update(self, tiles):
        if self.remove:
            return

        prev_vx = self.vx
        step_entity(self, tiles)

        # If vx was zeroed by resolve_x → hit a wall → reverse
        if prev_vx != 0 and self.vx == 0:
            self.vx = -prev_vx

    def collect(self):
        self.collected = True
        self.remove = True

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        draw_sprite(surface, MUSHROOM, int(self.x) - cam_x, int(self.y) - cam_y)


class OneUp(Mushroom):
    """1UP mushroom — green variant."""
    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        draw_sprite(surface, ONEUP, int(self.x) - cam_x, int(self.y) - cam_y)


class FireFlower:
    """Stationary, bobs up and down ±1 px over 60 frames."""
    w = 4
    h = 5

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.on_ground = False
        self._base_y = y
        self._tick = 0
        self.collected = False
        self.remove = False

    def update(self, tiles):
        if self.remove:
            return
        self._tick += 1
        self.y = self._base_y + math.sin(self._tick * math.pi / 30.0)

    def collect(self):
        self.collected = True
        self.remove = True

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        draw_sprite(surface, FIRE_FLOWER, int(self.x) - cam_x, int(self.y) - cam_y)


class Coin:
    """Rises 6 px over 20 frames then disappears."""
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self._start_y = y
        self._timer = 20
        self.remove = False

    def update(self, tiles):
        if self.remove:
            return
        self._timer -= 1
        progress = 1.0 - self._timer / 20.0
        self.y = self._start_y - progress * 6
        if self._timer <= 0:
            self.remove = True

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        if not self.remove:
            draw_sprite(surface, COIN, int(self.x) - cam_x, int(self.y) - cam_y)


class Star:
    """Bounces with gravity, slides right fast."""
    w = 4
    h = 4

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = 1.5
        self.vy = JUMP_VEL * 0.6
        self.on_ground = False
        self.collected = False
        self.remove = False

    def update(self, tiles):
        if self.remove:
            return
        prev_vx = self.vx
        step_entity(self, tiles)
        # Bounce off walls
        if prev_vx != 0 and self.vx == 0:
            self.vx = -prev_vx
        # Bounce off ground
        if self.on_ground:
            self.vy = JUMP_VEL * 0.7

    def collect(self):
        self.collected = True
        self.remove = True

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        draw_sprite(surface, STAR, int(self.x) - cam_x, int(self.y) - cam_y)


class DebrisParticle:
    """One of four particles from a broken brick."""
    def __init__(self, x: float, y: float, vx: float, vy: float):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.remove = False

    def update(self, tiles):
        self.vy = min(self.vy + GRAVITY, MAX_FALL)
        self.x += self.vx
        self.y += self.vy
        # Remove when off top/bottom of logical canvas
        if self.y > 24 or self.y < -8:
            self.remove = True

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        draw_sprite(surface, DEBRIS, int(self.x) - cam_x, int(self.y) - cam_y)


def spawn_debris(col: int, row: int) -> list:
    """Return 4 DebrisParticle instances for a broken brick at (col, row)."""
    cx = col * 4 + 2
    cy = row * 4 + 2
    return [
        DebrisParticle(cx - 2, cy - 2, -1.5, -2.5),
        DebrisParticle(cx,     cy - 2,  1.5, -2.5),
        DebrisParticle(cx - 2, cy,     -1.5,  1.5),
        DebrisParticle(cx,     cy,      1.5,  1.5),
    ]
