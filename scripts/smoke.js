// Rauchtest: startet die gebaute App kurz und prüft, ob die Oberfläche etwas anzeigt
// (fängt z. B. einen schwarzen Bildschirm durch JavaScript, das Electron nicht kann).
// Vorher „npm run build“. Unter Linux ohne Bildschirm mit xvfb-run starten.
const { spawnSync } = require("child_process");
const path = require("path");
const electron = require("electron");

const args = [path.join(__dirname, "..")];
if (process.platform === "linux") args.unshift("--no-sandbox");
const r = spawnSync(electron, args, {
  stdio: "inherit",
  timeout: 60000,
  env: { ...process.env, MATRIX_GAMES_SMOKE: "1", ELECTRON_DISABLE_SANDBOX: "1" },
});
if (r.status !== 0) { console.error("Rauchtest fehlgeschlagen", r.error?.message || `(Exit ${r.status})`); process.exit(1); }
