"""
Procedural 8-bit audio for the LED-matrix Mario game.

Synthesises NES-style sounds entirely from numpy arrays — no WAV files needed.
All public functions are silent no-ops when numpy is absent or the audio
device is unavailable (e.g. headless CI / no speakers).

Usage
─────
    import sounds
    sounds.pre_init()       # before pygame.init()
    pygame.init()
    sounds.init()           # after pygame.init()
    sounds.play('jump')     # anywhere
"""
import pygame

try:
    import numpy as np
    _HAS_NUMPY = True
except ImportError:
    _HAS_NUMPY = False

_RATE   = 22050          # preferred sample rate (actual may differ)
_sounds: dict = {}       # name → pygame.Sound


# ── Public API ────────────────────────────────────────────────────────────────

def pre_init():
    """Configure the mixer.  MUST be called before pygame.init()."""
    if _HAS_NUMPY:
        try:
            pygame.mixer.pre_init(_RATE, -16, 1, 512)
        except Exception:
            pass


def init():
    """Build all sounds.  Call AFTER pygame.init()."""
    if not _HAS_NUMPY:
        return
    try:
        pygame.mixer.set_reserved(1)       # reserve channel 0 for music
        info = pygame.mixer.get_init()
        if info:
            _build_all(info[0], info[2])   # actual rate & channels
    except Exception:
        pass          # audio device missing → silent mode


def play(name: str, stop_all: bool = False):
    """Play a named sound.  No-op if unavailable."""
    if stop_all:
        try:
            pygame.mixer.stop()   # also stops music channel
        except Exception:
            pass
    s = _sounds.get(name)
    if s:
        try:
            s.play()
        except Exception:
            pass


def play_music():
    """Loop the SMB overworld theme on the reserved channel 0."""
    s = _sounds.get('_music')
    if s is None:
        return
    try:
        pygame.mixer.Channel(0).play(s, loops=-1)
    except Exception:
        pass


def stop_music():
    """Stop the music (channel 0)."""
    try:
        pygame.mixer.Channel(0).stop()
    except Exception:
        pass


# ── Low-level wave builders (all rate-parameterised) ─────────────────────────

def _sq(n: int, freq: float, rate: int, duty: float = 0.5) -> 'np.ndarray':
    """Square wave at constant frequency."""
    t = np.arange(n, dtype=np.float32) / rate
    return np.where((t * freq) % 1.0 < duty, 1.0, -1.0).astype(np.float32)


def _glide(n: int, f0: float, f1: float, rate: int) -> 'np.ndarray':
    """Square wave with linearly sweeping frequency f0 → f1."""
    freqs = np.linspace(f0, f1, n, dtype=np.float32)
    phase = np.cumsum(freqs) / rate
    return np.sign(np.sin(2.0 * np.pi * phase)).astype(np.float32)


def _env(n: int, a: float = 0.01, d: float = 0.05,
         s: float = 0.70, r: float = 0.20) -> 'np.ndarray':
    """ADSR amplitude envelope, output in [0, 1]."""
    na = max(int(n * a), 1)
    nd = max(int(n * d), 1)
    nr = max(int(n * r), 1)
    ns = max(n - na - nd - nr, 0)
    return np.concatenate([
        np.linspace(0.0, 1.0, na),
        np.linspace(1.0,  s,  nd),
        np.full(ns, s),
        np.linspace(s,   0.0, nr),
    ])[:n].astype(np.float32)


def _bake(wave: 'np.ndarray', ch: int, vol: float = 0.28) -> 'pygame.Sound | None':
    """Scale to int16, duplicate to stereo if needed, return pygame.Sound."""
    samples = np.clip(wave * vol * 32767.0, -32767.0, 32767.0).astype(np.int16)
    if ch == 2:
        samples = np.column_stack([samples, samples])
    try:
        return pygame.sndarray.make_sound(samples)
    except Exception:
        return None


# ── Music synthesis ───────────────────────────────────────────────────────────

_MUSIC_BPM  = 185          # quarter-note BPM (≈ NES overworld tempo)
_MUSIC_DUTY = 0.25         # 25 % duty → NES pulse-channel timbre
_MUSIC_VOL  = 0.16         # quieter than SFX so effects cut through

# Frequency table (Hz)
_NOTE: dict = {
    'G3':  196.00, 'E4':  329.63, 'F4':  349.23, 'Fs4': 369.99,
    'G4':  392.00, 'Ab4': 415.30, 'A4':  440.00, 'Bb4': 466.16,
    'B4':  493.88, 'C5':  523.25, 'D5':  587.33, 'E5':  659.26,
    'F5':  698.46, 'Fs5': 739.99, 'G5':  784.00, 'A5':  880.00,
    'C6': 1046.50, 'R':     0.0,
}

# SMB overworld melody — durations in 8th-note beats
_SMB_SEQ = [
    # ── Intro ────────────────────────────────────────────────────────────────
    ('E5',1),('R',.5),('E5',1),('R',.5),('R',1),('C5',1),('E5',2),
    ('R',1),('G5',2),('R',2),('G4',2),('R',4),

    # ── Part A ×2 ────────────────────────────────────────────────────────────
    ('C5',2),('R',1),('G4',2),('R',3),('E4',2),('R',3),
    ('A4',2),('R',1),('B4',2),('R',1),('Bb4',1),('A4',2),
    ('G4',1.5),('E5',1.5),('G5',2),('A5',2),('R',1),('F5',1),('G5',2),
    ('R',1),('E5',2),('R',1),('C5',2),('D5',1),('B4',3),

    ('C5',2),('R',1),('G4',2),('R',3),('E4',2),('R',3),
    ('A4',2),('R',1),('B4',2),('R',1),('Bb4',1),('A4',2),
    ('G4',1.5),('E5',1.5),('G5',2),('A5',2),('R',1),('F5',1),('G5',2),
    ('R',1),('E5',2),('R',1),('C5',2),('D5',1),('B4',3),

    # ── Part B ───────────────────────────────────────────────────────────────
    ('E4',1),('R',.5),('C5',1),('R',.5),('G3',1.5),('R',.5),
    ('Ab4',1.5),('R',.5),('A4',1),('R',.5),('F4',1),('R',.5),('Fs4',1.5),('R',.5),
    ('G4',1),('E5',1),('R',.5),('E5',1),('E5',1),('C5',1),('D5',1.5),('R',.5),

    # ── Part C ───────────────────────────────────────────────────────────────
    ('G5',1),('Fs5',1),('F5',1),('D5',1.5),('E5',1),
    ('R',.5),('G4',1),('A4',1),('C5',1),('R',.5),('A4',1),('C5',1),('D5',2),
    ('G5',1),('Fs5',1),('F5',1),('D5',1.5),('E5',1),
    ('R',.5),('C6',1),('R',.5),('C6',1),('C6',1.5),('R',1),

    # ── Part A ×2 (reprise) ──────────────────────────────────────────────────
    ('C5',2),('R',1),('G4',2),('R',3),('E4',2),('R',3),
    ('A4',2),('R',1),('B4',2),('R',1),('Bb4',1),('A4',2),
    ('G4',1.5),('E5',1.5),('G5',2),('A5',2),('R',1),('F5',1),('G5',2),
    ('R',1),('E5',2),('R',1),('C5',2),('D5',1),('B4',3),

    ('C5',2),('R',1),('G4',2),('R',3),('E4',2),('R',3),
    ('A4',2),('R',1),('B4',2),('R',1),('Bb4',1),('A4',2),
    ('G4',1.5),('E5',1.5),('G5',2),('A5',2),('R',1),('F5',1),('G5',2),
    ('R',1),('E5',2),('R',1),('C5',2),('D5',1),('B4',4),
]


def _smb_theme(r: int, ch: int) -> 'pygame.Sound | None':
    """Synthesise the full SMB overworld loop as a pygame.Sound."""
    eighth   = 60.0 / (_MUSIC_BPM * 2)   # duration of one 8th-note in seconds
    na_secs  = 0.006                      # 6 ms attack ramp
    gap_secs = 0.012                      # 12 ms silence tail per note

    chunks = []
    for note, beats in _SMB_SEQ:
        n = max(int(beats * eighth * r), 1)
        freq = _NOTE.get(note, 0.0)

        if freq == 0.0:                   # rest
            chunks.append(np.zeros(n, dtype=np.float32))
            continue

        t    = np.arange(n, dtype=np.float32) / r
        wave = np.where((t * freq) % 1.0 < _MUSIC_DUTY, 1.0, -1.0).astype(np.float32)

        env = np.ones(n, dtype=np.float32)
        na  = min(max(int(na_secs  * r), 1), n // 4)
        ng  = min(max(int(gap_secs * r), 1), n // 4)
        env[:na]       = np.linspace(0.0, 1.0, na)
        env[n - ng:]   = 0.0

        chunks.append(wave * env)

    full = np.concatenate(chunks)
    return _bake(full, ch, _MUSIC_VOL)


# ── Sound catalogue ───────────────────────────────────────────────────────────

def _build_all(r: int, ch: int):

    # ── Jump: rising frequency glide (NES pulse-channel sweep) ───────────────
    n = int(r * 0.13)
    _sounds['jump'] = _bake(
        _glide(n, 270, 540, r) * _env(n, 0.01, 0.08, 0.85, 0.08), ch, 0.27)

    # ── Stomp: downward thump on enemy ────────────────────────────────────────
    n = int(r * 0.09)
    _sounds['stomp'] = _bake(
        _glide(n, 380, 80, r) * _env(n, 0.01, 0.05, 0.55, 0.42), ch, 0.38)

    # ── Coin / ? block hit: two-tone blip E5 → B5 ────────────────────────────
    n1, n2 = int(r * 0.045), int(r * 0.105)
    _sounds['coin'] = _bake(np.concatenate([
        _sq(n1, 659, r) * _env(n1, 0.01, 0.02, 0.75, 0.15),
        _sq(n2, 988, r) * _env(n2, 0.01, 0.04, 0.65, 0.28),
    ]), ch, 0.26)

    # ── Brick bump (small Mario hits brick) ───────────────────────────────────
    n = int(r * 0.065)
    _sounds['block'] = _bake(
        _glide(n, 380, 160, r) * _env(n, 0.01, 0.04, 0.45, 0.52), ch, 0.32)

    # ── Brick break (big Mario smashes brick) ─────────────────────────────────
    n = int(r * 0.08)
    rng   = np.random.RandomState(7)
    noise = rng.uniform(-1.0, 1.0, n).astype(np.float32)
    for i in range(1, n):                          # gentle low-pass
        noise[i] = noise[i] * 0.35 + noise[i - 1] * 0.65
    _sounds['brick'] = _bake(noise * _env(n, 0.01, 0.04, 0.25, 0.68), ch, 0.32)

    # ── Powerup collect: ascending C4-E4-G4-C5 arpeggio ──────────────────────
    nd = int(r * 0.068)
    _sounds['powerup'] = _bake(np.concatenate([
        _sq(nd, f, r) * _env(nd, 0.02, 0.04, 0.72, 0.18)
        for f in (262, 330, 392, 523)
    ]), ch, 0.26)

    # ── 1UP: longer ascending scale C4 → C6 ──────────────────────────────────
    nd = int(r * 0.052)
    _sounds['1up'] = _bake(np.concatenate([
        _sq(nd, f, r) * _env(nd, 0.02, 0.03, 0.72, 0.18)
        for f in (262, 330, 392, 523, 659, 784, 1047)
    ]), ch, 0.24)

    # ── Death melody: two notes + long descending glide ───────────────────────
    nd  = int(r * 0.12)
    nd3 = int(r * 0.32)
    _sounds['death'] = _bake(np.concatenate([
        _sq(nd,  494, r) * _env(nd,  0.01, 0.05, 0.72, 0.25),
        _sq(nd,  392, r) * _env(nd,  0.01, 0.05, 0.62, 0.35),
        np.zeros(int(r * 0.04), dtype=np.float32),
        _glide(nd3, 380, 55, r) * _env(nd3, 0.02, 0.08, 0.50, 0.45),
    ]), ch, 0.29)

    # ── Shell kick: short descending blip ─────────────────────────────────────
    n = int(r * 0.065)
    _sounds['kick'] = _bake(
        _glide(n, 880, 440, r) * _env(n, 0.01, 0.03, 0.50, 0.52), ch, 0.24)

    # ── Star collect: ascending arpeggio ──────────────────────────────────────
    nd = int(r * 0.042)
    _sounds['star'] = _bake(np.concatenate([
        _sq(nd, f, r) * _env(nd, 0.01, 0.02, 0.80, 0.12)
        for f in (523, 659, 784, 1047)
    ]), ch, 0.22)

    # ── Background music (SMB overworld loop) ─────────────────────────────────
    _sounds['_music'] = _smb_theme(r, ch)
