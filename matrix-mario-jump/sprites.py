"""
All pixel-art bitmaps for the SMB1 LED-matrix game.
Sprites are lists of rows; each row is a list of (R,G,B) or None (transparent).
All Mario / enemy sprites are 4 px wide.  Tiles are 4 × 4.
"""
import pygame
from typing import Optional, List, Tuple

Color  = Optional[Tuple[int,int,int]]
Sprite = List[List[Color]]

# ── Colour palette ────────────────────────────────────────────────────────────
_P = {
    'R': (220,  50,   0),   # Mario red
    'S': (255, 196, 108),   # Skin
    'B': ( 20,  80, 200),   # Blue overalls
    'W': (120,  65,  15),   # Brown (boots/hair)
    'G': (  0, 180,   0),   # Pipe green
    'D': (  0, 110,   0),   # Dark green
    'K': ( 90,  45,   5),   # Dark brown (Goomba)
    'k': ( 60,  28,   3),   # Very dark brown (depth)
    'E': (255, 255, 255),   # White (eyes/spots)
    'Y': (255, 215,   0),   # Bright yellow
    'y': (180, 145,   0),   # Dark yellow
    'O': (185,  85,  30),   # Brick orange
    'o': ( 75,  30,   8),   # Brick mortar
    'L': (185, 105,  30),   # Ground top (lighter)
    'N': (125,  65,  20),   # Ground body
    'n': ( 65,  30,   5),   # Ground dark
    'H': (185, 178, 158),   # Hard block light
    'h': (132, 126, 107),   # Hard block dark
    'T': (210,  40,  40),   # Mushroom cap red
    't': (140,  20,  20),   # Mushroom cap dark
    'F': (255,  80,   0),   # Fire flower orange
    'f': ( 80, 160,  30),   # Fire flower stem
    'C': ( 60, 155,  60),   # Koopa green (shell)
    'c': ( 30,  90,  30),   # Koopa dark green
    'g': (  0, 120,   0),   # 1UP dark green spot
    '.': None,
}

def _s(rows: list) -> Sprite:
    return [[_P[ch] for ch in row] for row in rows]


# ── Mario small  (4 × 6) ─────────────────────────────────────────────────────
MS_IDLE = _s([".RR.", "RSSR", ".RR.", ".BB.", ".BB.", "W..W"])
MS_RUN1 = _s([".RR.", "RSSR", ".RR.", ".BB.", "B..B", "W..W"])
MS_RUN2 = _s([".RR.", "RSSR", ".RR.", ".BB.", ".BBB", ".WW."])
MS_JUMP = _s([".RR.", "RSSR", ".RR.", "BBB.", "B..B", "W.W."])
MS_DEAD = _s([".RR.", "RSSR", ".RR.", ".BB.", ".BB.", "W..W"])   # same pose, death anim is physics

MARIO_SMALL = {
    'idle': MS_IDLE, 'run1': MS_RUN1, 'run2': MS_RUN2,
    'jump': MS_JUMP, 'dead': MS_DEAD,
}

# ── Mario big  (4 × 10) ──────────────────────────────────────────────────────
MB_IDLE = _s([".RR.", "RSSR", ".SS.", "RRRR", "BBRB", "BBRB",
              ".BB.", ".BB.", ".BB.", "W..W"])
MB_RUN1 = _s([".RR.", "RSSR", ".SS.", "RRRR", "BBRB", "BBRB",
              ".BB.", ".BB.", "B..B", "W..W"])
MB_RUN2 = _s([".RR.", "RSSR", ".SS.", "RRRR", "BBRB", "BBRB",
              ".BB.", ".BB.", ".BBB", ".WW."])
MB_JUMP = _s([".RR.", "RSSR", ".SS.", "RRRR", "BBRB", "BBRB",
              "BBB.", ".BB.", "B..B", "W.W."])
MB_DUCK = _s([".RR.", "RSSR", ".SS.", "BBRB", ".BB.", "W..W"])   # 4×6 ducking

MARIO_BIG = {
    'idle': MB_IDLE, 'run1': MB_RUN1, 'run2': MB_RUN2,
    'jump': MB_JUMP, 'duck': MB_DUCK,
}

# ── Mario fire  (4 × 10) — white overalls ────────────────────────────────────
# Reuse big frames (fire palette swap done at render time with a simple tint)
MARIO_FIRE = MARIO_BIG   # same shapes; engine draws with white shift

# ── Goomba  (4 × 4) ──────────────────────────────────────────────────────────
GOOMBA_1    = _s([".KK.", "KEKK", "KkKK", "K..K"])
GOOMBA_2    = _s([".KK.", "KEKK", "KkKK", ".KKK"])
GOOMBA_DEAD = _s(["KEKK", ".KK."])   # squished (4 × 2)
GOOMBA = {'walk1': GOOMBA_1, 'walk2': GOOMBA_2, 'dead': GOOMBA_DEAD}

# ── Koopa Troopa  (4 × 6) ────────────────────────────────────────────────────
KOOPA_1    = _s([".CC.", "CCCC", "CGCG", ".SS.", "B..B", "W..W"])
KOOPA_2    = _s([".CC.", "CCCC", "CGCG", ".SS.", ".BBB", ".WW."])
KOOPA_SHELL= _s(["cCCC", "CCCC", "CcCC", ".CC."])   # 4 × 4 shell
KOOPA = {'walk1': KOOPA_1, 'walk2': KOOPA_2, 'shell': KOOPA_SHELL}

# ── Mushroom  (4 × 5) ────────────────────────────────────────────────────────
MUSHROOM = _s([".TT.", "TTtT", "TETE", ".SS.", ".SS."])

# ── Fire Flower  (4 × 5) ─────────────────────────────────────────────────────
FIRE_FLOWER = _s([".FF.", "F.F.", ".fF.", ".f..", ".f.."])

# ── Coin  (4 × 4) ────────────────────────────────────────────────────────────
COIN = _s([".YY.", "YyyY", "YyyY", ".YY."])

# ── Star  (4 × 4) ────────────────────────────────────────────────────────────
STAR = _s([".Y.Y", "yYyy", "yYYy", "y.y."])

# ── 1UP  (mushroom cap, green variant, 4 × 5) ────────────────────────────────
ONEUP = _s([".GG.", "GGgG", "GEGE", ".SS.", ".SS."])

# ── Debris particle  (2 × 2) ─────────────────────────────────────────────────
DEBRIS = _s(["OO", "Oo"])

# ── Tiles (4 × 4) ─────────────────────────────────────────────────────────────
T_GROUND = _s(["LLNL", "NNNN", "NNNn", "nNNn"])
T_BRICK  = _s(["OoOO", "OOOO", "oOOO", "OOOO"])
T_QUEST  = _s(["yYYy", "yYyy", "yYYy", "yyyy"])   # question block
T_QUEST2 = _s(["YYYY", "Yyyy", "YYYY", "YyyY"])   # animation frame B
T_USED   = _s(["HhHH", "HHHH", "hHHH", "HHHH"])   # used / hard block
T_HARD   = _s(["HhHH", "HHHH", "HHHH", "hHHH"])   # indestructible (stairs)
T_PIPE_CL= _s(["DDGG", "DGGG", "DGGG", "DGGG"])   # pipe cap left
T_PIPE_CR= _s(["GGDD", "GGGD", "GGGD", "GGGD"])   # pipe cap right
T_PIPE_BL= _s(["DGGG", "DGGG", "DGGG", "DGGG"])   # pipe body left
T_PIPE_BR= _s(["GGGD", "GGGD", "GGGD", "GGGD"])   # pipe body right
T_FLAG   = _s(["WRR.", "WRRR", "W...", "W..."])    # flagpole top (W=pole, R=flag)
T_POLE   = _s(["W...", "W...", "W...", "W..."])    # flagpole shaft

TILE_MAP = {
    'G': T_GROUND, 'H': T_HARD, 'B': T_BRICK,
    '?': T_QUEST,
    '[': T_PIPE_CL, ']': T_PIPE_CR,
    '(': T_PIPE_BL, ')': T_PIPE_BR,
    '|': T_POLE,
    'F': T_USED,    # flagpole base uses hard block look
}


# ── Drawing helpers ───────────────────────────────────────────────────────────
def draw_sprite(surface: pygame.Surface, sprite: Sprite, x: int, y: int) -> None:
    sw, sh = surface.get_size()
    for ri, row in enumerate(sprite):
        for ci, color in enumerate(row):
            if color is not None:
                px, py = x + ci, y + ri
                if 0 <= px < sw and 0 <= py < sh:
                    surface.set_at((px, py), color)


def flip_h(sprite: Sprite) -> Sprite:
    return [list(reversed(row)) for row in sprite]
