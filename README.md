# Matrix Games

A collection of matrix-themed LED games built with Python.

## Games

| Game | Description |
|------|-------------|
| [matrix-mario-jump](matrix-mario-jump/) | Mario-style platformer |
| [matrix-pong](matrix-pong/) | Classic Pong |
| [matrix-snake](matrix-snake/) | Classic Snake |

## Running a game

```bash
cd matrix-mario-jump   # or matrix-pong / matrix-snake
python main.py
```

---

## Configuration

### Matrix Pong — `matrix-pong/config.json`

```json
{
  "ndi_stream_name": "Matrix Pong",
  "ndi_enabled": true
}
```

| Key | Type | Description |
|-----|------|-------------|
| `ndi_stream_name` | string | Name of the NDI output stream visible to receivers |
| `ndi_enabled` | bool | `true` to send NDI output, `false` to disable |

---

### Matrix Snake — `matrix-snake/config.json`

```json
{
  "output_mode": "ndi",
  "ndi_stream_name": "Matrix Snake",
  "matrix1_universe_start": 29,
  "matrix2_universe_start": 33,
  "fixtures_per_universe": 144,
  "bind_ip": "2.2.4.30"
}
```

| Key | Type | Description |
|-----|------|-------------|
| `output_mode` | string | `"ndi"`, `"sacn"`, or `"both"` |
| `ndi_stream_name` | string | Name of the NDI output stream |
| `matrix1_universe_start` | int | First sACN universe for matrix 1 |
| `matrix2_universe_start` | int | First sACN universe for matrix 2 |
| `fixtures_per_universe` | int | Number of fixtures per sACN universe |
| `bind_ip` | string | Local IP address to bind the sACN socket to |

---

### Matrix Mario Jump — `matrix-mario-jump/constants.py`

Mario Jump has no JSON config — settings live in `constants.py`.

| Constant | Default | Description |
|----------|---------|-------------|
| `W`, `H` | `48`, `24` | Canvas size in pixels |
| `SCALE` | `20` | Window scale factor (canvas × scale = screen size) |
| `FPS` | `60` | Target frame rate |
| `GRAVITY` | `0.38` | Gravity for enemies & items (px/frame²) |
| `MAX_FALL` | `3.5` | Max fall speed (px/frame) |
| `WALK_SPEED` | `0.6` | Max walking velocity (px/frame) |
| `RUN_SPEED` | `1.4` | Max running velocity (px/frame) |
| `JUMP_VEL` | `-2.5` | Jump impulse at walk speed |
| `JUMP_VEL_RUN` | `-3.2` | Jump impulse at full run speed |
| `SKY` | `(92, 148, 252)` | Background sky colour (RGB) |
