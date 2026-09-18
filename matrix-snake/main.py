import sys
import time
import pygame
from font import draw_text, text_width
from game import Game
import sounds
import sacn_output
import ndi_output

SCALE = 20
CW, CH = 48, 24


def cx(text):
    return (CW - text_width(text)) // 2


def render_title(canvas, blink, high):
    canvas.fill((0, 0, 0))

    title = 'SNAKE'
    draw_text(canvas, title, cx(title), 4, (0, 255, 80))

    # Decorative snake + food
    deco_body = [
        (32, 10), (31, 10), (30, 10), (29, 10), (28, 10),
        (28, 11), (28, 12), (29, 12), (30, 12), (31, 12),
    ]
    for i, (x, y) in enumerate(deco_body):
        canvas.set_at((x, y), (0, 255, 80) if i == 0 else (0, 185, 55))
    canvas.set_at((34, 10), (255, 65, 35))  # food

    if int(blink * 2) % 2 == 0:
        msg = 'PRESS SPACE'
        draw_text(canvas, msg, cx(msg), 14, (175, 75, 240))

    if high > 0:
        hs = 'BEST ' + str(high)
        draw_text(canvas, hs, cx(hs), 18, (90, 90, 200))


def render_paused(canvas):
    msg = 'PAUSE'
    x = cx(msg)
    y = 9
    # Dark background behind text
    pygame.draw.rect(canvas, (0, 0, 0), (x - 2, y - 1, text_width(msg) + 4, 7))
    draw_text(canvas, msg, x, y, (255, 230, 50))


def render_game_over(canvas, score, high, blink):
    canvas.fill((0, 0, 0))

    # Top line alternates between GAME OVER and SPACE hint
    if int(blink * 1.5) % 3 < 2:
        msg = 'GAME OVER'
        color = (255, 65, 35)
    else:
        msg = 'SPACE'
        color = (200, 200, 200)
    draw_text(canvas, msg, cx(msg), 2, color)

    sc = 'SCORE ' + str(score)
    draw_text(canvas, sc, cx(sc), 9, (175, 75, 240))

    if high > 0:
        if score >= high:
            hs = 'NEW BEST'
            draw_text(canvas, hs, cx(hs), 16, (255, 220, 0))
        else:
            hs = 'BEST ' + str(high)
            draw_text(canvas, hs, cx(hs), 16, (90, 90, 200))


def main():
    cfg  = sacn_output.load_config()
    mode = cfg.get('output_mode', 'sacn')

    if mode in ('sacn', 'both'):
        sacn_output.init(cfg)
    if mode in ('ndi', 'both'):
        ndi_output.init(cfg)

    pygame.init()
    sounds.init()

    screen = pygame.display.set_mode((CW * SCALE, CH * SCALE))
    pygame.display.set_caption('SNAKE')
    canvas = pygame.Surface((CW, CH))
    clock = pygame.time.Clock()

    state = 'title'
    game = None
    high = 0
    blink = 0.0
    window_active = True
    dt = 1 / 60

    while True:
        frame_start = time.monotonic()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                sacn_output.shutdown()
                ndi_output.shutdown()
                pygame.quit()
                sys.exit()

            if event.type == pygame.WINDOWMINIMIZED:
                window_active = False
            elif event.type in (pygame.WINDOWRESTORED, pygame.WINDOWFOCUSGAINED):
                window_active = True

            if event.type == pygame.KEYDOWN:
                if state == 'title':
                    if event.key == pygame.K_SPACE:
                        game = Game()
                        state = 'playing'

                elif state == 'playing':
                    if event.key == pygame.K_ESCAPE:
                        state = 'paused'
                    else:
                        game.handle_key(event.key)

                elif state == 'paused':
                    if event.key in (pygame.K_ESCAPE, pygame.K_SPACE, pygame.K_p):
                        state = 'playing'
                    elif event.key == pygame.K_q:
                        state = 'title'

                elif state == 'game_over':
                    if event.key == pygame.K_SPACE:
                        game = Game()
                        state = 'playing'
                    elif event.key == pygame.K_ESCAPE:
                        state = 'title'

        if state == 'playing':
            result = game.update(dt)
            if result == 'dead':
                if game.score > high:
                    high = game.score
                state = 'game_over'

        # Render
        if state == 'title':
            render_title(canvas, blink, high)
        elif state == 'playing':
            game.render(canvas)
        elif state == 'paused':
            game.render(canvas)
            render_paused(canvas)
        elif state == 'game_over':
            render_game_over(canvas, game.score, high, blink)

        if mode in ('sacn', 'both'):
            sacn_output.send_frame(canvas, cfg)
        if mode in ('ndi', 'both'):
            ndi_output.send_frame(canvas, cfg)

        if window_active:
            scaled = pygame.transform.scale(canvas, (CW * SCALE, CH * SCALE))
            screen.blit(scaled, (0, 0))
            pygame.display.flip()
            dt = clock.tick(60) / 1000.0
        else:
            # Window minimised — skip screen rendering so macOS doesn't throttle us.
            # Sleep the remainder of the frame manually to keep NDI at 60 fps.
            elapsed = time.monotonic() - frame_start
            time.sleep(max(0.0, 1 / 60 - elapsed))
            dt = 1 / 60

        blink += dt


if __name__ == '__main__':
    main()
