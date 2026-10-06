import React from "react";
import { S, TEXT2 } from "../shared/constants.js";

export function Toggle({ checked, onChange, label, title, disabled }) {
  return (
    <label title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: disabled ? "default" : "pointer", fontSize: 12, color: TEXT2, userSelect: "none", opacity: disabled ? 0.55 : 1 }}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export const Dot = ({ color, size = 9, title }) => (
  <span title={title} style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

export const td = (extra) => ({ ...S.td, ...extra });

export const Card = ({ title, children }) => (
  <div style={{ ...S.card, padding: 14, marginBottom: 14 }}>
    {title && <div style={{ ...S.h3, marginBottom: 8 }}>{title}</div>}
    {children}
  </div>
);

export const Table = ({ head, children }) => (
  <table style={S.table}>
    <thead><tr>{head.map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table>
);

export const Hint = ({ children }) => <p style={{ ...S.hint, marginTop: 14 }}>{children}</p>;
