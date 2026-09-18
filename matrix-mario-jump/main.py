"""
Entry point — pygame init, game-state machine, window scaling.

States: TITLE → PLAYING → DEAD_ANIM → PLAYING / GAME_OVER → TITLE
"""
import sys
import argparse
import pygame
import sounds                                   # must import before pygame.init
from constants import W, H, SCALE, FPS, SKY, COL_WHITE, COL_SCORE, COL_RED
from font import draw_text, text_width
from engine import Game


# ── State labels ──────────────────────────────────────────────────────────────
TITLE     = 'title'
PLAYING   = 'playing'
DEAD_ANIM = 'dead_anim'
GAME_OVER = 'game_over'


def _centered_text(canvas, text, y, color):
    tw = text_width(text)
    draw_text(canvas, text, (W - tw) // 2, y, color)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fullscreen', action='store_true')
    args = parser.parse_args()

    sounds.pre_init()                           # must run before pygame.init()
    pygame.init()
    sounds.init()                               # build sounds after mixer ready
    pygame.display.set_caption('Super Mario Bros')

    if args.fullscreen:
        screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
    else:
        screen = pygame.display.set_mode((W * SCALE, H * SCALE))

    clock  = pygame.time.Clock()
    canvas = pygame.Surface((W, H))

    state = TITLE
    game  = None
    _title_tick = 0
    _overlay_timer = 0

    def _read_keys():
        k = pygame.key.get_pressed()
        return {
            'left':  k[pygame.K_LEFT]  or k[pygame.K_a],
            'right': k[pygame.K_RIGHT] or k[pygame.K_d],
            'jump':  k[pygame.K_SPACE] or k[pygame.K_UP] or k[pygame.K_w],
            'run':   k[pygame.K_LSHIFT] or k[pygame.K_RSHIFT] or k[pygame.K_z],
            'duck':  k[pygame.K_DOWN]  or k[pygame.K_s],
        }

    running = True
    while running:
        # ── Events ────────────────────────────────────────────────────────────
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False

                elif state == TITLE and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    game  = Game()
                    state = PLAYING
                    sounds.play_music()

                elif state == GAME_OVER and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    game  = Game()
                    state = PLAYING
                    sounds.play_music()

        # ── Update ────────────────────────────────────────────────────────────
        if state == TITLE:
            _title_tick += 1
            canvas.fill(SKY)
            _draw_title(canvas, _title_tick)

        elif state == PLAYING:
            keys = _read_keys()
            game.update(keys)
            canvas.blit(game.render(), (0, 0))

            if game.mario.dead and game.mario.dead_done and not game.game_over:
                state = DEAD_ANIM
                _overlay_timer = 120

            if game.game_over:
                state = GAME_OVER
                _overlay_timer = 180

            if False:  # no win condition in infinite mode
                state = WIN_ANIM
                _overlay_timer = 240

        elif state == DEAD_ANIM:
            _overlay_timer -= 1
            canvas.blit(game.render(), (0, 0))
            _centered_text(canvas, 'MARIO', 6, COL_WHITE)
            _centered_text(canvas, 'x ' + str(game.lives), 12, COL_WHITE)
            if _overlay_timer <= 0:
                game._reset_after_death()
                state = PLAYING
                sounds.play_music()

        elif state == GAME_OVER:
            _overlay_timer -= 1
            canvas.fill(SKY)
            _centered_text(canvas, 'GAME OVER', 7, COL_RED)
            score_str = str(game.score).zfill(6)
            _centered_text(canvas, score_str, 14, COL_SCORE)
            _centered_text(canvas, 'PRESS ENTER', 19, COL_WHITE)

        # ── Scale & flip ──────────────────────────────────────────────────────
        sw, sh = screen.get_size()
        scale_x = sw // W
        scale_y = sh // H
        scale   = min(scale_x, scale_y)
        scaled  = pygame.transform.scale(canvas, (W * scale, H * scale))
        ox = (sw - W * scale) // 2
        oy = (sh - H * scale) // 2
        screen.fill((0, 0, 0))
        screen.blit(scaled, (ox, oy))
        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


def _draw_title(canvas, tick):
    canvas.fill(SKY)

    # Blinking "PRESS ENTER"
    blink = (tick // 30) % 2 == 0

    title_lines = [
        ('SUPER MARIO', 3,  COL_SCORE),
        ('BROS',        10, COL_SCORE),
    ]
    for text, y, col in title_lines:
        _centered_text(canvas, text, y, col)

    if blink:
        _centered_text(canvas, 'PRESS ENTER', 18, COL_WHITE)


if __name__ == '__main__':
    main()
