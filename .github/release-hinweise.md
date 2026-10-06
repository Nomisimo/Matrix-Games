

---

### Download

| System | Datei |
|---|---|
| Windows 10/11 (x64) | `Matrix-Games-…-win-x64.exe` |
| macOS Apple Silicon (M1–M4) | `Matrix-Games-…-mac-arm64.dmg` |
| macOS Intel | `Matrix-Games-…-mac-x64.dmg` |

**Hinweis:** Die Installer sind nicht mit einem Entwicklerzertifikat signiert.

- **Windows:** SmartScreen meldet „Unbekannter Herausgeber“ → „Weitere Informationen“ → „Trotzdem ausführen“.
- **macOS:** Beim ersten Start die App im Finder mit Rechtsklick → „Öffnen“ starten. Meldet macOS „beschädigt“, einmal im Terminal ausführen: `xattr -cr "/Applications/Matrix Games.app"`

Für NDI braucht der Rechner die [NDI Runtime](https://ndi.video/tools/).

Die App prüft beim Start, ob hier eine neuere Version liegt, und zeigt dann oben einen Hinweis. Unter Windows installiert sie das Update selbst, auf dem Mac lädt sie das DMG und öffnet es.
