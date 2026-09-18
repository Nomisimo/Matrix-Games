"""
Goomba and Koopa Troopa enemies.
"""
import pygame
from constants import TILE, LEVEL_H, GRAVITY, MAX_FALL
from sprites import GOOMBA, KOOPA, draw_sprite, flip_h
from physics import step_entity, resolve_x, resolve_y


class Goomba:
    w = 4
    h = 4

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = -0.5
        self.vy = 0.0
        self.on_ground = False
        self.alive = True
        self.squished = False
        self._squish_timer = 0
        self._anim_tick = 0
        self._anim_frame = 0
        self.remove = False   # engine sets True to drop from list

    def update(self, tiles):
        if not self.alive:
            if self.squished:
                self._squish_timer -= 1
                if self._squish_timer <= 0:
                    self.remove = True
            return

        self._turn_at_edge(tiles)

        prev_vx = self.vx
        step_entity(self, tiles)
        if prev_vx != 0 and self.vx == 0:   # hit a wall → reverse
            self.vx = -prev_vx

        # Animate
        self._anim_tick += 1
        if self._anim_tick >= 15:
            self._anim_tick = 0
            self._anim_frame ^= 1

    def _turn_at_edge(self, tiles):
        """Reverse direction if the tile ahead on the ground is empty."""
        if not self.on_ground:
            return
        from physics import _get
        if self.vx > 0:
            ahead_col = int(self.x + self.w) // TILE
        else:
            ahead_col = int(self.x - 1) // TILE
        ground_row = int(self.y + self.h) // TILE
        tile_below = _get(tiles, ahead_col, ground_row)
        if tile_below == ' ':
            self.vx = -self.vx

    def stomp(self):
        """Mario jumped on top."""
        self.alive = False
        self.squished = True
        self._squish_timer = 60
        self.vx = 0.0
        self.vy = 0.0

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        if self.squished:
            sprite = GOOMBA['dead']
        elif self._anim_frame == 0:
            sprite = GOOMBA['walk1']
        else:
            sprite = GOOMBA['walk2']
        draw_sprite(surface, sprite, int(self.x) - cam_x, int(self.y) - cam_y)


class Koopa:
    w = 4
    h = 6    # standing

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y
        self.vx = -0.4
        self.vy = 0.0
        self.on_ground = False
        self.in_shell = False
        self.shell_moving = False
        self.alive = True
        self._anim_tick = 0
        self._anim_frame = 0
        self._shell_kick_delay = 0
        self.remove = False

    @property
    def h(self):
        return 4 if self.in_shell else 6

    @h.setter
    def h(self, v):
        pass   # dynamic via in_shell

    def update(self, tiles):
        if not self.alive:
            self.remove = True
            return

        if self.in_shell and not self.shell_moving:
            # Sitting shell — do nothing, just gravity
            self._shell_kick_delay = max(0, self._shell_kick_delay - 1)
            step_entity(self, tiles)
            return

        self._turn_at_edge(tiles)
        prev_vx = self.vx
        step_entity(self, tiles)
        if prev_vx != 0 and self.vx == 0:   # hit a wall → reverse
            self.vx = -prev_vx

        self._anim_tick += 1
        if self._anim_tick >= 18:
            self._anim_tick = 0
            self._anim_frame ^= 1

    def _turn_at_edge(self, tiles):
        if not self.on_ground:
            return
        from physics import _get
        if self.vx > 0:
            ahead_col = int(self.x + self.w) // TILE
        else:
            ahead_col = int(self.x - 1) // TILE
        ground_row = int(self.y + self.h) // TILE
        if _get(tiles, ahead_col, ground_row) == ' ':
            self.vx = -self.vx

    def stomp(self):
        if not self.in_shell:
            # Enter shell
            self.in_shell = True
            self.shell_moving = False
            self.vx = 0.0
            self._shell_kick_delay = 30
        else:
            # Kick the stopped shell
            if not self.shell_moving and self._shell_kick_delay <= 0:
                self.shell_moving = True
                self.vx = 2.5

    def kick(self, mario_x: float):
        """Mario walks into a stopped shell."""
        if self.in_shell and not self.shell_moving and self._shell_kick_delay <= 0:
            self.shell_moving = True
            self.vx = 2.5 if mario_x < self.x else -2.5

    def render(self, surface: pygame.Surface, cam_x: int, cam_y: int = 0):
        if self.in_shell:
            sprite = KOOPA['shell']
        elif self._anim_frame == 0:
            sprite = KOOPA['walk1']
        else:
            sprite = KOOPA['walk2']
        facing = self.vx >= 0
        if not facing:
            sprite = flip_h(sprite)
        draw_sprite(surface, sprite, int(self.x) - cam_x, int(self.y) - cam_y)
