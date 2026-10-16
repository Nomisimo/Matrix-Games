import React, { useState, useEffect, useRef, useCallback } from "react";
import { S, ACCENT, OK, ERR, WARN, SUB, MUTED, TEXT2, INPUT, LINE, THEME_KEY, themeWahl } from "../shared/constants.js";
import { SPIELE, Bild, W, H } from "../shared/spiele/index.js";
import { anleitungHtml, verfuegbareSpiele } from "../shared/anleitung.js";
import { createMenue } from "../shared/spiele/menue.js";
import { api, isElectron } from "./api.js";
import { createTon } from "./spiele/ton.js";
import { Toggle, Dot, Card, Table, td, Hint, Modal } from "./ui.jsx";
import { CHANGELOG, compareVersions, neuesteVersion, istBeta, RELEASES_URL } from "../shared/version.js";
import { Volume2, VolumeX, RotateCcw, RefreshCw, TriangleAlert, Gamepad2, Sun, Moon, Monitor, Power, Keyboard, ArrowUpCircle, Download, Pause, Play, Trophy, FileDown } from "lucide-react";
import APP_ICON_SVG from "../../assets/app-icon/icon.svg";
const APP_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(APP_ICON_SVG)}`;

const LS = "matrixgames_einstellungen";
// Vorgaben wie im Snake-Original auf der echten Matrix (Universe 29 und 33, 144 Pixel je Universe)
// menue: Spielmenü auf der Matrix; leerlauf: Sekunden ohne Eingabe bis zur Demo (0 = nie);
// comStaerke: Pong-Computer in %; rekorde: Highscore je Spiel; aus: abgewählte Spiele (ids)
const STANDARD = { spiel: "snake", aus: [], ton: true, schwarz: false, koennen: 80, menue: false, leerlauf: 30, comStaerke: 60, rekorde: {}, sacn: { on: false, iface: "", u1: 29, u2: 33, fpu: 144 }, ndi: { on: false, name: "Matrix Games" } };
const laden = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "null");
    return v ? { ...STANDARD, ...v, aus: Array.isArray(v.aus) ? v.aus : [], rekorde: { ...v.rekorde }, sacn: { ...STANDARD.sacn, ...v.sacn }, ndi: { ...STANDARD.ndi, ...v.ndi } } : STANDARD;
  } catch { return STANDARD; }
};

const STEP = 1000 / 60;
const ZUSTAND = { menue: "Spielmenü", demo: "Demo (spielt selbst)", title: "Titelbild", intro: "Weltanzeige", playing: "läuft", paused: "Pause", point_scored: "Punkt", clear: "Ziel erreicht", game_over: "Game Over" };
// Tasten, die im Spiel nicht scrollen oder Knöpfe auslösen sollen
const SPIELTASTEN = new Set(["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"]);
// Nur Felder, in die man tippt, behalten die Tastatur. Schalter, Knöpfe und Auswahllisten geben sie
// beim nächsten Tastendruck an das Spiel zurück (sonst schaltete die Leertaste z. B. sACN aus).
const TIPPFELD = new Set(["text", "number", "search", "email", "url", "password"]);
const istEingabe = (el) => el && ((el.tagName === "INPUT" && TIPPFELD.has(el.type)) || el.tagName === "TEXTAREA" || el.isContentEditable);
const SCHWARZ = new Uint8Array(W * H * 3);
// Diese Tasten öffnen aus der Demo das Spielmenü (wenn es eingeschaltet ist)
const MENUE_TASTEN = new Set(["Enter", "NumpadEnter", "Space", "Pause", "Digit1", "Digit2", "Numpad1", "Numpad2"]);

/* Gamepads (Standard-Belegung): Steuerkreuz oder linker Stick = Pfeile, A = Leertaste,
   B/X = Shift (Rennen, Feuer), Start = Pause (startet aus der Demo), Select = Esc. Bei Pong
   steuert Pad 1 den linken Schläger (W/S) und Pad 2 den rechten (↑/↓). Im Startbild (Demo oder
   Spielmenü) melden A und Start an Pad 2 „2“: Pong startet dann zu zweit. Bei Tetris dreht A
   rechtsrum, B/X linksrum, Y lässt den Stein fallen. */
const LEERLAUF_STUFEN = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 0];
const leerlaufText = (s) => (s ? (s < 60 ? `${s} s` : `${s / 60} min`) : "nie");
function padTasten(spiel, imStart) {
  const out = new Set();
  let pads = [];
  try { pads = [...(navigator.getGamepads?.() || [])].filter(Boolean); } catch { return out; }
  pads.forEach((p, i) => {
    const b = (n) => !!p.buttons[n]?.pressed, ax = (n) => p.axes[n] || 0;
    const hoch = b(12) || ax(1) < -0.5, runter = b(13) || ax(1) > 0.5;
    const links = b(14) || ax(0) < -0.5, rechts = b(15) || ax(0) > 0.5;
    if (spiel === "pong") {
      if (i === 0) { if (hoch) out.add("KeyW"); if (runter) out.add("KeyS"); }
      else { if (hoch) out.add("ArrowUp"); if (runter) out.add("ArrowDown"); }
    } else {
      if (hoch) out.add("ArrowUp"); if (runter) out.add("ArrowDown");
    }
    if (links) out.add("ArrowLeft"); if (rechts) out.add("ArrowRight");
    if (imStart && i > 0 && (spiel === "pong" || imStart === "menue")) { if (b(0) || b(9)) out.add("Digit2"); }
    else if (spiel === "tetris" && !imStart) {
      // Tetris: A dreht rechtsrum, B/X linksrum, Y lässt fallen
      if (b(0)) out.add("KeyX"); if (b(1) || b(2)) out.add("KeyZ"); if (b(3)) out.add("Space");
      if (b(9)) out.add("Pause");
    } else {
      if (b(0)) out.add("Space");
      if (b(9)) out.add("Pause");
    }
    if ((b(1) || b(2)) && spiel !== "tetris") out.add("ShiftLeft");
    if (b(8)) out.add("Escape");
  });
  return out;
}
const anzahlUniverses = (fpu) => Math.ceil(576 / Math.max(1, Math.min(170, +fpu || 144)));
const THEMES = [["system", "wie das System", Monitor], ["hell", "Hell", Sun], ["dunkel", "Dunkel", Moon]];

// Zwei LED-Matrizen à 24×24 als runde Punkte, so wie das Bild per sACN/NDI hinausgeht
function zeichneMatrix(cv, px) {
  const ctx = cv.getContext("2d"), z = 7, gap = 18, r = z * 0.38;
  ctx.fillStyle = "#07090b";
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let m = 0; m < 2; m++) {
    const ox = m * (24 * z + gap);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const i = (y * W + m * 24 + x) * 3, R = px[i], G = px[i + 1], B = px[i + 2];
      ctx.fillStyle = R | G | B ? `rgb(${R},${G},${B})` : "#15191e";
      ctx.beginPath();
      ctx.arc(ox + x * z + z / 2, y * z + z / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function rgba(px) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) { out[j] = px[i]; out[j + 1] = px[i + 1]; out[j + 2] = px[i + 2]; out[j + 3] = 255; }
  return out;
}

export default function App() {
  const [cfg, setCfg] = useState(laden);
  const [version, setVersion] = useState("");
  const [interfaces, setInterfaces] = useState([]);
  const [status, setStatus] = useState(null);
  const [zustand, setZustand] = useState("demo");
  const [tippt, setTippt] = useState(false);
  const [pads, setPads] = useState(0);
  const [update, setUpdate] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [changelog, setChangelog] = useState(false);
  const fensterOffen = useRef(false);
  fensterOffen.current = changelog;
  const canvasRef = useRef(null), matrixRef = useRef(null);
  const gameRef = useRef(null), tonRef = useRef(null), held = useRef(new Set()), zustandRef = useRef("demo");
  const ausgabeAn = (cfg.sacn.on || cfg.ndi.on) && isElectron;
  const ausgabeRef = useRef(ausgabeAn), schwarzRef = useRef(cfg.schwarz), spielRef = useRef(cfg.spiel), koennenRef = useRef(cfg.koennen);
  const cfgRef = useRef(cfg), menueRef = useRef(null), startNachWechsel = useRef(null);
  cfgRef.current = cfg;
  ausgabeRef.current = ausgabeAn;
  schwarzRef.current = cfg.schwarz;
  koennenRef.current = cfg.koennen;
  spielRef.current = cfg.spiel;

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch {} }, [cfg]);
  useEffect(() => { api.appVersion().then(setVersion); }, []);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: typeof v === "object" ? { ...c[k], ...v } : v }));

  /* ── Versionen: beim Start prüfen, ob auf GitHub eine neuere Version liegt (wie im Netzwerkplaner) ── */
  const checkUpdate = useCallback(async (manuell = false) => {
    if (!version || version === "dev") return;
    if (manuell) setUpdateStatus("Suche …");
    const list = await api.fetchReleases();
    if (!list) { if (manuell) setUpdateStatus("GitHub nicht erreichbar."); return; }
    // Stabile Versionen sehen nur stabile Releases, Betas sehen alles
    const n = neuesteVersion(istBeta(version) ? list : list.filter((r) => !r.prerelease));
    if (n && compareVersions(n.tag_name, version) > 0) { setUpdate((u) => ({ ...u, tag: n.tag_name.replace(/^v/, ""), url: n.html_url || RELEASES_URL })); setUpdateStatus((s) => (/geladen|bereit/.test(s) ? s : `Neue Version ${n.tag_name} verfügbar.`)); }
    else if (manuell) setUpdateStatus(`Du nutzt die neueste Version (${version}).`);
    // Windows: electron-updater lädt die neue Version im Hintergrund
    if (manuell) api.checkForUpdates();
  }, [version]);
  useEffect(() => { checkUpdate(false); }, [checkUpdate]);
  useEffect(() => api.onUpdateStatus((m) => {
    if (m.type === "available") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag })); setUpdateStatus(`Version ${m.version} wird geladen …`); }
    else if (m.type === "downloading") setUpdateStatus(`Update wird geladen … ${m.percent} %`);
    else if (m.type === "installing-after-download") setUpdateStatus("Update wird geladen und danach automatisch installiert …");
    else if (m.type === "downloaded") { setUpdate((u) => ({ url: RELEASES_URL, ...u, tag: m.version || u?.tag, bereit: true })); setUpdateStatus(`Version ${m.version || ""} ist bereit. „Neu starten“ installiert sie.`); }
    else if (m.type === "mac-dmg-offen") { setUpdate((u) => ({ url: RELEASES_URL, ...u, macOffen: true })); setUpdateStatus(`Version ${m.version} ist geöffnet. Matrix Games beenden, im Finder-Fenster auf „Programme“ ziehen, „Ersetzen“ wählen und neu starten.`); setChangelog(true); }
    else if (m.type === "error") setUpdateStatus((s) => (/verfügbar/.test(s) ? s : "Automatisches Update nicht möglich. Download-Seite nutzen."));
  }), []);
  // Windows: electron-updater lädt und installiert selbst. macOS: DMG in der App laden und öffnen,
  // der Nutzer zieht die App nach „Programme“ (App nicht mit Apple-ID signiert)
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [macUpdate, setMacUpdate] = useState(false);
  useEffect(() => { api.checkForUpdates().then((r) => { setAutoUpdate(!!r?.auto); setMacUpdate(!!r?.mac); }).catch(() => {}); }, []);
  const updateAusfuehren = () => {
    if (macUpdate && update?.tag) { setChangelog(true); if (update.macOffen) return; api.macUpdateLaden(update.tag).then((r) => !r?.ok && setUpdateStatus("Download läuft schon oder ist nicht möglich. Download-Seite nutzen.")); return; }
    return autoUpdate || update?.bereit ? api.installUpdate() : api.installUpdate(update?.url || RELEASES_URL);
  };

  const ladeIfaces = () => api.netzwerkkarten().then((l) => setInterfaces(l || []));
  useEffect(() => { ladeIfaces(); }, []);

  // Ausgabe im Hauptprozess (sACN/NDI) an die Einstellungen anpassen
  useEffect(() => {
    if (isElectron) api.ausgabe({ sacn: cfg.sacn, ndi: cfg.ndi }).then(setStatus);
  }, [JSON.stringify(cfg.sacn), JSON.stringify(cfg.ndi)]);
  useEffect(() => api.onStatus(setStatus), []);

  // Ton
  useEffect(() => { tonRef.current = createTon(); return () => tonRef.current.close(); }, []);
  useEffect(() => { tonRef.current.setAn(cfg.ton); }, [cfg.ton]);

  // Spiel anlegen (bei Wechsel neu). Kam der Wechsel aus dem Spielmenü, startet die Runde gleich.
  const neu = useCallback(() => {
    tonRef.current?.stopAlle();
    const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
    gameRef.current = def.create({
      ton: (name) => tonRef.current?.play(def.id, name),
      koennen: () => (koennenRef.current ?? 80) / 100,
      leerlauf: () => cfgRef.current.leerlauf,
      comStaerke: () => (cfgRef.current.comStaerke ?? 60) / 100,
      rekord: {
        get: () => cfgRef.current.rekorde?.[def.id] || 0,
        set: (n) => setCfg((c) => ({ ...c, rekorde: { ...c.rekorde, [def.id]: n } })),
      },
    });
    menueRef.current = null;
    held.current.clear();
    const taste = startNachWechsel.current;
    startNachWechsel.current = null;
    if (taste) gameRef.current.key(taste);
    document.activeElement?.blur?.();
  }, [cfg.spiel]);
  useEffect(() => { neu(); }, [neu]);
  // Wird das laufende Spiel abgewählt, übernimmt das erste verfügbare
  useEffect(() => {
    if (!cfg.aus.includes(cfg.spiel)) return;
    const v = verfuegbareSpiele(SPIELE, cfg.aus);
    if (v.length) set("spiel", v[0].id);
  }, [cfg.aus, cfg.spiel]);

  /* Jeder Tastendruck (Tastatur und Gamepad) läuft hier durch: ist das Spielmenü an, öffnet der
     Start aus der Demo erst das Menü auf der Matrix, das dann das Spiel wählt und startet. */
  const taste = useCallback((code) => {
    const g = gameRef.current, m = menueRef.current;
    if (m) {
      const r = m.key(code);
      if (r?.zurueck) menueRef.current = null;
      else if (r?.start) {
        menueRef.current = null;
        if (r.start === cfgRef.current.spiel) g?.key(r.taste);
        else { startNachWechsel.current = r.taste; setCfg((c) => ({ ...c, spiel: r.start })); }
      }
      return;
    }
    if (cfgRef.current.menue && g?.state === "demo" && MENUE_TASTEN.has(code)) {
      const verfuegbar = verfuegbareSpiele(SPIELE, cfgRef.current.aus).map((s) => s.id);
      menueRef.current = Object.assign(createMenue({ aktuell: cfgRef.current.spiel, verfuegbar }), { leer: 0 });
      return;
    }
    g?.key(code);
  }, []);
  const tasteRef = useRef(taste);
  tasteRef.current = taste;

  // Spielschleife: feste 60 Schritte je Sekunde per Timer, damit sACN/NDI gleichmäßig senden, auch bei
  // minimiertem Fenster (der Hauptprozess schaltet dafür die Drosselung ab). Gezeichnet wird getrennt
  // davon im Takt des Bildschirms (requestAnimationFrame), damit die Anzeige nicht ruckelt.
  useEffect(() => {
    const bild = new Bild();
    let last = performance.now(), acc = 0, raf = 0, neu = false, n = 0, padVorher = new Set(), padZahl = 0;
    const tick = () => {
      const now = performance.now();
      acc = Math.min(acc + now - last, STEP * 5);
      last = now;
      const g = gameRef.current;
      if (!g) return;
      // Gamepad: neu gedrückte Tasten wie Tastendrücke melden, gehaltene mitgeben
      const pad = padTasten(spielRef.current, menueRef.current ? "menue" : g.state === "demo");
      for (const c of pad) if (!padVorher.has(c)) tasteRef.current(c);
      padVorher = pad;
      let gehalten = held.current;
      if (pad.size) { gehalten = new Set(held.current); for (const c of pad) gehalten.add(c); }
      // Der Timer tickt alle 4 ms: knapp vor der Zeit zählt schon, sonst schwankt der Abstand zwischen 16 und 20 ms
      let schritte = 0;
      const m = menueRef.current;
      while (acc >= STEP - 2 && schritte < 5) {
        if (m) {
          // Spielmenü: nach der eingestellten Zeit ohne Eingabe wieder die Demo
          m.step();
          if (gehalten.size) m.leer = 0;
          const grenze = (cfgRef.current.leerlauf || 0) * 60;
          if (grenze > 0 && ++m.leer > grenze) menueRef.current = null;
        } else gameRef.current.step(gehalten);
        acc -= STEP; schritte++;
      }
      if (!schritte) return;
      const jetzt = menueRef.current || gameRef.current;
      jetzt.render(bild);
      if (ausgabeRef.current) api.frame(schwarzRef.current ? SCHWARZ : bild.px);
      neu = true;
      const st = menueRef.current ? "menue" : gameRef.current.state;
      if (st !== zustandRef.current) { zustandRef.current = st; setZustand(st); }
    };
    const zeichne = () => {
      raf = requestAnimationFrame(zeichne);
      if (!neu) return;
      neu = false;
      const cv = canvasRef.current;
      if (cv) cv.getContext("2d").putImageData(new ImageData(rgba(bild.px), W, H), 0, 0);
      if (matrixRef.current) zeichneMatrix(matrixRef.current, schwarzRef.current ? SCHWARZ : bild.px);
      if ((++n & 63) === 0) {
        let z = 0;
        try { z = [...(navigator.getGamepads?.() || [])].filter(Boolean).length; } catch {}
        if (z !== padZahl) { padZahl = z; setPads(z); }
      }
    };
    const id = setInterval(tick, 4);
    raf = requestAnimationFrame(zeichne);
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  }, []);

  // Tastatur: geht ans Spiel, außer ein Textfeld hat den Fokus (Enter oder Esc gibt sie zurück)
  useEffect(() => {
    const down = (e) => {
      if (fensterOffen.current) return;   // Fenster „Version und Updates“ offen
      if (istEingabe(e.target)) {
        if (e.code === "Enter" || e.code === "Escape") { e.preventDefault(); e.target.blur(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el && el !== document.body) el.blur?.();
      if (SPIELTASTEN.has(e.code)) e.preventDefault();
      if (!e.repeat) { tasteRef.current(e.code); if (menueRef.current) menueRef.current.leer = 0; }
      held.current.add(e.code);
    };
    const up = (e) => { held.current.delete(e.code); if (e.code === "Space" && !istEingabe(e.target)) e.preventDefault(); };
    const blur = () => held.current.clear();
    const fokus = () => setTippt(istEingabe(document.activeElement));
    const fokusWeg = () => setTimeout(fokus, 0);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("focusin", fokus);
    document.addEventListener("focusout", fokusWeg);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur);
      document.removeEventListener("focusin", fokus); document.removeEventListener("focusout", fokusWeg);
    };
  }, []);

  const theme = themeWahl();
  const setTheme = (t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} location.reload(); };
  const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
  const verfuegbar = verfuegbareSpiele(SPIELE, cfg.aus);
  // Mindestens ein Spiel bleibt an
  const spielUmschalten = (id, an) => setCfg((c) => {
    const aus = an ? c.aus.filter((x) => x !== id) : [...new Set([...c.aus, id])];
    return verfuegbareSpiele(SPIELE, aus).length ? { ...c, aus } : c;
  });
  const [pdfStatus, setPdfStatus] = useState("");
  const anleitungLaden = async () => {
    setPdfStatus("PDF wird erstellt …");
    const r = await api.anleitungPdf(anleitungHtml({ spiele: verfuegbar, version, menue: cfg.menue, leerlauf: cfg.leerlauf })).catch((e) => ({ ok: false, fehler: e?.message }));
    setPdfStatus(r?.ok ? (r.datei ? `Gespeichert: ${r.datei}` : "") : r?.abgebrochen ? "" : `PDF nicht möglich${r?.fehler ? `: ${r.fehler}` : "."}`);
    zumSpiel();
  };
  const sacnSt = status?.sacn, ndiSt = status?.ndi;
  const uni = (start) => `${start}–${+start + anzahlUniverses(cfg.sacn.fpu) - 1}`;
  const sendet = ausgabeAn && ((cfg.sacn.on && sacnSt?.on && !sacnSt?.err) || (cfg.ndi.on && ndiSt?.on && !ndiSt?.err));
  const zumSpiel = () => document.activeElement?.blur?.();
  const imSpiel = !["demo", "menue", "title", "game_over"].includes(zustand);
  const pauseUmschalten = () => { gameRef.current?.pausieren?.(); zumSpiel(); };

  return (
    <div style={S.app}>
      <header style={S.header}>
        <img src={APP_ICON} alt="" width={26} height={26} style={{ borderRadius: 6 }} />
        <span style={S.logo}>MATRIX GAMES</span>
        {version && <button onClick={() => setChangelog(true)} title="Version und Updates" style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 10, color: SUB, fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>
          v{version.replace(/-beta\.?\d*$/i, "")}{istBeta(version) && <span style={{ marginLeft: 5, color: "#fff", background: ACCENT, borderRadius: 6, padding: "0 5px", fontSize: 9.5, fontWeight: 700 }}>BETA {(version.match(/beta\.?(\d+)/i) || [])[1] || ""}</span>}
        </button>}
        {update?.tag && <button onClick={updateAusfuehren} title={autoUpdate ? "Update automatisch installieren" : macUpdate ? "Update laden und öffnen" : "Download-Seite öffnen"} style={{ background: OK + "22", border: `1px solid ${OK}`, borderRadius: 10, color: OK, fontSize: 11, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowUpCircle size={12} /> {autoUpdate || macUpdate ? `${update.tag} installieren` : `${update.tag} verfügbar`}</button>}
        <span style={S.headerMeta}>48×24 px · zwei LED-Matrizen à 24×24</span>
        {isElectron && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: sendet ? OK : MUTED, marginRight: 4 }}>
          <Dot color={sendet ? (cfg.schwarz ? WARN : OK) : LINE} /> {sendet ? (cfg.schwarz ? "sendet schwarz" : "sendet") : "keine Ausgabe"}
        </span>}
        <button style={cfg.schwarz ? { ...S.ghostBtn, background: WARN, color: "#fff", borderColor: WARN } : S.ghostBtn} onClick={() => set("schwarz", !cfg.schwarz)}
          title={cfg.schwarz ? "Bild wieder auf die Matrix geben" : "Matrix dunkel schalten: sACN und NDI senden Schwarz, das Spiel läuft weiter"}>
          <Power size={14} /> {cfg.schwarz ? "Matrix aus" : "Matrix an"}</button>
        <button style={S.ghostBtn} onClick={() => set("ton", !cfg.ton)} title={cfg.ton ? "Ton aus" : "Ton an"}>{cfg.ton ? <Volume2 size={14} /> : <VolumeX size={14} />} Ton</button>
        <button style={{ ...S.ghostBtn, ...(zustand === "paused" ? { background: WARN, color: "#fff", borderColor: WARN } : {}), opacity: imSpiel ? 1 : 0.5, cursor: imSpiel ? "pointer" : "default" }} disabled={!imSpiel} onClick={pauseUmschalten}
          title={zustand === "paused" ? "Weiterspielen (P, Start am Gamepad)" : "Spiel anhalten (P, Start am Gamepad)"}>
          {zustand === "paused" ? <Play size={14} /> : <Pause size={14} />} {zustand === "paused" ? "Weiter" : "Pause"}</button>
        <button style={S.ghostBtn} onClick={neu} title="Runde beenden, zurück zur Demo"><RotateCcw size={14} /> Demo</button>
        <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }} title="Erscheinungsbild">
          {THEMES.map(([k, l, Ic]) => (
            <button key={k} onClick={() => k !== theme && setTheme(k)} title={l}
              style={{ background: k === theme ? ACCENT : "transparent", color: k === theme ? "#fff" : SUB, border: "none", padding: "7px 9px", cursor: "pointer", display: "inline-flex" }}><Ic size={14} /></button>
          ))}
        </div>
      </header>
      <nav style={S.nav}>
        {verfuegbar.map((s) => (
          <button key={s.id} style={{ ...S.navBtn, ...(cfg.spiel === s.id ? S.navBtnActive : {}) }} onClick={() => set("spiel", s.id)}>
            <span style={{ display: "block", height: 0, fontWeight: 600, overflow: "hidden", visibility: "hidden" }} aria-hidden="true">{s.name}</span>
            {s.name}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}><main style={S.main}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ ...S.section, padding: 14 }}>
              <div onMouseDown={zumSpiel} style={{ background: "#000", borderRadius: 6, overflow: "hidden", border: `2px solid ${ACCENT}` }}>
                <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: SUB, flexWrap: "wrap" }}>
                <Gamepad2 size={14} color={ACCENT} /> {def.name} · {W}×{H} px · 60 fps
                {pads > 0 && <span style={{ color: OK }}>· {pads === 1 ? "1 Gamepad" : `${pads} Gamepads`}</span>}
                {tippt && <span style={{ color: WARN, display: "inline-flex", alignItems: "center", gap: 4 }}><Keyboard size={13} /> Tastatur im Eingabefeld: Enter oder Klick aufs Spiel</span>}
                <span style={{ flex: 1 }} />
                <span>Zustand: <b style={{ color: TEXT2 }}>{ZUSTAND[zustand] || zustand}</b></span>
              </div>
            </div>
            <Card title="Demo (Startbild)">
              <p style={{ ...S.hint, margin: "0 0 10px" }}>
                Jedes Spiel spielt sich selbst, bis jemand mit Enter, der Leertaste oder am Gamepad startet. Nach dem Spiel,
                mit Esc oder {cfg.leerlauf ? `nach ${leerlaufText(cfg.leerlauf)} ohne Eingabe` : "(Leerlauf abgeschaltet)"} läuft wieder die Demo.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: TEXT2 }}>
                <span style={{ whiteSpace: "nowrap" }}>Können der Demo</span>
                <input type="range" min={0} max={100} step={5} value={cfg.koennen} onChange={(e) => set("koennen", +e.target.value)}
                  style={{ flex: 1, accentColor: ACCENT, minWidth: 120 }} />
                <b style={{ width: 38, textAlign: "right", color: ACCENT }}>{cfg.koennen} %</b>
              </label>
              <span className="sp-norm-hint">
                {cfg.koennen >= 80
                  ? "Snake fährt einen Rundweg über alle Felder und füllt das Feld ganz, Pong hält fast jeden Ball, Tetris räumt schnell und fast endlos ab."
                  : cfg.koennen >= 40
                    ? "Snake nimmt den kurzen Weg zum Futter und verfährt sich ab und zu, Pong lässt öfter einen Ball durch, Tetris legt ab und zu einen Stein schlecht."
                    : "Snake macht viele Fehler und beißt sich schnell selbst, Pong verliert schnell Punkte, Tetris stapelt sich schnell bis oben."}
              </span>
            </Card>
            <Card title="Tasten">
              <Table head={["Taste", "Funktion"]}>
                {def.tasten.map(([k, f]) => <tr key={k}><td style={td({ fontWeight: 600, whiteSpace: "nowrap" })}>{k}</td><td style={td()}>{f}</td></tr>)}
              </Table>
              <p style={{ ...S.hint, margin: "10px 0 0" }}>
                <b>Gamepad:</b> Steuerkreuz oder linker Stick bewegt, A = Leertaste (Start, Springen), B/X = Rennen und Feuer,
                Start = Pause (und Start aus der Demo), Select = zurück zur Demo. {def.pads || ""}
              </p>
            </Card>
            <Card title="Highscores">
              <Table head={["Spiel", "Rekord", ""]}>
                {verfuegbar.map((sp) => <tr key={sp.id}>
                  <td style={td({ fontWeight: 600, whiteSpace: "nowrap" })}>{sp.name}</td>
                  <td style={td()}><Trophy size={12} color={cfg.rekorde[sp.id] ? WARN : MUTED} style={{ verticalAlign: -1, marginRight: 6 }} />{cfg.rekorde[sp.id] || "–"} <span style={{ color: MUTED, fontSize: 11 }}>{sp.rekord}</span></td>
                  <td style={td({ textAlign: "right", width: 1 })}><RekordReset aus={!cfg.rekorde[sp.id]} onReset={() => setCfg((c) => ({ ...c, rekorde: { ...c.rekorde, [sp.id]: 0 } }))} /></td>
                </tr>)}
              </Table>
            </Card>
          </div>

          <div>
            <div style={{ ...S.section, padding: 16 }}>
              <div className="sp-section-label">Ausgabe an die LED-Matrix</div>
              {!isElectron && <div style={{ color: WARN, fontSize: 12, marginBottom: 10, display: "flex", gap: 6 }}><TriangleAlert size={14} style={{ flexShrink: 0 }} /> sACN und NDI gibt es nur in der Desktop-App. Spielen geht auch hier.</div>}

              <Toggle checked={cfg.sacn.on} disabled={!isElectron} onChange={(v) => set("sacn", { on: v })} label="sACN (E1.31) senden" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0 14px" }}>
                <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.fieldLabel}>Netzwerkkarte</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select style={S.selectSm} value={cfg.sacn.iface} onChange={(e) => set("sacn", { iface: e.target.value })}>
                      <option value="">wie das System</option>
                      {interfaces.map((i) => <option key={i.name + i.address} value={i.address}>{i.name} · {i.address}/{i.prefix}</option>)}
                    </select>
                    <button style={S.smallBtn} onClick={ladeIfaces} title="Liste neu laden"><RefreshCw size={12} /></button>
                  </div>
                </label>
                <label style={S.field}><span style={S.fieldLabel}>Matrix 1 ab Universe</span>
                  <input style={S.inputSm} type="number" min={1} max={63999} value={cfg.sacn.u1} onChange={(e) => set("sacn", { u1: +e.target.value })} /></label>
                <label style={S.field}><span style={S.fieldLabel}>Matrix 2 ab Universe</span>
                  <input style={S.inputSm} type="number" min={1} max={63999} value={cfg.sacn.u2} onChange={(e) => set("sacn", { u2: +e.target.value })} /></label>
                <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.fieldLabel}>Pixel (RGB) je Universe</span>
                  <input style={S.inputSm} type="number" min={1} max={170} value={cfg.sacn.fpu} onChange={(e) => set("sacn", { fpu: +e.target.value })} />
                  <span className="sp-norm-hint">144 = 9 Kacheln à 4×4 Pixel (432 Kanäle). Je Matrix {anzahlUniverses(cfg.sacn.fpu)} Universes.</span></label>
              </div>

              <Toggle checked={cfg.ndi.on} disabled={!isElectron} onChange={(v) => set("ndi", { on: v })} label="NDI-Stream senden" />
              <label style={{ ...S.field, margin: "10px 0 4px" }}><span style={S.fieldLabel}>Name des NDI-Streams</span>
                <NdiName value={cfg.ndi.name} onChange={(name) => set("ndi", { name })} /></label>
              <span className="sp-norm-hint">480×240 px BGRA, 60 fps (jedes Pixel 10×10). Braucht die NDI Runtime (ndi.video/tools).</span>

              {ausgabeAn && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 12, fontSize: 12, display: "grid", gap: 6 }}>
                  <div style={{ color: SUB }}>Bilder je Sekunde: <b style={{ color: TEXT2 }}>{status?.fps ?? 0}</b></div>
                  {cfg.sacn.on && <Zeile ok={sacnSt?.on && !sacnSt?.err} text={sacnSt?.err ? `sACN: ${sacnSt.err}` : `sACN: Universes ${uni(cfg.sacn.u1)} und ${uni(cfg.sacn.u2)}, ${sacnSt?.pakete ?? 0} Pakete`} />}
                  {cfg.ndi.on && <Zeile ok={ndiSt?.on && !ndiSt?.err} text={ndiSt?.err ? `NDI: ${ndiSt.err}` : ndiSt?.on ? `NDI: „${ndiSt.name}“, ${ndiSt.verbindungen} Empfänger verbunden` : "NDI: startet …"} />}
                </div>
              )}
            </div>

            <div style={{ ...S.section, padding: 16 }}>
              <div className="sp-section-label">App-Einstellungen</div>
              <Toggle checked={cfg.menue} onChange={(v) => set("menue", v)} label="Spielmenü auf der Matrix" />
              <span className="sp-norm-hint">Der Start aus der Demo öffnet erst ein Menü auf der Matrix: ↑/↓ wählt das Spiel, bei Pong ←/→ 1P oder 2P, Enter oder A startet. So lässt sich am Gamepad zwischen den Spielen wechseln.</span>
              <label style={{ ...S.field, marginTop: 14 }}><span style={S.fieldLabel}>Demo übernimmt nach</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={LEERLAUF_STUFEN.length - 1} step={1} value={Math.max(0, LEERLAUF_STUFEN.indexOf(cfg.leerlauf))}
                    onChange={(e) => set("leerlauf", LEERLAUF_STUFEN[+e.target.value])} style={{ flex: 1, accentColor: ACCENT }} />
                  <b style={{ width: 52, textAlign: "right", color: ACCENT, fontSize: 12 }}>{leerlaufText(cfg.leerlauf)}</b>
                </div>
                <span className="sp-norm-hint">ohne Eingabe im Spiel oder Menü; in der Pause läuft die Zeit nicht.</span></label>
              <label style={{ ...S.field, marginTop: 10 }}><span style={S.fieldLabel}>Pong: Stärke des Computers</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={0} max={100} step={5} value={cfg.comStaerke} onChange={(e) => set("comStaerke", +e.target.value)} style={{ flex: 1, accentColor: ACCENT }} />
                  <b style={{ width: 52, textAlign: "right", color: ACCENT, fontSize: 12 }}>{cfg.comStaerke} %</b>
                </div>
                <span className="sp-norm-hint">{cfg.comStaerke < 30 ? "Leicht: langsam und reagiert spät." : cfg.comStaerke < 60 ? "Mittel: etwas langsamer als das Original." : cfg.comStaerke === 60 ? "Normal: wie das Original." : cfg.comStaerke < 90 ? "Schwer: schneller und rechnet aus, wo der Ball ankommt." : "Sehr schwer: kaum zu schlagen."}</span></label>
            </div>

            <div style={{ ...S.section, padding: 16 }}>
              <div className="sp-section-label">Spiele und Anleitung</div>
              <span style={S.fieldLabel}>Verfügbare Spiele</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "6px 0 4px" }}>
                {SPIELE.map((sp) => {
                  const an = !cfg.aus.includes(sp.id), letztes = an && verfuegbar.length === 1;
                  return <Toggle key={sp.id} checked={an} disabled={letztes} onChange={(v) => spielUmschalten(sp.id, v)} label={sp.name}
                    title={letztes ? "Ein Spiel muss verfügbar bleiben" : undefined} />;
                })}
              </div>
              <span className="sp-norm-hint">Nur diese Spiele stehen oben in der Leiste, im Spielmenü auf der Matrix und in der Anleitung.</span>
              <button style={{ ...S.secondaryBtn, marginTop: 12, width: "100%" }} onClick={anleitungLaden}
                title="Anleitung mit Tastatur- und Gamepad-Belegung für die verfügbaren Spiele als PDF speichern">
                <FileDown size={14} /> Anleitung als PDF ({verfuegbar.length === 1 ? "1 Spiel" : `${verfuegbar.length} Spiele`})</button>
              {pdfStatus && <span className="sp-norm-hint" style={{ wordBreak: "break-all" }}>{pdfStatus}</span>}
            </div>

            <div style={{ ...S.section, padding: 16 }}>
              <div className="sp-section-label">Live-Ansicht</div>
              <canvas ref={matrixRef} width={24 * 7 * 2 + 18} height={24 * 7} style={{ width: "100%", display: "block", borderRadius: 6, background: INPUT, border: `1px solid ${ACCENT}` }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 6 }}>
                <span>Matrix 1{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u1)}` : ""}</span>
                <span>Matrix 2{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u2)}` : ""}</span>
              </div>
              <Hint>So sieht das Bild auf den Matrizen aus: genau dieser Stand geht per sACN und NDI hinaus.{cfg.schwarz ? " Gerade dunkel geschaltet." : ""}</Hint>
            </div>
          </div>
        </div>
        <p style={{ ...S.hint, color: MUTED }}>
          sACN und NDI laufen weiter, wenn du das Spiel wechselst, und auch bei minimiertem Fenster.
        </p>
      </main></div>
      {changelog && <Modal title={`Matrix Games ${version}`} onClose={() => setChangelog(false)}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <button style={S.secondaryBtn} onClick={() => checkUpdate(true)}>Nach Updates suchen</button>
          {update?.tag && autoUpdate && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Lädt das Update (falls nötig), beendet die App, installiert und startet neu"><ArrowUpCircle size={14} /> {update.bereit ? "Neu starten und installieren" : `${update.tag} automatisch installieren`}</button>}
          {update?.tag && macUpdate && !update.macOffen && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Lädt das passende DMG in den Download-Ordner und öffnet es. Danach die App nach „Programme“ ziehen."><ArrowUpCircle size={14} /> {update.tag} laden und öffnen</button>}
          {update?.tag && macUpdate && update.macOffen && <button style={S.primaryBtn} onClick={() => api.appBeenden()} title="Beendet Matrix Games, damit du die neue Version nach „Programme“ ziehen kannst"><Power size={14} /> Matrix Games beenden</button>}
          {update?.tag && !autoUpdate && !macUpdate && <button style={S.primaryBtn} onClick={updateAusfuehren} title="Öffnet die Download-Seite."><Download size={14} /> {update.tag} herunterladen</button>}
          <button style={S.ghostBtn} onClick={() => api.openExternal(update?.url || RELEASES_URL)}>Alle Versionen auf GitHub</button>
          <span style={{ fontSize: 12, color: update ? OK : SUB }}>{updateStatus}</span>
        </div>
        {Object.entries(CHANGELOG).map(([v, items]) => <div key={v}><div className="sp-section-label">Version {v}{v === version ? " (installiert)" : ""}</div><ul style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>)}
      </Modal>}
    </div>
  );
}

// Der NDI-Name gilt erst beim Verlassen des Felds (oder Enter): sonst entstünde je Buchstabe ein neuer Stream
function NdiName({ value, onChange }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const fertig = () => { const n = v.trim() || "Matrix Games"; setV(n); if (n !== value) onChange(n); };
  return <input style={S.inputSm} value={v} onChange={(e) => setV(e.target.value)} onBlur={fertig} />;
}

// Zurücksetzen mit Rückfrage: der erste Klick fragt „Sicher?“, der zweite setzt den Rekord auf 0
function RekordReset({ aus, onReset }) {
  const [frage, setFrage] = useState(false);
  useEffect(() => { if (!frage) return; const t = setTimeout(() => setFrage(false), 3000); return () => clearTimeout(t); }, [frage]);
  return <button style={{ ...S.smallBtn, ...(frage ? { background: ERR, color: "#fff", borderColor: ERR } : {}), opacity: aus ? 0.5 : 1 }} disabled={aus}
    onClick={(e) => { e.currentTarget.blur(); if (frage) { setFrage(false); onReset(); } else setFrage(true); }}
    title="Highscore zurücksetzen"><RotateCcw size={11} /> {frage ? "Sicher?" : "Zurücksetzen"}</button>;
}

const Zeile = ({ ok, text }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: ok ? TEXT2 : ERR }}>
    <span style={{ marginTop: 3 }}><Dot color={ok ? OK : ERR} size={7} /></span> {text}
  </div>
);
