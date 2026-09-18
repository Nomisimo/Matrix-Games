import math
import random
import pygame
import sounds
from font import draw_text, text_width

W, H = 48, 24

PINK        = (255, 50, 180)
SCORE_COLOR = (180, 80, 240)

BALL_SPEED_INIT = 0.5
BALL_SPEED_MAX  = 1.8
BALL_ACCEL      = 0.05
PADDLE_SPEED    = 0.55

WINNING_SCORE = 7

TOP_WALL    = 0
BOTTOM_WALL = 23
PLAY_TOP    = 1
PADDLE_MIN  = 1.0
PADDLE_MAX  = 17.0  # 17 + 6 = 23

# AI skill curve: frames since last point → reaction improves
# dead zone shrinks from 3.0 → 0.5 px, speed grows from 40% → 100%
_AI_DEAD_ZONE_START = 3.0
_AI_DEAD_ZONE_MIN   = 0.5
_AI_SPEED_START     = 0.40   # fraction of PADDLE_SPEED at frame 0
_AI_RAMP_FRAMES     = 180    # full skill reached after 3 seconds


class Ball:
    def __init__(self):
        self.x  = 23.0
        self.y  = 11.0
        self.vx = 0.0
        self.vy = 0.0
        self.w  = 2
        self.h  = 2


class Paddle:
    def __init__(self, x):
        self.x  = x
        self.y  = 9.0
        self.vy = 0.0
        self.w  = 1
        self.h  = 6


def reset_ball(ball, direction=None):
    ball.x = 23.0
    ball.y = 11.0
    angle  = random.uniform(-0.4, 0.4)
    if direction is None:
        direction = random.choice([-1, 1])
    speed   = BALL_SPEED_INIT
    ball.vx = direction * speed * math.cos(angle)
    ball.vy = speed * math.sin(angle)


def _hits_paddle(ball, paddle):
    return (ball.x < paddle.x + paddle.w and
            ball.x + 2 > paddle.x and
            ball.y < paddle.y + paddle.h and
            ball.y + 2 > paddle.y)


def _speed(ball):
    return math.hypot(ball.vx, ball.vy)


def _set_speed(ball, s):
    cur = _speed(ball)
    if cur > 0:
        ball.vx = ball.vx / cur * s
        ball.vy = ball.vy / cur * s


class Game:
    def __init__(self, two_player=False):
        self.two_player        = two_player
        self.ball              = Ball()
        self.left              = Paddle(1)
        self.right             = Paddle(46)
        self.score_left        = 0
        self.score_right       = 0
        self.frames_since_point = 0   # drives AI skill ramp
        reset_ball(self.ball)

    def _ai_update(self, ball, paddle):
        t = min(1.0, self.frames_since_point / _AI_RAMP_FRAMES)
        dead_zone = _AI_DEAD_ZONE_START + (_AI_DEAD_ZONE_MIN - _AI_DEAD_ZONE_START) * t
        speed     = PADDLE_SPEED * (_AI_SPEED_START + (1.0 - _AI_SPEED_START) * t)

        center = paddle.y + paddle.h / 2
        if abs(ball.y - center) > dead_zone:
            paddle.vy = speed * (1 if ball.y > center else -1)
        else:
            paddle.vy = 0.0

    def update(self, keys):
        ball  = self.ball
        left  = self.left
        right = self.right

        self.frames_since_point += 1

        # Left paddle — always WASD
        if keys[pygame.K_w]:
            left.vy = -PADDLE_SPEED
        elif keys[pygame.K_s]:
            left.vy = PADDLE_SPEED
        else:
            left.vy = 0.0
        left.y = max(PADDLE_MIN, min(PADDLE_MAX, left.y + left.vy))

        # Right paddle — arrow keys (2P) or AI (1P)
        if self.two_player:
            if keys[pygame.K_UP]:
                right.vy = -PADDLE_SPEED
            elif keys[pygame.K_DOWN]:
                right.vy = PADDLE_SPEED
            else:
                right.vy = 0.0
        else:
            self._ai_update(ball, right)
        right.y = max(PADDLE_MIN, min(PADDLE_MAX, right.y + right.vy))

        ball.x += ball.vx
        ball.y += ball.vy

        if ball.y <= PLAY_TOP:
            ball.y  = float(PLAY_TOP)
            ball.vy = abs(ball.vy)
            sounds.play_wall()
        if ball.y + 2 >= BOTTOM_WALL:
            ball.y  = float(BOTTOM_WALL - 2)
            ball.vy = -abs(ball.vy)
            sounds.play_wall()

        for paddle in (left, right):
            if _hits_paddle(ball, paddle):
                ball.vx = -ball.vx
                hit_pos  = (ball.y + 1) - (paddle.y + paddle.h / 2)
                ball.vy += hit_pos * 0.2
                new_speed = min(_speed(ball) * (1 + BALL_ACCEL), BALL_SPEED_MAX)
                _set_speed(ball, new_speed)
                if paddle.x == 1:
                    ball.x = paddle.x + paddle.w
                else:
                    ball.x = paddle.x - ball.w
                sounds.play_paddle()

        scored = None
        if ball.x + 2 < 0:
            self.score_right += 1
            self.frames_since_point = 0
            sounds.play_score()
            scored = 1
        elif ball.x > 47:
            self.score_left += 1
            self.frames_since_point = 0
            sounds.play_score()
            scored = -1

        return scored

    def render(self, canvas):
        canvas.fill((0, 0, 0))

        pygame.draw.line(canvas, PINK, (0, TOP_WALL),    (47, TOP_WALL))
        pygame.draw.line(canvas, PINK, (0, BOTTOM_WALL), (47, BOTTOM_WALL))

        for y in range(PLAY_TOP, BOTTOM_WALL, 2):
            canvas.set_at((23, y), PINK)

        for paddle in (self.left, self.right):
            for dy in range(paddle.h):
                canvas.set_at((paddle.x, int(paddle.y) + dy), PINK)

        for dy in range(2):
            for dx in range(2):
                canvas.set_at((int(self.ball.x) + dx, int(self.ball.y) + dy), PINK)

        ls = str(self.score_left)
        draw_text(canvas, ls, 22 - text_width(ls), 1, SCORE_COLOR)
        draw_text(canvas, str(self.score_right), 25, 1, SCORE_COLOR)
