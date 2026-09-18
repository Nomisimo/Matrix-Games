import sys
import time
import pygame
from font import draw_text, text_width
from game import (Game, reset_ball, WINNING_SCORE,
                  TOP_WALL, BOTTOM_WALL, PLAY_TOP, PINK, SCORE_COLOR)
import sounds
import ndi_output

W, H  = 48, 24
SCALE = 20
FPS   = 60

TITLE        = 'title'
PLAYING      = 'playing'
POINT_SCORED = 'point_scored'
GAME_OVER    = 'game_over'

POINT_PAUSE_FRAMES = 60

_lobby = {
    'bx': 23.0, 'by': 11.0,
    'bvx': 0.55, 'bvy': 0.38,
    'frame': 0,
    'mode': 1,   # 1 = vs AI, 2 = two player
}


def _update_lobby():
    b = _lobby
    b['bx'] += b['bvx']
    b['by'] += b['bvy']
    if b['bx'] <= 2:
        b['bx'] = 2.0
        b['bvx'] = abs(b['bvx'])
    if b['bx'] >= 44:
        b['bx'] = 44.0
        b['bvx'] = -abs(b['bvx'])
    if b['by'] <= PLAY_TOP:
        b['by'] = float(PLAY_TOP)
        b['bvy'] = abs(b['bvy'])
    if b['by'] + 2 >= BOTTOM_WALL:
        b['by'] = float(BOTTOM_WALL - 2)
        b['bvy'] = -abs(b['bvy'])
    b['frame'] += 1


def draw_centered(canvas, text, y, color):
    draw_text(canvas, text, (W - text_width(text)) // 2, y, color)


def render_lobby(canvas):
    canvas.fill((0, 0, 0))

    pygame.draw.line(canvas, PINK, (0, TOP_WALL),    (47, TOP_WALL))
    pygame.draw.line(canvas, PINK, (0, BOTTOM_WALL), (47, BOTTOM_WALL))

    for y in range(PLAY_TOP, BOTTOM_WALL, 2):
        canvas.set_at((23, y), PINK)

    # Demo paddles
    for dy in range(6):
        canvas.set_at((1,  9 + dy), PINK)
        canvas.set_at((46, 9 + dy), PINK)

    # Demo ball
    bx, by = int(_lobby['bx']), int(_lobby['by'])
    for dy in range(2):
        for dx in range(2):
            canvas.set_at((bx + dx, by + dy), PINK)

    # --- text drawn last so it always sits on top of the ball ---

    # Title — erase dashes behind it first, then draw
    title_x = (W - text_width('PONG')) // 2
    for py in range(3, 8):
        for px in range(title_x, title_x + text_width('PONG')):
            canvas.set_at((px, py), (0, 0, 0))
    draw_centered(canvas, 'PONG', 3, PINK)

    mode = _lobby['mode']

    # Mode tabs
    c1 = PINK if mode == 1 else SCORE_COLOR
    c2 = PINK if mode == 2 else SCORE_COLOR
    draw_text(canvas, '1P', 8,  12, c1)
    draw_text(canvas, '2P', 32, 12, c2)

    # Selection underline
    sel_x = 8 if mode == 1 else 32
    for dx in range(7):
        canvas.set_at((sel_x + dx, 18), PINK)


def render_game_over(canvas, game):
    canvas.fill((0, 0, 0))

    pygame.draw.line(canvas, PINK, (0, TOP_WALL),    (47, TOP_WALL))
    pygame.draw.line(canvas, PINK, (0, BOTTOM_WALL), (47, BOTTOM_WALL))

    for y in range(PLAY_TOP, BOTTOM_WALL, 2):
        canvas.set_at((23, y), PINK)

    ls = str(game.score_left)
    draw_text(canvas, ls, 22 - text_width(ls), 1, SCORE_COLOR)
    draw_text(canvas, str(game.score_right), 25, 1, SCORE_COLOR)

    winner = 'P1' if game.score_left >= WINNING_SCORE else (
        'COM' if not game.two_player else 'P2'
    )
    draw_centered(canvas, winner + ' WINS', 9, PINK)
    draw_centered(canvas, 'PRESS SPACE', 17, PINK)


def main():
    cfg = ndi_output.load_config()
    if cfg.get('ndi_enabled', True):
        ndi_output.init(cfg)

    pygame.init()
    sounds.init()
    screen = pygame.display.set_mode((W * SCALE, H * SCALE))
    pygame.display.set_caption('Pong')
    clock  = pygame.time.Clock()
    canvas = pygame.Surface((W, H))

    state         = TITLE
    game          = None
    pause_timer   = 0
    last_scorer   = None
    window_active = True

    while True:
        frame_start = time.monotonic()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                ndi_output.shutdown()
                pygame.quit()
                sys.exit()
            if event.type == pygame.WINDOWMINIMIZED:
                window_active = False
            elif event.type in (pygame.WINDOWRESTORED, pygame.WINDOWFOCUSGAINED):
                window_active = True
            if event.type == pygame.KEYDOWN:
                if state == TITLE:
                    if event.key == pygame.K_LEFT or event.key == pygame.K_1:
                        _lobby['mode'] = 1
                    elif event.key == pygame.K_RIGHT or event.key == pygame.K_2:
                        _lobby['mode'] = 2
                    elif event.key in (pygame.K_SPACE, pygame.K_RETURN):
                        game  = Game(two_player=(_lobby['mode'] == 2))
                        state = PLAYING
                elif state == GAME_OVER and event.key == pygame.K_SPACE:
                    state = TITLE

        keys = pygame.key.get_pressed()

        if state == TITLE:
            _update_lobby()
        elif state == PLAYING:
            scored = game.update(keys)
            if scored is not None:
                last_scorer = scored
                if game.score_left >= WINNING_SCORE or game.score_right >= WINNING_SCORE:
                    state = GAME_OVER
                else:
                    pause_timer = POINT_PAUSE_FRAMES
                    state       = POINT_SCORED
        elif state == POINT_SCORED:
            pause_timer -= 1
            if pause_timer <= 0:
                reset_ball(game.ball, direction=last_scorer)
                state = PLAYING

        if state == TITLE:
            render_lobby(canvas)
        elif state == GAME_OVER:
            render_game_over(canvas, game)
        else:
            game.render(canvas)

        # NDI output — send before scaling, after all rendering
        if cfg.get('ndi_enabled', True):
            ndi_output.send_frame(canvas, cfg)

        if window_active:
            scaled = pygame.transform.scale(canvas, (W * SCALE, H * SCALE))
            screen.blit(scaled, (0, 0))
            pygame.display.flip()
            clock.tick(FPS)
        else:
            elapsed = time.monotonic() - frame_start
            time.sleep(max(0.0, 1 / FPS - elapsed))


if __name__ == '__main__':
    main()
