GLYPHS = {
    '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
    '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
    '3': ['XXX', '..X', 'XXX', '..X', 'XXX'],
    '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
    '5': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    '6': ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
    '7': ['XXX', '..X', '..X', '..X', '..X'],
    '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
    '9': ['XXX', 'X.X', 'XXX', '..X', 'XXX'],

    'A': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
    'B': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
    'C': ['.XX', 'X..', 'X..', 'X..', '.XX'],
    'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
    'E': ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
    'F': ['XXX', 'X..', 'XX.', 'X..', 'X..'],
    'G': ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
    'H': ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
    'I': ['XXX', '.X.', '.X.', '.X.', 'XXX'],
    'J': ['.XX', '..X', '..X', 'X.X', '.X.'],
    'K': ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
    'L': ['X..', 'X..', 'X..', 'X..', 'XXX'],
    'M': ['X.X', 'XXX', 'X.X', 'X.X', 'X.X'],
    # 4-wide so the diagonal shows clearly
    'N': ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
    'O': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    'P': ['XXX', 'X.X', 'XXX', 'X..', 'X..'],
    'Q': ['.X.', 'X.X', 'X.X', 'X.X', '.XX'],
    'R': ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
    'S': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    'T': ['XXX', '.X.', '.X.', '.X.', '.X.'],
    'U': ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
    'V': ['X.X', 'X.X', 'X.X', 'X.X', '.X.'],
    'W': ['X.X', 'X.X', 'X.X', 'XXX', 'X.X'],
    'X': ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
    'Y': ['X.X', 'X.X', '.X.', '.X.', '.X.'],
    'Z': ['XXX', '..X', '.X.', 'X..', 'XXX'],

    ' ': ['...', '...', '...', '...', '...'],
}


def _glyph_w(rows):
    return len(rows[0])


def draw_text(surface, text, x, y, color):
    cx = x
    for ch in text.upper():
        rows = GLYPHS.get(ch, GLYPHS[' '])
        for row_i, row in enumerate(rows):
            for col_i, pixel in enumerate(row):
                if pixel == 'X':
                    surface.set_at((cx + col_i, y + row_i), color)
        cx += _glyph_w(rows) + 1   # glyph width + 1 px gap


def text_width(text):
    total = 0
    for ch in text.upper():
        rows = GLYPHS.get(ch, GLYPHS[' '])
        total += _glyph_w(rows) + 1
    return total
