import random
from collections import deque
import pygame
from font import draw_text, text_width
import sounds

# Colors
WALL    = (55, 55, 55)
HEAD    = (0, 255, 80)
BODY    = (0, 185, 55)
FOOD    = (255, 65, 35)
SCORE_C = (175, 75, 240)

# Grid bounds — play area inside 1-px walls
X1, X2 = 1, 46
Y1, Y2 = 1, 22

# Tick intervals (seconds) per speed level
TICK_RATES = [0.200, 0.170, 0.140, 0.110, 0.085, 0.065, 0.050]
FOODS_PER_LEVEL = 5


class Snake:
    def __init__(self):
        sx = (X1 + X2) // 2
        sy = (Y1 + Y2) // 2
        self.body = deque([(sx, sy), (sx - 1, sy), (sx - 2, sy)])
        self.dir = (1, 0)
        self.pending = (1, 0)
        self.growth = 0

    def set_dir(self, dx, dy):
        # Ignore direct reversal
        if (dx, dy) != (-self.dir[0], -self.dir[1]):
            self.pending = (dx, dy)

    @property
    def head(self):
        return self.body[0]

    def occupancy(self):
        return set(self.body)


class Game:
    def __init__(self):
        self.snake = Snake()
        self.score = 0
        self.food_count = 0
        self.level = 0
        self.tick_rate = TICK_RATES[0]
        self.accum = 0.0
        self.blink = 0.0
        self.food = None
        self._spawn_food()

    def _ui_cells(self):
        cells = set()
        # Score text: x=2, y=1, 5 rows tall — width grows with score
        sw = text_width(str(self.score))
        for y in range(1, 6):
            for x in range(2, 2 + sw):
                cells.add((x, y))
        # Level text: top-right, same rows
        lvl_str = 'L' + str(self.level + 1)
        lw = text_width(lvl_str)
        for y in range(1, 6):
            for x in range(45 - lw, 45):
                cells.add((x, y))
        return cells

    def _spawn_food(self):
        occ = self.snake.occupancy() | self._ui_cells()
        total = (X2 - X1 + 1) * (Y2 - Y1 + 1)
        if len(occ) >= total:
            self.food = None
            return
        for _ in range(10000):
            x = random.randint(X1, X2)
            y = random.randint(Y1, Y2)
            if (x, y) not in occ:
                self.food = (x, y)
                return

    def handle_key(self, key):
        mapping = {
            pygame.K_UP:    (0, -1), pygame.K_w: (0, -1),
            pygame.K_DOWN:  (0,  1), pygame.K_s: (0,  1),
            pygame.K_LEFT:  (-1, 0), pygame.K_a: (-1, 0),
            pygame.K_RIGHT: (1,  0), pygame.K_d: (1,  0),
        }
        if key in mapping:
            self.snake.set_dir(*mapping[key])

    def update(self, dt):
        self.blink += dt
        self.accum += dt
        while self.accum >= self.tick_rate:
            self.accum -= self.tick_rate
            if self._tick():
                return 'dead'
        return None

    def _tick(self):
        s = self.snake
        s.dir = s.pending
        dx, dy = s.dir
        hx, hy = s.head
        nx, ny = hx + dx, hy + dy

        # Wall collision
        if not (X1 <= nx <= X2 and Y1 <= ny <= Y2):
            sounds.play_die()
            return True

        # Self collision — tail exception: when not growing, tail vacates this tick
        occ = s.occupancy()
        if s.growth > 0:
            if (nx, ny) in occ:
                sounds.play_die()
                return True
        else:
            tail = s.body[-1]
            if (nx, ny) in occ - {tail}:
                sounds.play_die()
                return True

        s.body.appendleft((nx, ny))

        if (nx, ny) == self.food:
            sounds.play_eat()
            self.food_count += 1
            self.score += 10 * (self.level + 1)
            s.growth += 3
            self._check_level()
            self._spawn_food()

        if s.growth > 0:
            s.growth -= 1
        else:
            s.body.pop()

        return False

    def _check_level(self):
        new_lvl = min(self.food_count // FOODS_PER_LEVEL, len(TICK_RATES) - 1)
        if new_lvl > self.level:
            self.level = new_lvl
            self.tick_rate = TICK_RATES[self.level]

    def render(self, canvas):
        canvas.fill((0, 0, 0))

        # Walls (1-px border)
        pygame.draw.rect(canvas, WALL, (0,  0, 48,  1))
        pygame.draw.rect(canvas, WALL, (0, 23, 48,  1))
        pygame.draw.rect(canvas, WALL, (0,  0,  1, 24))
        pygame.draw.rect(canvas, WALL, (47, 0,  1, 24))

        # Food — blinks at ~6 Hz, visible 2/3 of the time
        if self.food and int(self.blink * 6) % 3 != 0:
            canvas.set_at(self.food, FOOD)

        # Snake body (head drawn last so it's never hidden)
        body_list = list(self.snake.body)
        for i in range(len(body_list) - 1, -1, -1):
            x, y = body_list[i]
            canvas.set_at((x, y), HEAD if i == 0 else BODY)

        # Score — top-left, drawn over everything so always visible
        draw_text(canvas, str(self.score), 2, 1, SCORE_C)

        # Level — top-right
        lvl_str = 'L' + str(self.level + 1)
        lw = text_width(lvl_str)
        draw_text(canvas, lvl_str, 45 - lw, 1, SCORE_C)
