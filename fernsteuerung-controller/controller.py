#!/usr/bin/env python3
"""Matrix Games – Gamepad-Controller über das Netzwerk.

Läuft auf einem Raspberry Pi oder einem anderen Rechner an der LED-Matrix, an dem die
Gamepads hängen, und schickt die Knöpfe an die Matrix Games App in der Regie
(Einstellungen → „Fernsteuerung (LAN)“ einschalten). Ohne Fenster, ohne Fokus.

    python3 controller.py                          # App im Netz suchen
    python3 controller.py --app 192.168.1.20       # oder direkt angeben (Port 8788)
    python3 controller.py --app 192.168.1.20:8790 --spieler 2

Erstes Gamepad = gewählter Spieler, zweites Gamepad = der andere (Pong zu zweit).
Gamepads lassen sich jederzeit ein- und ausstecken.
"""
import argparse
import concurrent.futures
import http.client
import ipaddress
import json
import os
import random
import socket
import string
import sys
import time

# Ohne Fenster laufen und Gamepads auch ohne Fokus lesen (macOS/Windows)
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")
os.environ["SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS"] = "1"
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
import pygame  # noqa: E402
from pygame._sdl2 import controller as sdlc  # noqa: E402

STANDARD_PORT = 8788
HERZSCHLAG = 0.3     # s; die App lässt nach 1,5 s ohne Meldung alles los
TAKT = 1 / 250       # s zwischen zwei Abfragen der Gamepads

# Knöpfe in Standard-Gamepad-Nummern, wie die App sie erwartet
A, B, X, Y, SELECT, START, HOCH, RUNTER, LINKS, RECHTS = 0, 1, 2, 3, 8, 9, 12, 13, 14, 15
SDL_KNOEPFE = {
    pygame.CONTROLLER_BUTTON_A: A, pygame.CONTROLLER_BUTTON_B: B,
    pygame.CONTROLLER_BUTTON_X: X, pygame.CONTROLLER_BUTTON_Y: Y,
    pygame.CONTROLLER_BUTTON_BACK: SELECT, pygame.CONTROLLER_BUTTON_START: START,
    pygame.CONTROLLER_BUTTON_DPAD_UP: HOCH, pygame.CONTROLLER_BUTTON_DPAD_DOWN: RUNTER,
    pygame.CONTROLLER_BUTTON_DPAD_LEFT: LINKS, pygame.CONTROLLER_BUTTON_DPAD_RIGHT: RECHTS,
}
STICK = 0.5


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


class Gamepad:
    """Ein Gamepad. Bekannte Pads über die SDL-Belegung (Xbox, PlayStation, Switch, 8BitDo …),
    unbekannte über die Rohwerte: Knopf 0–3 = A B X Y, Hat/Stick = Richtungen."""

    def __init__(self, index):
        self.ctrl = None
        if sdlc.is_controller(index):
            self.ctrl = sdlc.Controller(index)
            self.js = self.ctrl.as_joystick()
        else:
            self.js = pygame.joystick.Joystick(index)
            self.js.init()
        self.id = self.js.get_instance_id()
        self.name = self.js.get_name()

    def knoepfe(self):
        k = set()
        if self.ctrl:
            for sdl, nr in SDL_KNOEPFE.items():
                if self.ctrl.get_button(sdl):
                    k.add(nr)
            ax, ay = self.ctrl.get_axis(pygame.CONTROLLER_AXIS_LEFTX) / 32767, self.ctrl.get_axis(pygame.CONTROLLER_AXIS_LEFTY) / 32767
        else:
            for n, nr in ((0, A), (1, B), (2, X), (3, Y), (6, SELECT), (7, START), (8, SELECT), (9, START)):
                if n < self.js.get_numbuttons() and self.js.get_button(n):
                    k.add(nr)
            if self.js.get_numhats():
                hx, hy = self.js.get_hat(0)
                if hy > 0: k.add(HOCH)
                if hy < 0: k.add(RUNTER)
                if hx < 0: k.add(LINKS)
                if hx > 0: k.add(RECHTS)
            ax = self.js.get_axis(0) if self.js.get_numaxes() > 0 else 0
            ay = self.js.get_axis(1) if self.js.get_numaxes() > 1 else 0
        if ay < -STICK: k.add(HOCH)
        if ay > STICK: k.add(RUNTER)
        if ax < -STICK: k.add(LINKS)
        if ax > STICK: k.add(RECHTS)
        return sorted(k)


class Verbindung:
    """Hält eine Keep-Alive-Verbindung zur App und baut sie bei Fehlern neu auf."""

    def __init__(self, host, port):
        self.host, self.port, self.conn = host, port, None

    def post(self, pfad, daten):
        body = json.dumps(daten)
        for versuch in (1, 2):
            try:
                if not self.conn:
                    self.conn = http.client.HTTPConnection(self.host, self.port, timeout=1.0)
                self.conn.request("POST", pfad, body, {"Content-Type": "application/json"})
                r = self.conn.getresponse()
                return json.loads(r.read() or b"{}")
            except (OSError, http.client.HTTPException, ValueError):
                if self.conn:
                    self.conn.close()
                self.conn = None
                if versuch == 2:
                    return None
        return None


def ist_app(host, port, timeout=0.4):
    try:
        c = http.client.HTTPConnection(host, port, timeout=timeout)
        c.request("GET", "/status")
        j = json.loads(c.getresponse().read())
        c.close()
        return j if j.get("app") == "matrix-games" else None
    except (OSError, http.client.HTTPException, ValueError):
        return None


def eigene_netze():
    """IPv4-Netze dieses Rechners (für die Suche nach der App), höchstens /24 groß."""
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))   # schickt nichts, ermittelt nur die eigene Adresse
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return [ipaddress.ip_network(f"{ip}/24", strict=False) for ip in ips if not ip.startswith("127.")]


def suche_app(port):
    netze = eigene_netze()
    if not netze:
        return None
    log("Suche die Matrix Games App in", ", ".join(map(str, netze)), f"(Port {port}) …")
    hosts = [str(h) for n in netze for h in n.hosts()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as ex:
        for host, j in zip(hosts, ex.map(lambda h: ist_app(h, port), hosts)):
            if j:
                return host
    return None


def main():
    ap = argparse.ArgumentParser(description="Gamepads an der LED-Matrix steuern die Matrix Games App über das Netzwerk.")
    ap.add_argument("--app", help="Adresse der App, z. B. 192.168.1.20 oder 192.168.1.20:8788 (ohne: im Netz suchen)")
    ap.add_argument("--spieler", type=int, choices=(1, 2), default=1, help="Spieler des ersten Gamepads (das zweite ist der andere)")
    ap.add_argument("--name", default=socket.gethostname()[:30] or "Controller", help="Name in der App")
    args = ap.parse_args()

    port = STANDARD_PORT
    host = None
    if args.app:
        host = args.app.replace("http://", "").strip("/")
        if ":" in host:
            host, p = host.rsplit(":", 1)
            port = int(p)
    while not host:
        host = suche_app(port)
        if not host:
            log("App nicht gefunden. Ist „Fernsteuerung (LAN)“ eingeschaltet? Neuer Versuch in 5 s.")
            time.sleep(5)
    log(f"App: http://{host}:{port}/")

    pygame.display.init()
    pygame.joystick.init()
    sdlc.init()
    pads = {}

    def neu_einlesen():
        for p in pads.values():
            p.js.quit()
        pads.clear()
        for i in range(pygame.joystick.get_count()):
            try:
                p = Gamepad(i)
                pads[p.id] = p
            except pygame.error as e:
                log("Gamepad", i, "geht nicht:", e)
        log("Gamepads:", ", ".join(p.name for p in pads.values()) or "keins")

    neu_einlesen()
    verbindung = Verbindung(host, port)
    cid = "pi-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    seq, gesendet, zuletzt, verbunden = 0, None, 0.0, None

    laeuft = True
    try:
        while laeuft:
            for e in pygame.event.get():
                if e.type in (pygame.JOYDEVICEADDED, pygame.JOYDEVICEREMOVED):
                    neu_einlesen()
                elif e.type == pygame.QUIT:   # SDL macht aus SIGTERM/SIGINT (systemctl stop, Strg+C) ein QUIT
                    laeuft = False
            liste = [{"spieler": ((args.spieler - 1 + i) % 2) + 1, "knoepfe": p.knoepfe()} for i, p in enumerate(pads.values())]
            jetzt = time.monotonic()
            if liste != gesendet or jetzt - zuletzt >= HERZSCHLAG:
                seq += 1
                antwort = verbindung.post("/eingabe", {"id": cid, "seq": seq, "name": args.name, "tasten": [], "pads": liste})
                gesendet, zuletzt = liste, jetzt
                ok = bool(antwort and antwort.get("ok"))
                if ok != verbunden:
                    verbunden = ok
                    log(f"Verbunden, Spiel: {antwort.get('spiel', '?')}" if ok else "Keine Verbindung zur App, versuche weiter …")
            time.sleep(TAKT)
    except KeyboardInterrupt:
        pass
    # Abmelden: die App lässt sofort alles los
    verbindung.post("/eingabe", {"id": cid, "weg": True, "tasten": [], "pads": []})
    log("Beendet.")


if __name__ == "__main__":
    sys.exit(main())
