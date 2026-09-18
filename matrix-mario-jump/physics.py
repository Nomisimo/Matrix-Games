"""
Split-axis AABB tile collision.

Every entity must expose: x, y (float), vx, vy (float), w, h (int), on_ground (bool).
Call resolve_x then resolve_y each frame after applying velocity.
"""
from constants import TILE, LEVEL_H, SOLID, ACTIVATABLE, GRAVITY, MAX_FALL


def _get(tiles, col, row):
    lw = len(tiles[0])
    if 0 <= row < LEVEL_H and 0 <= col < lw:
        return tiles[row][col]
    return ' '


def is_solid(tile):
    return tile in SOLID


# ── Horizontal resolution ─────────────────────────────────────────────────────
def resolve_x(entity, tiles):
    if entity.vx == 0:
        return

    top_row = max(0, int(entity.y) // TILE)
    bot_row = min(LEVEL_H - 1, int(entity.y + entity.h - 1) // TILE)

    if entity.vx > 0:
        col = int(entity.x + entity.w - 1) // TILE
        for row in range(top_row, bot_row + 1):
            if is_solid(_get(tiles, col, row)):
                entity.x = float(col * TILE - entity.w)
                entity.vx = 0.0
                return
    else:
        col = int(entity.x) // TILE
        for row in range(top_row, bot_row + 1):
            if is_solid(_get(tiles, col, row)):
                entity.x = float((col + 1) * TILE)
                entity.vx = 0.0
                return

    # Clamp to level left edge
    if entity.x < 0:
        entity.x = 0.0
        entity.vx = 0.0


# ── Vertical resolution ───────────────────────────────────────────────────────
def resolve_y(entity, tiles, prev_y):
    """
    Returns (col, row) of ceiling tile activated (hit from below), or None.
    Sets entity.on_ground = True when landing.
    """
    left_col  = max(0, int(entity.x) // TILE)
    right_col = min(len(tiles[0]) - 1, int(entity.x + entity.w - 1) // TILE)

    if entity.vy >= 0:  # falling / stationary
        # Use y+h (exclusive bottom) so feet at tile-top are detected immediately
        row = min(LEVEL_H - 1, int(entity.y + entity.h) // TILE)
        for col in range(left_col, right_col + 1):
            tile = _get(tiles, col, row)
            if is_solid(tile):
                tile_top = row * TILE
                if prev_y + entity.h <= tile_top:   # bottom edge was at or above
                    entity.y  = float(tile_top - entity.h)
                    entity.vy = 0.0
                    entity.on_ground = True
                    return None
    else:  # moving up
        row = max(0, int(entity.y) // TILE)
        for col in range(left_col, right_col + 1):
            tile = _get(tiles, col, row)
            if is_solid(tile):
                tile_bot = (row + 1) * TILE
                if prev_y >= tile_bot:    # was below
                    entity.y  = float(tile_bot)
                    entity.vy = 0.0
                    if tile in ACTIVATABLE:
                        return (col, row)
                    return None

    return None


# ── Convenience: apply gravity + both passes ─────────────────────────────────
def step_entity(entity, tiles):
    """
    Move entity one frame.  Returns ceiling-hit (col, row) or None.
    Caller is responsible for updating vx before calling.
    """
    entity.on_ground = False

    entity.x += entity.vx
    resolve_x(entity, tiles)

    prev_y = entity.y
    entity.vy = min(entity.vy + GRAVITY, MAX_FALL)
    entity.y  += entity.vy
    return resolve_y(entity, tiles, prev_y)
