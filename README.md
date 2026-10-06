# Matrix Games

A collection of matrix-themed LED games for two 24×24 LED matrices (48×24 canvas).

## Desktop app (Electron)

Snake, Pong and Mario Jump in one app, built with the same architecture and design as the [Netzwerkplaner](https://github.com/Nomisimo/Netzwerkplaner) (Electron, React, esbuild), with a green accent colour.

- Pick the game in the top bar; keys are listed under the game.
- **sACN (E1.31):** start universe per matrix (default 29 and 33), pixels per universe (default 144 = 9 tiles of 4×4), network card to send from. Same tile mapping as `matrix-snake/sacn_output.py`.
- **NDI:** 480×240 BGRA stream at 60 fps (every pixel 10×10). Needs the [NDI Runtime](https://ndi.video/tools/); it is loaded with `koffi`, the same way the Python version uses ctypes.
- **Live view:** both matrices drawn exactly as the frame goes out on the network.
- Output keeps running while you switch games and while the window is minimised.

```bash
npm install
npm start          # build the UI and start Electron
npm test           # unit tests (game logic, sACN packets, NDI frame)
npm run dist:mac   # .dmg (arm64 + x64)
npm run dist:win   # .exe installer (NSIS, x64)
```

```
src/main/          Electron main process; spiele/ausgabe.js = sACN and NDI sender
src/preload/       IPC bridge (contextBridge)
src/renderer/      React UI (App.jsx), sound (spiele/ton.js)
src/shared/spiele/ game logic without UI: snake.js, pong.js, mario/
test/              unit tests (node:test)
```

The game logic is a 1:1 port of the Python games below: with the same inputs, every frame has the same pixels.

## Python games

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
