# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

```bash
python3 main.py
```

Requires `pygame`. NDI output requires the NDI Runtime (no pip package needed — pure ctypes):

```bash
pip install pygame
# NDI Runtime: https://ndi.video/tools/ → "NDI Tools" for macOS
```

## Controls

| Key | Action |
|-----|--------|
| W / S | Left paddle (Player 1 in 2P mode) |
| Arrow Up / Down | Right paddle (always) |
| Left / Right arrow or 1 / 2 | Mode select on title screen |
| Space / Enter | Confirm / start |

## Architecture

### Display pipeline

48×24 logical canvas → `ndi_output.send_frame()` → `pygame.transform.scale` → 960×480 screen.

NDI is sent **before** the pygame scale so the LED matrix receives unscaled pixel data.

### File responsibilities

| File | Role |
|------|------|
| `main.py` | pygame init, state machine, render dispatch, NDI wiring |
| `game.py` | `Game` class — paddle/ball physics, AI, scoring, rendering |
| `font.py` | 3×5 px bitmap font — zero-dependency utility |
| `sounds.py` | Procedural square-wave audio — no audio files needed |
| `ndi_output.py` | NDI video stream via ctypes — no pip packages needed |
| `config.json` | Runtime config, auto-created on first run |

### State machine (`main.py`)

```
title (mode select) → playing → point_scored (pause) → playing
                                                      → game_over → title
```

`_lobby` is a module-level dict that holds the animated title-screen ball and the selected mode (`1` = vs AI, `2` = two player). It persists across game sessions.

### Game physics (`game.py`)

- All positions are **floats** (`ball.x`, `ball.y`, `paddle.y`)
- Ball size: 2×2 px. Paddle size: 1×6 px
- Paddle `x` is fixed; only `y` moves
- `PADDLE_MIN = 1.0`, `PADDLE_MAX = 17.0` (so bottom of 6-tall paddle sits at y=22)
- Ball bounces off top/bottom walls and both paddles via AABB `_hits_paddle()`
- Paddle bounce adds spin: `ball.vy += hit_pos * 0.2` (hit relative to paddle center)
- Ball speed ramps with each rally hit: `new_speed = min(speed * (1 + BALL_ACCEL), BALL_SPEED_MAX)`
- Scoring: `ball.x + 2 < 0` → right scores; `ball.x > 47` → left scores

### AI (`game.py → Game._ai_update`)

The AI ramps in difficulty over 3 seconds after each point (`_AI_RAMP_FRAMES = 180`):

```python
t         = min(1.0, frames_since_point / _AI_RAMP_FRAMES)
dead_zone = lerp(3.0 → 0.5, t)   # shrinks — AI gets more precise
speed     = lerp(40% → 100%, t)  # grows — AI gets faster
```

This gives a brief window after each point where the AI makes sloppy mistakes.

### Font (`font.py`)

Glyphs use `X`/`.` encoding (not `1`/`0`). Width is read from `len(rows[0])`. `N` is 4 px wide.

```python
draw_text(surface, 'HELLO', x, y, color)
x = (48 - text_width('HELLO')) // 2   # centering
```

### NDI output (`ndi_output.py`)

Pure ctypes — no pip package. Loads `libndi.dylib` from known paths at startup; silently disables itself if not found.

Output: 480×240 px BGRA @ 60 fps (10× nearest-neighbour upscale from 48×24).

Integration pattern (already in `main.py`):
```python
cfg = ndi_output.load_config()
ndi_output.init(cfg)
# ... in render loop, after game.render(canvas):
ndi_output.send_frame(canvas, cfg)
# ... on quit:
ndi_output.shutdown()
```

When the window is minimised, `main.py` skips `pygame.display.flip()` and manually sleeps the remaining frame budget — NDI keeps running at 60 fps uninterrupted.

### config.json

Auto-created on first run with defaults:

```json
{
  "ndi_enabled": true,
  "ndi_stream_name": "Matrix Pong"
}
```

| Key | Bedeutung |
|-----|-----------|
| `ndi_enabled` | `true` / `false` — NDI stream on/off; set to `false` to run without NDI Runtime installed |
| `ndi_stream_name` | Name of the NDI source visible on the network |

## Coordinate reference

```
(0,0) ─────────────────── (47,0)   ← top wall (drawn pink)
       play area x=1..46, y=1..22
       left paddle:  x=1,  y=1..17
       right paddle: x=46, y=1..17
       center net:   x=23  (dashed)
(0,23) ──────────────────(47,23)   ← bottom wall (drawn pink)
```

Ball starts at `(23, 11)` after each point. `reset_ball(ball, direction)` is called from `main.py` after the `POINT_SCORED` pause expires.

## Physics tuning

Key constants in `game.py`:

| Constant | Effect |
|----------|--------|
| `BALL_SPEED_INIT` | Starting ball speed (px/frame) |
| `BALL_SPEED_MAX` | Speed cap |
| `BALL_ACCEL` | Speed increase per paddle hit |
| `PADDLE_SPEED` | Max paddle movement per frame |
| `_AI_RAMP_FRAMES` | Frames until AI reaches full skill after a point |
| `_AI_SPEED_START` | AI speed fraction at start of ramp (0.0–1.0) |
| `_AI_DEAD_ZONE_START/MIN` | AI precision ramp (px of tolerance) |
