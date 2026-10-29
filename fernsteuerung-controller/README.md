# Matrix Games – Controller für Raspberry Pi oder PC

Ein kleines Programm für einen Rechner an der LED-Matrix (Raspberry Pi, alter Laptop, Mini-PC), an dem die Gamepads stecken. Es schickt die Knöpfe über das Netzwerk an die Matrix Games App in der Regie. Es braucht kein Fenster, keinen Fokus und keinen Browser.

## Einrichten

1. In der App: **Einstellungen → Fernsteuerung (LAN)** einschalten (Port 8788).
2. Auf dem Pi oder PC:

```bash
git clone https://github.com/Nomisimo/Matrix-Games.git
cd Matrix-Games/fernsteuerung-controller
pip install -r requirements.txt        # Raspberry Pi OS: sudo apt install python3-pygame
python3 controller.py                  # sucht die App im eigenen Netz (/24)
python3 controller.py --app 192.168.1.20         # oder Adresse fest angeben
python3 controller.py --app 192.168.1.20 --spieler 2
```

In der App steht der Controller dann unter „Fernsteuerung (LAN)“ mit seinem Namen (`--name`, sonst der Rechnername).

## Gamepads

- Gängige Pads (Xbox, PlayStation, Switch Pro, 8BitDo, Logitech …) werden über die SDL-Belegung erkannt: Steuerkreuz und linker Stick = Richtungen, A/B/X/Y, Start, Select/Back/Share. Unbekannte Pads: Knopf 0–3 = A B X Y, Hat und Stick = Richtungen.
- Das erste Gamepad ist der gewählte Spieler (`--spieler`, Standard 1), das zweite der andere. So geht Pong zu zweit an einem Pi.
- Gamepads lassen sich jederzeit ein- und ausstecken, auch per Bluetooth.
- Bricht das Netz weg, lässt die App nach 1,5 s alle Knöpfe los. Das Programm verbindet sich danach von selbst wieder.

## Autostart auf dem Raspberry Pi

```bash
sudo cp matrix-controller.service /etc/systemd/system/
sudo nano /etc/systemd/system/matrix-controller.service   # User und Pfad anpassen, evtl. --app …
sudo systemctl enable --now matrix-controller
journalctl -u matrix-controller -f     # Log ansehen
```

Damit die Suche die App schnell findet, sollte das MacBook eine feste IP haben, sonst `--app` angeben. Ist die macOS-Firewall an, beim ersten Einschalten der Fernsteuerung „Eingehende Verbindungen erlauben“ wählen.
