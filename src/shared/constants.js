/* ── Erscheinungsbild: Hell, Dunkel oder wie das System ─────────────────────
   Gleiche Designsprache wie der Netzwerkplaner, Akzentfarbe Grün.
   Die Wahl steht im localStorage und gilt beim Laden der Oberfläche. */
export const THEME_KEY = "matrixgames_theme";
export const themeWahl = () => { try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; } };
export const systemHell = () => { try { return !window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } };
const wahl = typeof window === "undefined" ? "dunkel" : themeWahl();
export const HELL = wahl === "hell" || (wahl === "system" && typeof window !== "undefined" && systemHell());

/* ── Farben (wie Netzwerkplaner) ─────────────────────────────────────────── */
const F = HELL ? {
  DARK: "#ffffff", PANEL: "#ffffff", LINE: "#d3d9df", BG: "#eef1f4",
  OK: "#1f9d55", WARN: "#c77700", ERR: "#d63c3c", INFO: "#2a78d1", MUTED: "#6f7a86", SUB: "#56616d",
  TEXT: "#1d232a", STRONG: "#10151b", TEXT2: "#38414b", INPUT: "#ffffff", CARD: "#f6f8fa", BTN: "#e9edf1",
  LINE2: "#e5e9ed", MID: "#a5aeb8", OPTBG: "#ffffff",
} : {
  DARK: "#1c2127", PANEL: "#252b33", LINE: "#3a424c", BG: "#15191e",
  OK: "#2ecc71", WARN: "#f39c12", ERR: "#ff5d5d", INFO: "#4ea1ff", MUTED: "#7c8794", SUB: "#9aa4af",
  TEXT: "#e8eaed", STRONG: "#ffffff", TEXT2: "#c8d0d8", INPUT: "#1b2026", CARD: "#1f242b", BTN: "#323a44",
  LINE2: "#232a33", MID: "#56606c", OPTBG: "#1b2026",
};
export const ACCENT = HELL ? "#1f9d55" : "#27ae60";
export const { DARK, PANEL, LINE, BG, OK, WARN, ERR, INFO, MUTED, SUB, TEXT, STRONG, TEXT2, INPUT, CARD, BTN, LINE2, MID } = F;
export const THEME_VARS = { ...F, ACCENT };

/* ── Style-Objekt (Designsprache wie Netzwerkplaner/Stromplaner) ─────────── */
export const S = {
  app:          { fontFamily: "'Segoe UI',system-ui,sans-serif", background: BG, height: "100vh", color: TEXT, display: "flex", flexDirection: "column", overflow: "hidden" },
  header:       { display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: DARK, borderBottom: `2px solid ${ACCENT}`, position: "relative", zIndex: 10, flexWrap: "wrap", flexShrink: 0 },
  logo:         { fontWeight: 800, fontSize: 18, letterSpacing: 1, color: ACCENT, whiteSpace: "nowrap" },
  headerMeta:   { fontSize: 12, color: SUB, flex: 1, minWidth: 120 },
  ghostBtn:     { background: "transparent", color: TEXT, border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 11px", fontWeight: 600, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 },
  nav:          { display: "flex", gap: 4, padding: "0 18px", background: DARK, borderBottom: `1px solid ${LINE}`, flexWrap: "wrap", position: "relative", zIndex: 9, flexShrink: 0 },
  navBtn:       { background: "transparent", border: "none", color: SUB, padding: "11px 13px", cursor: "pointer", fontSize: 13, borderBottom: "3px solid transparent", transition: "color 0.14s,border-color 0.14s" },
  navBtnActive: { color: STRONG, borderBottom: `3px solid ${ACCENT}`, fontWeight: 600 },
  main:         { padding: 20, maxWidth: 1280, margin: "0 auto" },
  section:      { background: PANEL, borderRadius: 10, padding: 20, marginBottom: 20, border: `1px solid ${LINE}` },
  h3:           { margin: "0 0 8px", fontSize: 14, color: STRONG },
  field:        { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel:   { fontSize: 11, color: SUB, fontWeight: 600 },
  inputSm:      { background: INPUT, border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: STRONG, fontSize: 13, width: "100%", boxSizing: "border-box" },
  selectSm:     { background: INPUT, border: `1px solid ${LINE}`, borderRadius: 5, padding: "5px 8px", color: STRONG, fontSize: 13, width: "100%", boxSizing: "border-box" },
  primaryBtn:   { background: ACCENT, color: "#fff", border: "none", borderRadius: 6, padding: "9px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 },
  smallBtn:     { background: BTN, color: STRONG, border: `1px solid ${LINE}`, borderRadius: 5, padding: "4px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 },
  table:        { width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 13 },
  th:           { textAlign: "left", padding: "7px 8px", borderBottom: `2px solid ${LINE}`, color: SUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" },
  td:           { padding: "5px 8px", borderBottom: `1px solid ${LINE}`, verticalAlign: "middle" },
  hint:         { fontSize: 11, color: MUTED, marginTop: 10, lineHeight: 1.5 },
  card:         { border: `1px solid ${LINE}`, borderRadius: 8, marginBottom: 8, background: CARD },
  badge:        { display: "inline-block", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 },
};
