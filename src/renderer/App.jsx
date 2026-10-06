import React, { useState, useEffect, useRef, useCallback } from "react";
import { S, ACCENT, OK, ERR, WARN, SUB, MUTED, TEXT2, INPUT, LINE, THEME_KEY, themeWahl } from "../shared/constants.js";
import { SPIELE, Bild, W, H } from "../shared/spiele/index.js";
import { api, isElectron } from "./api.js";
import { createTon } from "./spiele/ton.js";
import { Toggle, Dot, Card, Table, td, Hint } from "./ui.jsx";
import { Volume2, VolumeX, RotateCcw, RefreshCw, TriangleAlert, Gamepad2, Sun, Moon, Monitor } from "lucide-react";
import APP_ICON_SVG from "../../assets/app-icon/icon.svg";
const APP_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(APP_ICON_SVG)}`;

const LS = "matrixgames_einstellungen";
// Vorgaben wie im Snake-Original auf der echten Matrix (Universe 29 und 33, 144 Pixel je Universe)
const STANDARD = { spiel: "snake", ton: true, sacn: { on: false, iface: "", u1: 29, u2: 33, fpu: 144 }, ndi: { on: false, name: "Matrix Games" } };
const laden = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "null");
    return v ? { ...STANDARD, ...v, sacn: { ...STANDARD.sacn, ...v.sacn }, ndi: { ...STANDARD.ndi, ...v.ndi } } : STANDARD;
  } catch { return STANDARD; }
};

const STEP = 1000 / 60;
const ZUSTAND = { title: "Titelbild", playing: "läuft", paused: "Pause", point_scored: "Punkt", game_over: "Game Over" };
// Tasten, die im Spiel nicht scrollen oder Knöpfe auslösen sollen
const SPIELTASTEN = new Set(["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"]);
const istEingabe = (el) => el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);
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
  const [zustand, setZustand] = useState("title");
  const canvasRef = useRef(null), matrixRef = useRef(null);
  const gameRef = useRef(null), tonRef = useRef(null), held = useRef(new Set()), zustandRef = useRef("title");
  const ausgabeAn = (cfg.sacn.on || cfg.ndi.on) && isElectron;
  const ausgabeRef = useRef(ausgabeAn);
  ausgabeRef.current = ausgabeAn;

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch {} }, [cfg]);
  useEffect(() => { api.appVersion().then(setVersion); }, []);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: typeof v === "object" ? { ...c[k], ...v } : v }));

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

  // Spiel anlegen (bei Wechsel neu)
  const neu = useCallback(() => {
    tonRef.current?.stopAlle();
    const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
    gameRef.current = def.create({ ton: (name) => tonRef.current?.play(def.id, name) });
    held.current.clear();
    document.activeElement?.blur?.();
  }, [cfg.spiel]);
  useEffect(() => { neu(); }, [neu]);

  // Spielschleife: feste 60 Schritte je Sekunde. setInterval statt requestAnimationFrame,
  // damit sACN/NDI auch bei minimiertem Fenster weiterlaufen (der Hauptprozess schaltet die Drosselung ab).
  useEffect(() => {
    const bild = new Bild();
    let last = performance.now(), acc = 0, n = 0;
    const id = setInterval(() => {
      const now = performance.now();
      acc = Math.min(acc + now - last, STEP * 5);
      last = now;
      const g = gameRef.current;
      if (!g) return;
      let schritte = 0;
      while (acc >= STEP) { g.step(held.current); acc -= STEP; schritte++; }
      if (!schritte) return;
      g.render(bild);
      const cv = canvasRef.current;
      if (cv) cv.getContext("2d").putImageData(new ImageData(rgba(bild.px), W, H), 0, 0);
      if (matrixRef.current && (n++ & 1) === 0) zeichneMatrix(matrixRef.current, bild.px);
      if (ausgabeRef.current) api.frame(bild.px);
      if (g.state !== zustandRef.current) { zustandRef.current = g.state; setZustand(g.state); }
    }, 4);
    return () => clearInterval(id);
  }, []);

  // Tastatur: nur wenn kein Eingabefeld den Fokus hat
  useEffect(() => {
    const down = (e) => {
      if (istEingabe(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (SPIELTASTEN.has(e.code)) e.preventDefault();
      if (!e.repeat) gameRef.current?.key(e.code);
      held.current.add(e.code);
    };
    const up = (e) => held.current.delete(e.code);
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  const theme = themeWahl();
  const setTheme = (t) => { try { localStorage.setItem(THEME_KEY, t); } catch {} location.reload(); };
  const def = SPIELE.find((s) => s.id === cfg.spiel) || SPIELE[0];
  const sacnSt = status?.sacn, ndiSt = status?.ndi;
  const uni = (start) => `${start}–${+start + anzahlUniverses(cfg.sacn.fpu) - 1}`;
  const sendet = ausgabeAn && ((cfg.sacn.on && sacnSt?.on && !sacnSt?.err) || (cfg.ndi.on && ndiSt?.on && !ndiSt?.err));

  return (
    <div style={S.app}>
      <header style={S.header}>
        <img src={APP_ICON} alt="" width={26} height={26} style={{ borderRadius: 6 }} />
        <span style={S.logo}>MATRIX GAMES</span>
        {version && <span style={{ ...S.badge, border: `1px solid ${LINE}`, color: SUB, fontWeight: 600 }}>v{version}</span>}
        <span style={S.headerMeta}>48×24 px · zwei LED-Matrizen à 24×24</span>
        {isElectron && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: sendet ? OK : MUTED, marginRight: 4 }}>
          <Dot color={sendet ? OK : LINE} /> {sendet ? "sendet" : "keine Ausgabe"}
        </span>}
        <button style={S.ghostBtn} onClick={() => set("ton", !cfg.ton)} title={cfg.ton ? "Ton aus" : "Ton an"}>{cfg.ton ? <Volume2 size={14} /> : <VolumeX size={14} />} Ton</button>
        <button style={S.ghostBtn} onClick={neu} title="Spiel neu starten (zurück zum Titelbild)"><RotateCcw size={14} /> Neu</button>
        <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }} title="Erscheinungsbild">
          {THEMES.map(([k, l, Ic]) => (
            <button key={k} onClick={() => k !== theme && setTheme(k)} title={l}
              style={{ background: k === theme ? ACCENT : "transparent", color: k === theme ? "#fff" : SUB, border: "none", padding: "7px 9px", cursor: "pointer", display: "inline-flex" }}><Ic size={14} /></button>
          ))}
        </div>
      </header>
      <nav style={S.nav}>
        {SPIELE.map((s) => (
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
              <div style={{ background: "#000", borderRadius: 6, overflow: "hidden", border: `2px solid ${ACCENT}` }}>
                <canvas ref={canvasRef} width={W} height={H} style={{ display: "block", width: "100%", aspectRatio: `${W} / ${H}`, imageRendering: "pixelated" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 12, color: SUB, flexWrap: "wrap" }}>
                <Gamepad2 size={14} color={ACCENT} /> {def.name} · {W}×{H} px · 60 fps
                <span style={{ flex: 1 }} />
                <span>Zustand: <b style={{ color: TEXT2 }}>{ZUSTAND[zustand] || zustand}</b></span>
              </div>
            </div>
            <Card title="Tasten">
              <Table head={["Taste", "Funktion"]}>
                {def.tasten.map(([k, f]) => <tr key={k}><td style={td({ fontWeight: 600, whiteSpace: "nowrap" })}>{k}</td><td style={td()}>{f}</td></tr>)}
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
                <input style={S.inputSm} value={cfg.ndi.name} onChange={(e) => set("ndi", { name: e.target.value })} /></label>
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
              <div className="sp-section-label">Live-Ansicht</div>
              <canvas ref={matrixRef} width={24 * 7 * 2 + 18} height={24 * 7} style={{ width: "100%", display: "block", borderRadius: 6, background: INPUT, border: `1px solid ${ACCENT}` }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginTop: 6 }}>
                <span>Matrix 1{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u1)}` : ""}</span>
                <span>Matrix 2{cfg.sacn.on ? ` · U ${uni(cfg.sacn.u2)}` : ""}</span>
              </div>
              <Hint>So sieht das Bild auf den Matrizen aus: genau dieser Stand geht per sACN und NDI hinaus.</Hint>
            </div>
          </div>
        </div>
        <p style={{ ...S.hint, color: MUTED }}>
          sACN und NDI laufen weiter, wenn du das Spiel wechselst, und auch bei minimiertem Fenster.
        </p>
      </main></div>
    </div>
  );
}

const Zeile = ({ ok, text }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: ok ? TEXT2 : ERR }}>
    <span style={{ marginTop: 3 }}><Dot color={ok ? OK : ERR} size={7} /></span> {text}
  </div>
);
