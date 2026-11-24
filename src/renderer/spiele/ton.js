// Töne der Spiele: dieselben prozeduralen 8-Bit-Klänge wie in den Python-Originalen
// (Rechteckwellen, Hüllkurven, Mario-Titelmelodie), hier per Web Audio erzeugt.
import TETRIS_MUSIK from "../../../assets/musik/tetris.mp3";

export const RATE = 22050;
// Eingebaute Soundtracks (Dateien in assets/musik, beim Build in die App gepackt)
const EINGEBAUT = { tetris: TETRIS_MUSIK };

const sq = (n, f, duty = 0.5) => Float32Array.from({ length: n }, (_, i) => (((i / RATE) * f) % 1 < duty ? 1 : -1));
const glide = (n, f0, f1) => {
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { ph += (f0 + ((f1 - f0) * i) / Math.max(1, n - 1)) / RATE; out[i] = Math.sign(Math.sin(2 * Math.PI * ph)); }
  return out;
};
const lin = (n, a, b) => Float32Array.from({ length: n }, (_, i) => (n === 1 ? a : a + ((b - a) * i) / (n - 1)));
function env(n, a = 0.01, d = 0.05, s = 0.7, r = 0.2) {
  const na = Math.max(Math.floor(n * a), 1), nd = Math.max(Math.floor(n * d), 1), nr = Math.max(Math.floor(n * r), 1);
  const ns = Math.max(n - na - nd - nr, 0);
  return cat([lin(na, 0, 1), lin(nd, 1, s), new Float32Array(ns).fill(s), lin(nr, s, 0)]).subarray(0, n);
}
const mul = (a, b) => a.map((v, i) => v * (b[i] ?? 0));
const cat = (parts) => { const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const vol = (a, v) => a.map((x) => Math.max(-1, Math.min(1, x * v)));
const N = (sec) => Math.floor(RATE * sec);

// Python-Pieptöne (Snake, Pong): Rechteck mit exponentiellem Abklingen
const beep = (f, ms, v, decay) => Float32Array.from({ length: N(ms / 1000) }, (_, i) => { const t = i / RATE; return (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1) * Math.exp(-t * decay) * v; });
const chord = (fs, ms, v, decay) => Float32Array.from({ length: N(ms / 1000) }, (_, i) => {
  const t = i / RATE;
  return (fs.reduce((s, f) => s + (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1), 0) / fs.length) * Math.exp(-t * decay) * v;
});

/* ── Mario: SMB-Titelmelodie (Achtelnoten bei 185 BPM, 25 % Pulsbreite) ── */
const NOTE = { G3: 196, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392, Ab4: 415.3, A4: 440, Bb4: 466.16, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.26, F5: 698.46, Fs5: 739.99, G5: 784, A5: 880, C6: 1046.5, R: 0 };
const TEIL_A = "C5 2,R 1,G4 2,R 3,E4 2,R 3,A4 2,R 1,B4 2,R 1,Bb4 1,A4 2,G4 1.5,E5 1.5,G5 2,A5 2,R 1,F5 1,G5 2,R 1,E5 2,R 1,C5 2,D5 1,B4 3";
const SMB = [
  "E5 1,R .5,E5 1,R .5,R 1,C5 1,E5 2,R 1,G5 2,R 2,G4 2,R 4",
  TEIL_A, TEIL_A,
  "E4 1,R .5,C5 1,R .5,G3 1.5,R .5,Ab4 1.5,R .5,A4 1,R .5,F4 1,R .5,Fs4 1.5,R .5,G4 1,E5 1,R .5,E5 1,E5 1,C5 1,D5 1.5,R .5",
  "G5 1,Fs5 1,F5 1,D5 1.5,E5 1,R .5,G4 1,A4 1,C5 1,R .5,A4 1,C5 1,D5 2,G5 1,Fs5 1,F5 1,D5 1.5,E5 1,R .5,C6 1,R .5,C6 1,C6 1.5,R 1",
  TEIL_A, TEIL_A.replace(/B4 3$/, "B4 4"),
].join(",").split(",").map((x) => { const [n, b] = x.trim().split(" "); return [n, +b]; });

function smbTheme() {
  const eighth = 60 / (185 * 2), parts = [];
  for (const [note, beats] of SMB) {
    const n = Math.max(Math.floor(beats * eighth * RATE), 1), f = NOTE[note] || 0;
    if (!f) { parts.push(new Float32Array(n)); continue; }
    const w = sq(n, f, 0.25);
    const na = Math.min(Math.max(N(0.006), 1), n >> 2), ng = Math.min(Math.max(N(0.012), 1), n >> 2);
    for (let i = 0; i < na; i++) w[i] *= na === 1 ? 0 : i / (na - 1);
    for (let i = n - ng; i < n; i++) w[i] = 0;
    parts.push(w);
  }
  return vol(cat(parts), 0.16);
}

function marioSounds() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const n = N(0.08), noise = Float32Array.from({ length: n }, rnd);
  for (let i = 1; i < n; i++) noise[i] = noise[i] * 0.35 + noise[i - 1] * 0.65;
  const arp = (fs, d, e) => cat(fs.map((f) => mul(sq(N(d), f), env(N(d), ...e))));
  return {
    jump: vol(mul(glide(N(0.13), 270, 540), env(N(0.13), 0.01, 0.08, 0.85, 0.08)), 0.27),
    stomp: vol(mul(glide(N(0.09), 380, 80), env(N(0.09), 0.01, 0.05, 0.55, 0.42)), 0.38),
    coin: vol(cat([mul(sq(N(0.045), 659), env(N(0.045), 0.01, 0.02, 0.75, 0.15)), mul(sq(N(0.105), 988), env(N(0.105), 0.01, 0.04, 0.65, 0.28))]), 0.26),
    block: vol(mul(glide(N(0.065), 380, 160), env(N(0.065), 0.01, 0.04, 0.45, 0.52)), 0.32),
    brick: vol(mul(noise, env(n, 0.01, 0.04, 0.25, 0.68)), 0.32),
    powerup: vol(arp([262, 330, 392, 523], 0.068, [0.02, 0.04, 0.72, 0.18]), 0.26),
    "1up": vol(arp([262, 330, 392, 523, 659, 784, 1047], 0.052, [0.02, 0.03, 0.72, 0.18]), 0.24),
    death: vol(cat([
      mul(sq(N(0.12), 494), env(N(0.12), 0.01, 0.05, 0.72, 0.25)),
      mul(sq(N(0.12), 392), env(N(0.12), 0.01, 0.05, 0.62, 0.35)),
      new Float32Array(N(0.04)),
      mul(glide(N(0.32), 380, 55), env(N(0.32), 0.02, 0.08, 0.5, 0.45)),
    ]), 0.29),
    kick: vol(mul(glide(N(0.065), 880, 440), env(N(0.065), 0.01, 0.03, 0.5, 0.52)), 0.24),
    star: vol(arp([523, 659, 784, 1047], 0.042, [0.01, 0.02, 0.8, 0.12]), 0.22),
    fire: vol(mul(glide(N(0.06), 900, 420), env(N(0.06), 0.01, 0.03, 0.5, 0.5)), 0.2),
    // Röhre: drei tiefe Stöße
    pipe: vol(cat([0, 1, 2].map(() => cat([mul(glide(N(0.06), 220, 110), env(N(0.06), 0.01, 0.02, 0.6, 0.4)), new Float32Array(N(0.04))]))), 0.3),
    // Fahne: langer Abwärts-Glissando; Ziel: kurze Fanfare
    flag: vol(mul(glide(N(0.9), 1100, 160), env(N(0.9), 0.01, 0.05, 0.7, 0.2)), 0.18),
    clear: vol(cat([
      arp([392, 523, 659, 784, 1047, 1319], 0.09, [0.02, 0.04, 0.75, 0.2]),
      mul(sq(N(0.45), 1568, 0.25), env(N(0.45), 0.02, 0.1, 0.6, 0.4)),
      new Float32Array(N(0.08)),
      arp([415, 523, 622, 831, 1047, 1245], 0.09, [0.02, 0.04, 0.75, 0.2]),
      mul(sq(N(0.6), 1661, 0.25), env(N(0.6), 0.02, 0.1, 0.6, 0.45)),
    ]), 0.2),
  };
}

// Tetris: eigene 8-Bit-Effekte (keine Originalklänge). Kurz und knackig, damit sie bei schnellem Spiel nicht matschen.
function tetrisSounds() {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const rauschen = (n, glatt = 0.5) => { const r = Float32Array.from({ length: n }, rnd); for (let i = 1; i < n; i++) r[i] = r[i] * (1 - glatt) + r[i - 1] * glatt; return r; };
  const plus = (a, b) => { const out = new Float32Array(Math.max(a.length, b.length)); out.set(a); for (let i = 0; i < b.length; i++) out[i] += b[i]; return out; };
  const ton = (f, d, duty = 0.5, e = [0.01, 0.05, 0.6, 0.3]) => mul(sq(N(d), f, duty), env(N(d), ...e));
  const arp = (fs, d, duty = 0.25) => cat(fs.map((f) => ton(f, d, duty, [0.02, 0.04, 0.75, 0.2])));
  const schlag = (f0, f1, d) => plus(mul(glide(N(d), f0, f1), env(N(d), 0.005, 0.05, 0.4, 0.6)), mul(rauschen(N(d * 0.6), 0.7), env(N(d * 0.6), 0.005, 0.05, 0.3, 0.7)).map((v) => v * 0.6));
  return {
    // Schieben: leises Klicken
    move: vol(ton(1568, 0.018, 0.125, [0.01, 0.2, 0.4, 0.5]), 0.09),
    // Drehen: kurzes „Plip“ aufwärts
    rotate: vol(mul(glide(N(0.045), 740, 1180), env(N(0.045), 0.01, 0.1, 0.6, 0.45)), 0.15),
    // Ablegen: dumpfer Klack
    lock: vol(schlag(220, 90, 0.07), 0.3),
    // Hard Drop: Zischen nach unten, dann Aufprall
    drop: vol(cat([mul(glide(N(0.05), 1400, 300), env(N(0.05), 0.01, 0.1, 0.5, 0.3)).map((v) => v * 0.45), schlag(180, 60, 0.11)]), 0.32),
    // Zeile: helles Aufwärts-Arpeggio mit Funkeln
    line: vol(plus(arp([523, 659, 784, 1047], 0.05), rauschen(N(0.2), 0.1).map((v, i, r) => v * 0.12 * (1 - i / r.length))), 0.22),
    // Vier Zeilen auf einmal: Fanfare
    tetris: vol(cat([arp([523, 659, 784, 1047, 1319], 0.05), ton(1568, 0.08, 0.25), new Float32Array(N(0.02)), ton(1568, 0.08, 0.25), ton(2093, 0.28, 0.25, [0.01, 0.08, 0.7, 0.4])]), 0.22),
    // Level geschafft: Tonleiter in Oktaven
    level: vol(cat([arp([392, 494, 587, 784], 0.045, 0.5), arp([784, 988, 1175, 1568], 0.045, 0.25)]), 0.18),
    // Game Over: absteigende Moll-Folge, dann langes Abrutschen
    over: vol(cat([arp([659, 622, 587, 554], 0.12, 0.5), mul(glide(N(0.8), 523, 65), env(N(0.8), 0.02, 0.1, 0.6, 0.35))]), 0.24),
  };
}

export const KLAENGE = {
  snake: () => ({ eat: beep(880, 55, 0.25, 20), die: chord([130, 98], 480, 0.35, 5) }),
  pong: () => ({ paddle: beep(480, 45, 0.35, 18), wall: beep(260, 30, 0.25, 18), score: beep(110, 450, 0.45, 18) }),
  mario: marioSounds,
  tetris: tetrisSounds,
};

// Ausgabegerät: "" = Systemstandard, sonst die deviceId aus navigator.mediaDevices.enumerateDevices()
// (kind "audiooutput"). Alle Klänge laufen über einen AudioContext, der per setSinkId auf dieses Gerät geht.
export async function audioAusgaenge() {
  try {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return [];
    return (await md.enumerateDevices())
      .filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
      .map((d, i) => ({ id: d.deviceId, name: d.label || `Ausgabe ${i + 1}` }));
  } catch { return []; }
}

// Lautstärke 0–100 % auf eine Verstärkung mit hörbar gleichmäßigen Stufen
const pegel = (p) => { const x = Math.max(0, Math.min(100, +p || 0)) / 100; return x * x; };

export function createTon({ onGeraetFehler } = {}) {
  let ctx = null, master = null, fx = null, mus = null, musik = null, an = true, geraet = "", gesetzt = "";
  let lautFx = 100, lautMusik = 100, musikAn = true, tempo = 1, tempoAn = true;
  // musik: laufender Soundtrack { src, key, start, offset }; gemerkt: Stelle beim Pausieren
  let gemerkt = null;
  const aktive = new Set();
  const cache = {};
  const soundtracks = {};        // spiel -> AudioBuffer (eigene Datei oder eingebauter Soundtrack)
  const rohdaten = {};           // spiel -> ArrayBuffer, wird beim ersten Abspielen dekodiert
  const quelle = {};             // spiel -> "datei" | "eigen" (Teil des Musik-Schlüssels, damit die Pause-Stelle passt)
  const eingebaut = (spiel) => { delete soundtracks[spiel]; delete rohdaten[spiel]; quelle[spiel] = "eigen"; if (EINGEBAUT[spiel]) rohdaten[spiel] = EINGEBAUT[spiel].slice().buffer; };
  for (const sp of Object.keys(EINGEBAUT)) eingebaut(sp);
  const puffer = (spiel, name) => {
    const k = `${spiel}:${name}`;
    if (!cache[k]) {
      const data = name === "_music" ? (spiel === "mario" ? smbTheme() : null) : (cache[`${spiel}:*`] ||= KLAENGE[spiel]?.() || {})[name];
      if (!data) return null;
      const b = ctx.createBuffer(1, data.length, RATE);
      b.copyToChannel(data, 0);
      cache[k] = b;
    }
    return cache[k];
  };
  const pegelSetzen = () => {
    if (!master) return;
    master.gain.value = an ? 1 : 0;
    fx.gain.value = pegel(lautFx);
    mus.gain.value = musikAn ? pegel(lautMusik) : 0;
  };
  // Gerät am Kontext setzen; klappt es nicht (Gerät weg, keine Unterstützung), bleibt der Systemstandard
  const sinkSetzen = () => {
    if (!ctx || gesetzt === geraet) return;
    const ziel = geraet;
    gesetzt = ziel;
    if (typeof ctx.setSinkId !== "function") { if (ziel) onGeraetFehler?.(ziel, new Error("setSinkId nicht unterstützt")); return; }
    ctx.setSinkId(ziel).catch((e) => {
      if (gesetzt !== ziel) return;
      gesetzt = "";
      ctx?.setSinkId("").catch(() => {});
      onGeraetFehler?.(ziel, e);
    });
  };
  const ensure = () => {
    if (!ctx) {
      try {
        ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination);
        fx = ctx.createGain(); fx.connect(master); mus = ctx.createGain(); mus.connect(master);
        gesetzt = ""; pegelSetzen();
      } catch { return false; }
    }
    sinkSetzen();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return true;
  };
  // Stelle im Stück (s); das Tempo zählt mit
  const musikStelle = () => (musik.offset + (ctx.currentTime - musik.start) * musik.rate) % musik.src.buffer.duration;
  const tempoSetzen = () => {
    if (!musik) return;
    const rate = tempoAn ? tempo : 1;
    if (rate === musik.rate) return;
    musik.offset = musikStelle(); musik.start = ctx.currentTime; musik.rate = rate;
    musik.src.playbackRate.setValueAtTime(rate, ctx.currentTime);
  };
  const stopMusik = (merken = false) => {
    if (!musik) return;
    gemerkt = merken ? { key: musik.key, offset: musikStelle() } : null;
    try { musik.src.stop(); } catch {}
    musik = null;
  };
  const stopAlle = (merken = false) => { stopMusik(merken); for (const s of aktive) { try { s.stop(); } catch {} } aktive.clear(); };
  // Soundtrack-Datei dekodieren (einmal je Spiel); bis dahin läuft die eingebaute Musik bzw. nichts
  const dekodiere = async (spiel) => {
    const roh = rohdaten[spiel];
    if (!roh || !ensure()) return null;
    delete rohdaten[spiel];
    try { soundtracks[spiel] = await ctx.decodeAudioData(roh.slice(0)); } catch (e) { console.warn("Soundtrack", spiel, e); soundtracks[spiel] = null; }
    return soundtracks[spiel];
  };
  const starteMusik = (spiel, b, key) => {
    const offset = gemerkt?.key === key ? gemerkt.offset : 0;
    gemerkt = null;
    stopMusik();
    const src = ctx.createBufferSource();
    const rate = tempoAn ? tempo : 1;
    src.buffer = b; src.loop = true; src.playbackRate.value = rate; src.connect(mus);
    musik = { src, key, start: ctx.currentTime, offset, rate };
    src.start(0, offset);
  };
  let musikWunsch = null;        // das Spiel, dessen Musik laufen soll (für Dateien, die noch dekodiert werden)
  const play = (spiel, name, wert) => {
    if (name === "_stop") { musikWunsch = null; gemerkt = null; tempo = 1; return stopAlle(); }
    if (name === "_tempo") { tempo = wert || 1; return tempoSetzen(); }
    if (name === "_pause") { musikWunsch = null; return stopAlle(true); }
    if (!ensure()) return;
    if (name === "death") stopAlle();                 // wie pygame.mixer.stop()
    if (name === "_music") {
      musikWunsch = spiel;
      if (rohdaten[spiel]) { dekodiere(spiel).then(() => { if (musikWunsch === spiel) play(spiel, "_music"); }); return; }
      const datei = soundtracks[spiel];
      const b = datei || puffer(spiel, "_music");
      if (b) starteMusik(spiel, b, `${spiel}:${quelle[spiel] || "eigen"}`);
      return;
    }
    const b = puffer(spiel, name);
    if (!b) return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(fx);
    aktive.add(src); src.onended = () => aktive.delete(src);
    src.start();
  };
  return {
    play, stopAlle,
    get an() { return an; },
    setAn(v) { an = v; pegelSetzen(); },
    // Lautstärke der Effekte und des Soundtracks (0–100), Soundtrack an/aus
    setPegel({ effekte = lautFx, musik: m = lautMusik, musikAn: ma = musikAn } = {}) { lautFx = effekte; lautMusik = m; musikAn = ma; pegelSetzen(); },
    // Musik im späteren Spiel schneller (Tetris: mit dem Level)
    setTempoAn(v) { tempoAn = !!v; tempoSetzen(); },
    // Soundtrack-Datei für ein Spiel (ArrayBuffer) oder null für die eingebaute Musik.
    // Läuft die Musik dieses Spiels gerade, wechselt sie sofort.
    setSoundtrack(spiel, daten) {
      if (daten) { delete soundtracks[spiel]; rohdaten[spiel] = daten; quelle[spiel] = "datei"; } else eingebaut(spiel);
      if (musik?.key.startsWith(`${spiel}:`)) { stopMusik(); play(spiel, "_music"); }
    },
    get geraet() { return geraet; },
    // Ausgabegerät wechseln; laufende Klänge und Musik wandern mit
    setGeraet(id) { geraet = id || ""; sinkSetzen(); },
    // kurzer Prüfton auf dem gewählten Gerät (auch wenn der Ton gerade aus ist)
    test() {
      if (!ensure()) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = "square"; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
    },
    close() { stopAlle(); try { ctx?.close(); } catch {} ctx = null; master = fx = mus = null; gesetzt = ""; },
  };
}
