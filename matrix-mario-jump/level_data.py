"""
World 1-1 level layout, looped infinitely.

gen_column(col) maps any column to a position in the W1-1 template.
Cols 0-27 are the safe opening section (played once).
Cols 28+ loop through the main body (cols 28-195, 168-col cycle).

Enemy spawns are per absolute-column, regenerated fresh every loop.
"""
from constants import LEVEL_H, TILE, GROUND_Y, MARIO_SMALL_H

# ── Column range for the infinite loop ────────────────────────────────────────
_LOOP_START = 28
_LOOP_LEN   = 168          # cols 28–195 repeat
_TEMPLATE_W = 196          # width of the full template


def _build_template():
    """Build a 6-row × 196-col tile grid for World 1-1."""
    grid = [[' '] * _TEMPLATE_W for _ in range(LEVEL_H)]

    def hline(row, c0, c1, ch):
        for c in range(c0, c1 + 1):
            grid[row][c] = ch

    def pipe(col, height):
        top = LEVEL_H - 1 - height          # row of the cap
        grid[top][col]     = '['
        grid[top][col + 1] = ']'
        for r in range(top + 1, LEVEL_H - 1):
            grid[r][col]     = '('
            grid[r][col + 1] = ')'

    # ── Ground (row 5) ─────────────────────────────────────────────────────
    hline(5,  0, 65, 'G')   # before gap
    hline(5, 68, 195, 'G')  # after gap  (pit at cols 66–67)

    # ── Opening ? block (col 13) ───────────────────────────────────────────
    grid[2][13] = '?'

    # ── First block row (cols 16–22) ───────────────────────────────────────
    for c, ch in zip(range(16, 23), 'B?B?BBB'):
        grid[2][c] = ch

    # ── Pipes ─────────────────────────────────────────────────────────────
    pipe(28, 2)   # small pipe
    pipe(38, 2)   # small pipe

    # ── Block cluster (cols 45–53) ─────────────────────────────────────────
    for c, ch in zip(range(45, 53), '?BB?BB?B'):
        grid[2][c] = ch
    hline(1, 54, 58, 'B')   # elevated row

    # ── Tall pipes ────────────────────────────────────────────────────────
    pipe(61, 3)
    pipe(65, 3)

    # ── Post-gap blocks (cols 77–89) ──────────────────────────────────────
    for c, ch in zip(range(77, 87), 'BB?BB?BB?B'):
        grid[2][c] = ch
    hline(1, 89, 93, 'B')

    # ── Mid section (cols 96–110) ─────────────────────────────────────────
    grid[2][97]  = '?'
    grid[2][100] = 'B'
    grid[2][101] = '?'
    grid[2][104] = 'B'
    grid[2][107] = '?'
    pipe(111, 2)

    # ── Upper platform section (cols 115–128) ─────────────────────────────
    hline(2, 115, 120, 'B')
    grid[2][117] = '?'
    grid[2][119] = '?'

    # ── More blocks + pipe (cols 130–148) ─────────────────────────────────
    grid[2][131] = '?'
    grid[2][133] = 'B'
    grid[2][135] = '?'
    pipe(141, 2)
    hline(1, 145, 149, 'B')
    grid[1][147] = '?'

    # ── Staircase ascending (cols 155–162) ────────────────────────────────
    for i in range(8):
        top = max(0, 4 - i)
        for r in range(top, 5):
            grid[r][155 + i] = 'H'

    # ── Brief gap + descending steps (cols 164–171) ───────────────────────
    for i in range(4):
        top = max(0, 4 - (3 - i))
        for r in range(top, 5):
            grid[r][164 + i] = 'H'

    # ── Second staircase (cols 172–179) ───────────────────────────────────
    for i in range(8):
        top = max(0, 4 - i)
        for r in range(top, 5):
            grid[r][172 + i] = 'H'

    # Flatten to strings for read-only access
    return [''.join(row) for row in grid]


_TEMPLATE = _build_template()


# ── Enemy spawn positions (in base-col space, col 0–195) ─────────────────────
# These are absolute column indices within the template.
_ENEMY_COLS = {
    # goombas walking toward the first block row
    9:  'goomba',
    10: 'goomba',
    # near first pipes
    32: 'goomba',
    36: 'goomba',
    # after second pipe
    42: 'goomba',
    43: 'goomba',
    # pre-gap (col 60 = safely before the tall pipe at 61-62)
    60: 'goomba',
    # post-gap
    72: 'goomba',
    73: 'goomba',
    # mid section
    80: 'goomba',
    90: 'koopa',
    105: 'goomba',
    115: 'goomba',
    116: 'goomba',
    132: 'goomba',
    145: 'koopa',
    165: 'goomba',
}


def _base_col(col: int) -> int:
    """Map infinite column index to a template column."""
    if col < _LOOP_START:
        return col
    return _LOOP_START + (col - _LOOP_START) % _LOOP_LEN


def gen_column(col: int):
    """Return (tile_list[LEVEL_H], enemy_type_or_None) for this column."""
    bc = _base_col(col)

    # Tile lookup — clamp to template width
    if bc < _TEMPLATE_W:
        tiles = [_TEMPLATE[row][bc] for row in range(LEVEL_H)]
    else:
        tiles = [' '] * (LEVEL_H - 1) + ['G']

    # Enemy — spawn at the same base-col positions each loop pass
    enemy = _ENEMY_COLS.get(bc)

    return tiles, enemy
