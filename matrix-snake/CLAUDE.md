# Matrix Snake — Reproduktionsplan

## Überblick

Snake-Spiel auf einem 48×24 Pixel-Canvas (20× skaliert auf 960×480), das per sACN E1.31 auf zwei 24×24 LED-Matrizen ausgibt. Kein Sprite-Atlas, keine externen Assets, keine pip-Abhängigkeiten außer pygame.

```
python3 main.py
```

---

## Dateistruktur

```
Matrix Snake/
├── main.py         Window-Loop + State Machine + Menüs
├── game.py         Snake-Logik, Update, Render
├── font.py         3×5 Bitmap-Font (utility, unverändert kopierbar)
├── sounds.py       Prozeduraler Audio (utility, unverändert kopierbar)
├── sacn_output.py  sACN E1.31 Sender (LAN-Output)
└── config.json     Laufzeit-Konfiguration (wird auto-erstellt)
```

---

## Display-Framework

| Eigenschaft     | Wert                        |
|-----------------|-----------------------------|
| Logischer Canvas | 48 × 24 px                 |
| Fenster         | 960 × 480 px                |
| Skalierung      | 20× (`SCALE = 20`)          |
| FPS             | 60                          |
| Hintergrund     | schwarz `(0, 0, 0)`         |

```python
canvas = pygame.Surface((48, 24))
screen = pygame.display.set_mode((960, 480))
scaled = pygame.transform.scale(canvas, (960, 480))
screen.blit(scaled, (0, 0))
```

Koordinatensystem: `(0,0)` oben-links. Wände bei `y=0`, `y=23`, `x=0`, `x=47`. Spielfeld: `x=1–46`, `y=1–22`.

---

## Snake-Spiellogik (`game.py`)

### Architektur
- **Tick-basiert** (nicht frame-basiert): Accumulator-Loop, startet bei 200 ms/Tick
- **Grid-Collision**: Keine Physik, nur Zell-Belegung
- **Body**: `collections.deque` — O(1) appendleft / pop
- **Input**: Gepufferter `pending`-Richtungswechsel, kein direktes Umkehren

### Spielfeld-Bounds
```python
X1, X2 = 1, 46   # inklusive
Y1, Y2 = 1, 22   # inklusive
```

### Tick-Sequenz (Reihenfolge kritisch)
1. `dir = pending`
2. `next_head = head + dir`
3. Wandkollision prüfen → Tod
4. Selbstkollision prüfen → **Schwanzausnahme**: wenn `growth == 0`, Schwanzfeld aus Check ausschließen
5. `body.appendleft(next_head)`
6. Futter-Check → `growth += 3`, Score erhöhen, Level prüfen
7. Wenn `growth > 0`: `growth -= 1` (kein pop) — sonst: `body.pop()`

### Speed-Levels
```python
TICK_RATES = [0.200, 0.170, 0.140, 0.110, 0.085, 0.065, 0.050]  # Sekunden
```
Level-Up alle 5 gegessenen Früchte.

### Futter-Spawn
Zufällige freie Zelle. Schließt UI-Text-Bereiche aus (Score oben-links, Level oben-rechts, je 5px hoch).

```python
def _ui_cells(self):
    # Score: x=2, y=1..5, Breite dynamisch nach aktuellem Score-Text
    # Level: top-rechts, analog
```

---

## Font (`font.py`)

3×5 px Glyphen, 1 px Abstand zwischen Zeichen. `N` ist 4 px breit (Sonderfall).

```python
draw_text(surface, 'HELLO', x, y, color)   # zeichnet ab (x,y)
text_width('HELLO')                         # → px-Breite für Zentrierung
```

Zentrierung: `x = (48 - text_width(text)) // 2`

---

## State Machine (`main.py`)

```
title → playing ↔ paused → game_over → title
```

| State      | Tastenbelegung                              |
|------------|---------------------------------------------|
| title      | SPACE → playing                             |
| playing    | Pfeile/WASD = Richtung, ESC = pause         |
| paused     | ESC/SPACE/P = weiter, Q = title             |
| game_over  | SPACE = neu, ESC = title                    |

---

## sACN E1.31 Output (`sacn_output.py`)

### Konzept
Nach jedem gerenderten Frame wird der 48×24 Canvas per UDP-Multicast als DMX-Daten gesendet — **vor** der Skalierung auf den Bildschirm.

### Canvas → Matrix-Mapping

```
Canvas x=0..23,  y=0..23  →  Matrix 1  (linke Hälfte)
Canvas x=24..47, y=0..23  →  Matrix 2  (rechte Hälfte)
```

### Physikalisches Tile-Layout (pro Matrix)

Jede Matrix: 24×24 px = 36 Kacheln à 4×4 Pixel.  
Kacheln: **6 Spalten × 6 Reihen**, column-major adressiert.

```
Kachel-Nummerierung (tile_idx = tile_col × 6 + tile_row):

  Sp.0  Sp.1  Sp.2  Sp.3  Sp.4  Sp.5
   T0    T6   T12   T18   T24   T30   ← Pixel-Reihen 0–3
   T1    T7   T13   T19   T25   T31   ← Pixel-Reihen 4–7
   T2    T8   T14   T20   T26   T32   ← Pixel-Reihen 8–11
   T3    T9   T15   T21   T27   T33   ← Pixel-Reihen 12–15
   T4   T10   T16   T22   T28   T34   ← Pixel-Reihen 16–19
   T5   T11   T17   T23   T29   T35   ← Pixel-Reihen 20–23
```

Universe-Grenze nach je 9 Kacheln (9 × 16 Pixel × 3 Ch = 432 Ch < 512):

| Universe-Offset | Kacheln | Pixel-Fixtures |
|-----------------|---------|----------------|
| +0 | T0–T8   | 0–143   |
| +1 | T9–T17  | 144–287 |
| +2 | T18–T26 | 288–431 |
| +3 | T27–T35 | 432–575 |

### Pixel → DMX-Formel

```python
tile_col = mx // 4                          # Kachelspalte 0–5
tile_row = my // 4                          # Kachelreihe 0–5
tile_idx = tile_col * 6 + tile_row          # column-major
pix_idx  = (my % 4) * 4 + (mx % 4)         # row-major innerhalb Kachel
fixture  = tile_idx * 16 + pix_idx          # Fixture-Index 0–575
channel  = fixture * 3                      # DMX-Byte-Offset (R=0, G=1, B=2)
```

### E1.31 Paket-Struktur (stdlib only, kein pip)

Paketgröße = 126 + N Bytes (N = Anzahl DMX-Kanäle).

```
Offset  Len  Wert              Bedeutung
     0    2  00 10             Preamble Size
     2    2  00 00             Postamble Size
     4   12  "ASC-E1.17\0\0\0" ACN Identifier
    16    2  0x7000|(110+N)    Root flags+len
    18    4  0x00000004        VECTOR_ROOT_E131_DATA
    22   16  UUID bytes        CID (einmalig generiert)
    38    2  0x7000|(88+N)     Framing flags+len
    40    4  0x00000002        VECTOR_E131_DATA_PACKET
    44   64  "MatrixSnake\0…"  Source Name (null-padded)
   108    1  0x64              Priority 100
   109    2  00 00             Sync Address
   111    1  seq 0–255         Sequence Number (pro Universe)
   112    1  00                Options
   113    2  universe (BE)     Universe-Nummer
   115    2  0x7000|(11+N)     DMP flags+len
   117    1  02                DMP Vector
   118    1  a1                Address Type
   119    2  00 00             First Property Address
   121    2  00 01             Address Increment
   123    2  N+1               Property Count
   125    1  00                Start Code
   126    N  channel data      DMX-Werte R,G,B,...
```

Multicast-Adresse: `239.255.{(universe >> 8) & 0xFF}.{universe & 0xFF}`, Port 5568.

### main.py Integration

```python
# Vor pygame.init():
cfg = sacn_output.load_config()
if cfg.get('sacn_enabled', True):
    sacn_output.init(cfg)

# In der Render-Schleife, nach letztem Render-Aufruf, vor transform.scale:
sacn_output.send_frame(canvas, cfg)

# Beim QUIT-Event:
sacn_output.shutdown()
```

### Fehlerverhalten
Netzwerkfehler deaktivieren sACN einmalig (stderr-Log), Spiel läuft weiter. Kein Crash.

---

## config.json

Wird beim ersten Start auto-erstellt wenn nicht vorhanden.

```json
{
  "sacn_enabled": true,
  "matrix1_universe_start": 1,
  "matrix2_universe_start": 5,
  "fixtures_per_universe": 144,
  "bind_ip": "0.0.0.0"
}
```

| Key | Bedeutung |
|-----|-----------|
| `sacn_enabled` | sACN an/aus |
| `matrix1_universe_start` | Erstes Universe für linke Matrix |
| `matrix2_universe_start` | Erstes Universe für rechte Matrix |
| `fixtures_per_universe` | Fixtures pro Universe (144 = 9 Kacheln × 16 Pixel) |
| `bind_ip` | Netzwerk-Interface für Multicast. `"0.0.0.0"` = OS-Default. Bei mehreren NICs (z.B. dediziertes Lighting-Netz): IP des richtigen Interface angeben. |

**Multicast-Interface-Problem (macOS):** Wenn der Rechner mehrere Netzwerkkarten hat, sendet macOS Multicast über die Default-Route, nicht über das Lighting-Netz. Fix: `bind_ip` auf die IP der Lighting-NIC setzen (z.B. `"2.2.2.4"`).

---

---

## NDI Output (`ndi_output.py`)

Optionaler NDI-Stream des Spiels (48×24 px, 60 fps, BGRA). Benötigt das `ndi-python`-Paket und die NDI Runtime.

### Setup
```bash
pip install ndi-python
# NDI Runtime installieren: https://ndi.video/tools/
```

### API
```python
ndi_output.init(cfg)          # NDI Sender erstellen
ndi_output.send_frame(canvas, cfg)  # Frame senden (BGRA-Konvertierung intern)
ndi_output.shutdown()          # Sender schließen
```

### main.py Integration
```python
mode = cfg.get('output_mode', 'sacn')
if mode in ('ndi', 'both'):
    ndi_output.init(cfg)
# in Render-Loop:
if mode in ('ndi', 'both'):
    ndi_output.send_frame(canvas, cfg)
```

Fehler (ImportError, SDK nicht installiert) deaktivieren NDI einmalig per stderr-Log. Spiel läuft weiter.

---

## config.json

Wird beim ersten Start auto-erstellt wenn nicht vorhanden.

```json
{
  "output_mode": "sacn",
  "matrix1_universe_start": 1,
  "matrix2_universe_start": 5,
  "fixtures_per_universe": 144,
  "bind_ip": "0.0.0.0",
  "ndi_stream_name": "Matrix Snake"
}
```

| Key | Werte | Bedeutung |
|-----|-------|-----------|
| `output_mode` | `"sacn"` / `"ndi"` / `"both"` | Welcher Output aktiv ist |
| `matrix1_universe_start` | int | Erstes Universe für linke Matrix |
| `matrix2_universe_start` | int | Erstes Universe für rechte Matrix |
| `fixtures_per_universe` | int | Fixtures pro Universe (144 = 9 Kacheln × 16 Pixel) |
| `bind_ip` | IP-String | Multicast-Interface. `"0.0.0.0"` = OS-Default. Bei mehreren NICs: IP der Lighting-NIC angeben. |
| `ndi_stream_name` | String | Name des NDI-Streams |

**Multicast-Interface-Problem (macOS):** Bei mehreren Netzwerkkarten sendet macOS Multicast über die Default-Route. Fix: `bind_ip` auf die IP der Lighting-NIC setzen.

---

## Abhängigkeiten

```
pygame       (pip install pygame)       # immer nötig
ndi-python   (pip install ndi-python)   # nur bei output_mode "ndi" oder "both"
```

Sonst nur Python 3 stdlib: `socket`, `struct`, `uuid`, `json`, `collections`, `array`, `math`.
