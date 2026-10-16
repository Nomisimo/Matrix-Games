// Endpoint für einen Drehsensor: meldet per HTTP, wie die LED-Wand gerade steht.
// Wird in den App-Einstellungen eingeschaltet und lauscht dann im lokalen Netz.
//
//   GET  /ausrichtung                → aktueller Stand als JSON
//   GET  /ausrichtung?lage=hochkant  → Lage melden (auch ?winkel=90)
//   GET  /ausrichtung/rechts         → dasselbe als Pfad, für ganz einfache Sensoren
//   POST /ausrichtung                → Body {"lage":"links"} oder {"winkel":270} oder nur „quer“
//
// Lagen: quer, rechts (im Uhrzeigersinn gedreht), links (gegen den Uhrzeigersinn),
// hochkant (Richtung unbekannt), kopf. Winkel in Grad werden auf 90° gerundet.
// Kein Electron-Import, damit der Server im Test unter reinem Node läuft.
const http = require('http');
const os = require('os');

const STANDARD_PORT = 8787;
const LAGEN = { quer: 'quer', landscape: 'quer', normal: 'quer', rechts: 'rechts', cw: 'rechts', right: 'rechts', links: 'links', ccw: 'links', left: 'links', hochkant: 'hochkant', portrait: 'hochkant', hoch: 'hochkant', kopf: 'kopf', upsidedown: 'kopf' };

// Gleiche Regeln wie lageAus() in src/shared/spiele/drehen.js (dort ESM, hier CommonJS)
function lageAus(wert) {
  if (wert == null) return null;
  if (typeof wert === 'object') return lageAus(wert.lage ?? wert.ausrichtung ?? wert.orientation ?? wert.winkel ?? wert.angle);
  const t = String(wert).trim().toLowerCase().replace(/[\s_]+/g, '');
  if (!t) return null;
  if (LAGEN[t.replace(/-/g, '')]) return LAGEN[t.replace(/-/g, '')];
  const n = Number(t.replace(/°$/, ''));
  if (!Number.isFinite(n)) return null;
  return ['quer', 'rechts', 'kopf', 'links'][((Math.round(n / 90) % 4) + 4) % 4];
}

const adressen = (port) => {
  const out = [];
  for (const addrs of Object.values(os.networkInterfaces())) for (const a of addrs || []) {
    if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push(`http://${a.address}:${port}/ausrichtung`);
  }
  return out;
};

function createDrehsensor(onStatus = () => {}) {
  let server = null, port = 0, err = '', lage = null, zeit = 0, quelle = '', info = {};

  const status = () => ({ on: !!server, port, err, lage, zeit, quelle, adressen: server ? adressen(port) : [] });
  const melden = () => onStatus(status());

  const antwort = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(JSON.stringify(body));
  };
  const stand = () => ({ ok: true, lage, gemeldet: zeit ? new Date(zeit).toISOString() : null, ...info });

  const setze = (wert, req) => {
    const l = lageAus(wert);
    if (!l) return false;
    lage = l; zeit = Date.now(); quelle = req.socket.remoteAddress || '';
    melden();
    return true;
  };

  const handler = (req, res) => {
    const url = new URL(req.url, 'http://x');
    const teile = url.pathname.split('/').filter(Boolean);
    if (req.method === 'OPTIONS') return antwort(res, 204, {});
    if (teile[0] !== 'ausrichtung' || teile.length > 2) {
      return antwort(res, 404, { ok: false, fehler: 'Unbekannter Pfad. Benutze /ausrichtung', beispiel: ['/ausrichtung?lage=quer', '/ausrichtung?winkel=90', '/ausrichtung/links'] });
    }
    const ungueltig = (w) => antwort(res, 400, { ok: false, fehler: `Unbekannte Lage „${w}“. Erlaubt: quer, rechts, links, hochkant, kopf oder ein Winkel in Grad` });
    if (req.method === 'GET') {
      const w = teile[1] ?? url.searchParams.get('lage') ?? url.searchParams.get('winkel') ?? url.searchParams.get('angle') ?? url.searchParams.get('orientation');
      if (w == null) return antwort(res, 200, stand());
      return setze(w, req) ? antwort(res, 200, stand()) : ungueltig(w);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let w = teile[1] ?? body;
        if (!teile[1]) { try { w = JSON.parse(body); } catch {} }
        return setze(w, req) ? antwort(res, 200, stand()) : ungueltig(typeof w === 'string' ? w : JSON.stringify(w));
      });
      return;
    }
    antwort(res, 405, { ok: false, fehler: 'Nur GET oder POST' });
  };

  const stop = () => new Promise((resolve) => {
    if (!server) return resolve();
    const s = server;
    server = null;
    s.close(() => resolve());
    s.closeAllConnections?.();
  });

  // cfg: { on, port, ...info } – info (z. B. das gewählte Spiel und welche Lage es braucht) steht in der Antwort
  const anwenden = async ({ on = false, port: p = STANDARD_PORT, ...rest } = {}) => {
    info = rest;
    p = Math.max(1, Math.min(65535, p | 0)) || STANDARD_PORT;
    if (!on) { await stop(); lage = null; zeit = 0; err = ''; port = p; melden(); return status(); }
    if (server && port === p) return status();
    await stop();
    port = p; err = '';
    await new Promise((resolve) => {
      const s = http.createServer(handler);
      s.once('error', (e) => { err = e.code === 'EADDRINUSE' ? `Port ${p} ist schon belegt` : e.message; resolve(); });
      s.listen(p, '0.0.0.0', () => { server = s; resolve(); });
    });
    melden();
    return status();
  };

  return { anwenden, status, stop };
}

function register(ipcMain, getWin) {
  const win = () => { const w = getWin(); return w && !w.isDestroyed() ? w : null; };
  const d = createDrehsensor((st) => win()?.webContents.send('drehsensor-status', st));
  ipcMain.handle('drehsensor', (_e, cfg) => d.anwenden(cfg));
  return d;
}

module.exports = { register, createDrehsensor, lageAus, STANDARD_PORT };
