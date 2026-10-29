# Matrix Games

A collection of matrix-themed LED games for two 24×24 LED matrices (48×24 canvas).

## Desktop app (Electron)

Snake, Pong, Mario Jump, Tetris and Pac-Man in one app, built with the same architecture and design as the [Netzwerkplaner](https://github.com/Nomisimo/Netzwerkplaner) (Electron, React, esbuild), with a green accent colour.

- Pick the game in the top bar; keys are listed under the game.
- **Demo / start screen:** every game opens as a text-free demo that plays itself. Enter or Space starts a round; after game over, on Esc, or after 30 s without input it returns to the demo. The **Können der Demo** slider (0–100 %) sets how well Snake and Pong play: at 100 % the snake follows a Hamiltonian cycle and fills the whole board, Mario walks the course endlessly at one speed.
- **Tetris** is a portrait game: the two matrices stand on top of each other (24×48). The board has 10×20 cells of 2×2 pixels, the score is top left, the next piece top right, a faint ghost shows where the piece lands. SRS rotation with wall kicks, 7-bag, NES gravity and scoring, half a second lock delay, level up every 10 lines. Keys: ←/→ move, ↑/W/X rotate right, Z/Y rotate left, ↓ soft drop, Space hard drop; gamepad A rotates right, B/X left, Y hard drop. The game draws in portrait and turns the picture into the 48×24 frame (top of the game = left edge of the frame by default, option `drehung: "links"` for the other way). The demo places every piece by rating height, holes and bumpiness; the skill slider makes it worse and slower.
- **Pac-Man** is a portrait game too (24×48). One field is one pixel: the 24×38 maze follows the arcade layout (tunnel, ghost house, 246 dots and 4 power pellets), score on top, lives and fruit at the bottom. The ghosts behave like the 1980 arcade: Blinky targets Pac-Man, Pinky 4 tiles ahead (with the up-direction overflow bug), Inky mirrors Blinky around the tile 2 ahead, Clyde chases only while more than 8 tiles away; decisions one tile ahead by straight-line distance with the up/left/down/right tie order, no upward turns in the four "red zone" tiles, scatter/chase timetable per level with reversals, frightened mode with per-level duration and flashing, ghost house dot counters (personal and global after a death) plus the 4 s / 3 s idle timer, Cruise Elroy, per-level speed table, tunnel slowdown, Pac-Man pausing on dots and cutting corners. Keys: arrows/WASD. The **Pac-Man: Tempo** setting scales all speeds (100 % = arcade).
- **sACN (E1.31):** start universe per matrix (default 29 and 33), pixels per universe (default 144 = 9 tiles of 4×4), network card to send from. Same tile mapping as `matrix-snake/sacn_output.py`.
- **NDI:** 480×240 BGRA stream at 60 fps (every pixel 10×10). Needs the [NDI Runtime](https://ndi.video/tools/); it is loaded with `koffi`, the same way the Python version uses ctypes.
- **Live view:** both matrices drawn exactly as the frame goes out on the network.
- **Matrix an/aus:** blacks out the LED matrices (sACN and NDI keep sending, but black) while the game keeps running.
- **Input:** keyboard (also through a KVM switch or KVM-over-IP, as long as the app window has focus) and gamepads (D-pad/stick = arrows, A = jump/start, B/X = run/fire, Start = Enter, Select = Esc; in Pong pad 1 is the left paddle, pad 2 the right one).
- Output keeps running while you switch games and while the window is minimised. There is one sACN output and one NDI stream; it always shows the game that is selected.

```bash
npm install
npm start          # build the UI and start Electron
npm test           # unit tests (game logic, sACN packets, NDI frame)
npm run dist:mac   # .dmg (arm64 + x64)
npm run dist:win   # .exe installer (NSIS, x64)
```

**Updates and releases** work like in the Netzwerkplaner. The app checks GitHub for a newer release at start (click the version badge for the changelog and "Nach Updates suchen"). Windows installs it by itself (electron-updater); on macOS the app downloads the matching DMG and opens it. Releases are built only on demand: push a tag `v<version>` or start *Actions → Release → Run workflow*. Windows x64 plus macOS Apple Silicon and Intel; the release text comes from `src/shared/version.js`.

```
src/main/          Electron main process; spiele/ausgabe.js = sACN and NDI sender
src/preload/       IPC bridge (contextBridge)
src/renderer/      React UI (App.jsx), sound (spiele/ton.js)
src/shared/spiele/ game logic without UI: snake.js, pong.js, mario/, tetris.js, pacman.js
test/              unit tests (node:test)
```

Snake and Pong are 1:1 ports of the Python games below: with the same inputs, every frame has the same pixels. Mario Jump started as a port and has since been extended: a flagpole and castle at the end of the course, worlds that get faster with more enemies, piranha plants, paratroopas, kickable shells, fireballs, coin, star and 1-up blocks, and a redesigned Mario.

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
