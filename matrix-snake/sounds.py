import array
import math

_eat = None
_die = None


def init():
    global _eat, _die
    try:
        import pygame
        pygame.mixer.init(44100, -16, 2, 512)
        _eat = _beep(880, 55, 0.25)
        _die = _beep_chord([130, 98], 480, 0.35)
    except Exception:
        pass


def _beep(freq, ms, vol=0.4, rate=44100):
    import pygame
    frames = int(rate * ms / 1000)
    buf = array.array('h')
    for i in range(frames):
        t = i / rate
        env = math.exp(-t * 20)
        raw = 1 if math.sin(2 * math.pi * freq * t) >= 0 else -1
        v = int(raw * env * vol * 32767)
        buf.append(v)
        buf.append(v)
    return pygame.mixer.Sound(buffer=buf)


def _beep_chord(freqs, ms, vol=0.3, rate=44100):
    import pygame
    frames = int(rate * ms / 1000)
    buf = array.array('h')
    for i in range(frames):
        t = i / rate
        env = math.exp(-t * 5)
        sample = sum(
            (1 if math.sin(2 * math.pi * f * t) >= 0 else -1)
            for f in freqs
        ) / len(freqs)
        v = int(sample * env * vol * 32767)
        buf.append(v)
        buf.append(v)
    return pygame.mixer.Sound(buffer=buf)


def play_eat():
    if _eat:
        _eat.play()


def play_die():
    if _die:
        _die.play()
