import array
import math
import pygame

_paddle = None
_wall   = None
_score  = None
_ok     = False


def init():
    global _paddle, _wall, _score, _ok
    try:
        pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
        _paddle = _beep(480, 45,  vol=0.35)
        _wall   = _beep(260, 30,  vol=0.25)
        _score  = _beep(110, 450, vol=0.45)
        _ok = True
    except Exception:
        pass


def _beep(freq, ms, vol=0.4, rate=44100):
    frames = int(rate * ms / 1000)
    buf = array.array('h')
    for i in range(frames):
        t   = i / rate
        env = math.exp(-t * 18)          # quick exponential decay
        raw = 1 if math.sin(2 * math.pi * freq * t) >= 0 else -1  # square wave
        val = int(raw * env * vol * 32767)
        buf.append(val)
        buf.append(val)                  # stereo: same in both channels
    return pygame.mixer.Sound(buffer=buf)


def play_paddle():
    if _ok:
        _paddle.play()


def play_wall():
    if _ok:
        _wall.play()


def play_score():
    if _ok:
        _score.play()
