// Fernsteuerung über das Netzwerk: ein Gerät an der LED-Matrix (Handy, Tablet, Laptop mit
// Gamepad oder Tastatur) steuert die App, die in der Regie läuft. Die Eingaben kommen im
// Hauptprozess an und gehen per IPC ans Spiel, deshalb braucht das App-Fenster keinen Fokus.
//
//   GET  /                      → Controller-Seite für den Browser (Touch, Tastatur, Gamepad)
//   GET  /status                → gewähltes Spiel als JSON
//   POST /eingabe               → Stand eines Controllers: {id, seq, name, tasten:[Codes], pads:[{spieler, knoepfe:[Nr.]}]}
//   GET  /knopf/a               → Knopf kurz drücken (für Stream Deck, Companion, Skripte); ?spieler=2, ?dauer=ms
//   GET  /knopf/rechts/an  …/aus → Knopf halten und loslassen
//
// Knöpfe in Standard-Gamepad-Nummern: 0 A, 1 B, 2 X, 3 Y, 8 Select, 9 Start, 12–15 ↑ ↓ ← →.
// Meldet sich ein Controller 1,5 s nicht, gelten seine Knöpfe als losgelassen (WLAN weg, Seite zu).
// Kein Electron-Import, damit der Server im Test unter reinem Node läuft.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const STANDARD_PORT = 8788;
const TIMEOUT_MS = 1500;
const KNOEPFE = { a: 0, b: 1, x: 2, y: 3, select: 8, back: 8, start: 9, hoch: 12, oben: 12, up: 12, runter: 13, unten: 13, down: 13, links: 14, left: 14, rechts: 15, right: 15 };
const knopfNr = (w) => {
  if (w == null) return null;
  const t = String(w).trim().toLowerCase();
  if (t in KNOEPFE) return KNOEPFE[t];
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 16 ? n : null;
};
const CODE = /^[A-Za-z0-9]{1,24}$/;

const adressen = (port) => {
  const out = [];
  for (const addrs of Object.values(os.networkInterfaces())) for (const a of addrs || []) {
    if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(`http://${a.address}:${port}/`);
  }
  return out;
};


// Eingabe eines Controllers prüfen und auf bekannte Werte kürzen
function eingabeAus(body) {
  if (!body || typeof body !== 'object') return null;
  const tasten = (Array.isArray(body.tasten) ? body.tasten : []).filter((c) => typeof c === 'string' && CODE.test(c)).slice(0, 16);
  const pads = (Array.isArray(body.pads) ? body.pads : []).slice(0, 4).map((p) => ({
    spieler: p?.spieler === 2 || p?.spieler === '2' ? 1 : 0,
    knoepfe: [...new Set((Array.isArray(p?.knoepfe) ? p.knoepfe : []).map(knopfNr).filter((n) => n != null))],
  }));
  return { tasten, pads };
}

function createFernsteuerung({ onEingabe = () => {}, onStatus = () => {}, seitePfad = path.join(__dirname, 'fernsteuerung.html') } = {}) {
  let seite = null;
  const ladeSeite = () => (seite ??= fs.readFileSync(seitePfad, 'utf8'));
  let server = null, port = 0, err = '', info = {}, wache = null;
  const controller = new Map();   // id → { id, name, ip, seq, zuletzt, tasten, pads, dauerhaft }
  const timer = new Map();        // Knopf-Antippen per /knopf: id → Timeout

  const liste = () => [...controller.values()].map(({ id, name, ip, zuletzt, pads }) => ({ id, name, ip, zuletzt, spieler: [...new Set(pads.map((p) => p.spieler + 1))] }));
  const status = () => ({ on: !!server, port, err, controller: liste(), adressen: server ? adressen(port) : [] });
  const melden = () => onStatus(status());

  const senden = (c) => onEingabe({ id: c.id, tasten: c.tasten, pads: c.pads });
  const entfernen = (id) => {
    if (!controller.has(id)) return;
    controller.delete(id);
    onEingabe({ id, tasten: [], pads: [] });
    melden();
  };

  // Ein Controller meldet seinen ganzen Stand. Ältere Meldungen (seq) werden übergangen,
  // damit sich überholende Anfragen keinen losgelassenen Knopf wieder drücken.
  const setze = (id, e, { name = '', ip = '', seq = null, dauerhaft = false } = {}) => {
    let c = controller.get(id), neu = false;
    if (!c) { c = { id, name, ip, seq: -1, zuletzt: 0, tasten: [], pads: [], dauerhaft }; controller.set(id, c); neu = true; }
    if (seq != null) { if (seq <= c.seq) return false; c.seq = seq; }
    if (name) c.name = name;
    c.ip = ip || c.ip;
    c.zuletzt = Date.now();
    const vorher = JSON.stringify([c.tasten, c.pads]);
    c.tasten = e.tasten; c.pads = e.pads;
    if (JSON.stringify([c.tasten, c.pads]) !== vorher) senden(c);
    if (neu) melden();
    return true;
  };

  // Knöpfe von /knopf: einer je Spieler und Absender, damit Antippen und Halten zusammenpassen
  const knopf = (ip, spieler, nr, an, dauer) => {
    const id = `knopf:${ip}:${spieler}`;
    const c = controller.get(id);
    const knoepfe = new Set(c?.pads[0]?.knoepfe || []);
    if (an) knoepfe.add(nr); else knoepfe.delete(nr);
    setze(id, { tasten: [], pads: [{ spieler, knoepfe: [...knoepfe] }] }, { name: 'HTTP-Knopf', ip, dauerhaft: true });
    if (!knoepfe.size) entfernen(id);
    if (dauer != null) {
      const k = `${id}:${nr}`;
      clearTimeout(timer.get(k));
      timer.set(k, setTimeout(() => { timer.delete(k); knopf(ip, spieler, nr, false); }, dauer));
    }
  };

  const antwort = (res, code, body, typ = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': typ, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const stand = () => ({ ok: true, app: 'matrix-games', ...info });

  const handler = (req, res) => {
    const url = new URL(req.url, 'http://x');
    const teile = url.pathname.split('/').filter(Boolean);
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (req.method === 'OPTIONS') return antwort(res, 204, '');
    if (!teile.length || teile[0] === 'index.html') {
      if (req.method !== 'GET') return antwort(res, 405, { ok: false, fehler: 'Nur GET' });
      try { return antwort(res, 200, ladeSeite(), 'text/html; charset=utf-8'); } catch (e) { return antwort(res, 500, { ok: false, fehler: e.message }); }
    }
    if (teile[0] === 'status' && teile.length === 1) return antwort(res, 200, stand());
    if (teile[0] === 'eingabe' && teile.length === 1) {
      if (req.method !== 'POST') return antwort(res, 405, { ok: false, fehler: 'Nur POST' });
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        let j = null;
        try { j = JSON.parse(body); } catch {}
        const e = eingabeAus(j);
        const id = typeof j?.id === 'string' && /^[\w-]{1,64}$/.test(j.id) ? j.id : null;
        if (!e || !id) return antwort(res, 400, { ok: false, fehler: 'Erwartet {"id":"…","seq":1,"tasten":[],"pads":[{"spieler":1,"knoepfe":[0]}]}' });
        if (j.weg) entfernen(id);
        else setze(id, e, { name: typeof j.name === 'string' ? j.name.slice(0, 40) : '', ip, seq: Number.isFinite(j.seq) ? j.seq : null });
        antwort(res, 200, stand());
      });
      return;
    }
    if (teile[0] === 'knopf' && (teile.length === 2 || teile.length === 3)) {
      const nr = knopfNr(teile[1]);
      if (nr == null) return antwort(res, 400, { ok: false, fehler: `Unbekannter Knopf „${teile[1]}“. Erlaubt: ${Object.keys(KNOEPFE).join(', ')} oder 0–16` });
      const spieler = url.searchParams.get('spieler') === '2' ? 1 : 0;
      const wie = teile[2];
      if (wie && wie !== 'an' && wie !== 'aus') return antwort(res, 400, { ok: false, fehler: 'Nach dem Knopf nur /an oder /aus' });
      if (wie === 'aus') knopf(ip, spieler, nr, false);
      else if (wie === 'an') knopf(ip, spieler, nr, true);
      else knopf(ip, spieler, nr, true, Math.max(30, Math.min(5000, +url.searchParams.get('dauer') || 120)));
      return antwort(res, 200, stand());
    }
    antwort(res, 404, { ok: false, fehler: 'Unbekannter Pfad', beispiel: ['/', '/status', '/knopf/a', '/knopf/rechts/an', '/knopf/start?spieler=2'] });
  };

  const stop = () => new Promise((resolve) => {
    clearInterval(wache); wache = null;
    for (const t of timer.values()) clearTimeout(t);
    timer.clear();
    for (const id of [...controller.keys()]) entfernen(id);
    if (!server) return resolve();
    const s = server;
    server = null;
    s.close(() => resolve());
    s.closeAllConnections?.();
  });

  // Controller, die sich nicht mehr melden, lassen alles los. Gehaltene /knopf-Knöpfe bleiben.
  const pruefen = () => {
    const jetzt = Date.now();
    for (const c of [...controller.values()]) if (!c.dauerhaft && jetzt - c.zuletzt > TIMEOUT_MS) entfernen(c.id);
  };

  // cfg: { on, port, ...info } – info (gewähltes Spiel) steht in jeder Antwort an die Controller
  const anwenden = async ({ on = false, port: p = STANDARD_PORT, ...rest } = {}) => {
    info = rest;
    p = Math.max(1, Math.min(65535, p | 0)) || STANDARD_PORT;
    if (!on) { await stop(); err = ''; port = p; melden(); return status(); }
    if (server && port === p) return status();
    await stop();
    port = p; err = '';
    await new Promise((resolve) => {
      const s = http.createServer(handler);
      s.keepAliveTimeout = 10000;
      s.once('error', (e) => { err = e.code === 'EADDRINUSE' ? `Port ${p} ist schon belegt` : e.message; resolve(); });
      s.listen(p, '0.0.0.0', () => { server = s; resolve(); });
    });
    if (server) wache = setInterval(pruefen, 250);
    melden();
    return status();
  };

  return { anwenden, status, stop, pruefen };
}

function register(ipcMain, getWin) {
  const win = () => { const w = getWin(); return w && !w.isDestroyed() ? w : null; };
  const f = createFernsteuerung({
    onEingabe: (e) => win()?.webContents.send('fernsteuerung-eingabe', e),
    onStatus: (st) => win()?.webContents.send('fernsteuerung-status', st),
  });
  ipcMain.handle('fernsteuerung', (_e, cfg) => f.anwenden(cfg));
  return f;
}

module.exports = { register, createFernsteuerung, eingabeAus, knopfNr, STANDARD_PORT, TIMEOUT_MS };
