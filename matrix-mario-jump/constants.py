# ── Canvas & display ──────────────────────────────────────────────────────────
W, H   = 48, 24
SCALE  = 20          # 960 × 480 monitor window
FPS    = 60

# ── Tile grid ─────────────────────────────────────────────────────────────────
TILE     = 4         # 4 × 4 px per tile
LEVEL_H  = 6         # visible tile rows (rows 0–5)
GROUND_ROW = 5       # tile row for ground
GROUND_Y   = GROUND_ROW * TILE   # = 20  (first pixel of ground)

# ── Mario dimensions ──────────────────────────────────────────────────────────
MARIO_W       = 4
MARIO_SMALL_H = 6
MARIO_BIG_H   = 10

# ── Physics (enemies & items use GRAVITY / MAX_FALL) ─────────────────────────
GRAVITY    = 0.38   # px/frame²  default gravity for enemies & items
MAX_FALL   = 3.5    # px/frame   hard cap  (must stay < TILE to prevent tunnelling)
WALK_SPEED = 0.6    # px/frame   max walking velocity
RUN_SPEED  = 1.4    # px/frame   max running velocity

# ── NES-style Mario physics ───────────────────────────────────────────────────
# Variable jump: apex scales with running speed; holding A dampens gravity.
JUMP_VEL      = -2.5   # impulse at zero speed  (walk-jump)
JUMP_VEL_RUN  = -3.2   # impulse at full RUN_SPEED  (run-jump, higher arc)
GRAVITY_RISE  = 0.28   # gravity while rising  AND  jump button held  (floaty)
GRAVITY_FALL  = 0.50   # gravity while falling  (asymmetric — snappier drop)
GRAVITY_ABORT = 0.58   # gravity when jump released early  (cuts arc short)
# Horizontal inertia (sub-pixel feel)
ACCEL_WALK    = 0.06   # acceleration  px/frame²  (walk)
ACCEL_RUN     = 0.09   # acceleration  px/frame²  (run)
DECEL         = 0.04   # deceleration when no key held
DECEL_SKID    = 0.07   # deceleration when reversing direction  (skid)

# ── Colours ───────────────────────────────────────────────────────────────────
SKY       = (92, 148, 252)   # NES sky blue
COL_WHITE = (255, 255, 255)
COL_SCORE = (255, 220,   0)
COL_RED   = (255,  60,  60)
COL_DIM   = (120, 120, 120)

# ── Mario states ──────────────────────────────────────────────────────────────
SMALL  = 'small'
BIG    = 'big'
FIRE   = 'fire'
DEAD   = 'dead'
GROW   = 'grow'
SHRINK = 'shrink'

# ── Solid tile chars ─────────────────────────────────────────────────────────
SOLID = frozenset('GH?B[]()IN')

# ── Activatable tile chars (hit from below → trigger event) ──────────────────
ACTIVATABLE = frozenset('?BIN')
