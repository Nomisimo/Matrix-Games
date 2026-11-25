// Ton: „Split Audio Channels“ legt den Soundtrack nach links und die Effekte nach rechts
const test = require("node:test");
const assert = require("node:assert");

// Minimaler Web-Audio-Ersatz, der die Verbindungen der Knoten mitschreibt
class Knoten { constructor(art) { this.art = art; this.ziele = []; } connect(z) { this.ziele.push(z); return z; } }
class FakeContext {
  constructor() { this.destination = new Knoten("destination"); this.currentTime = 0; this.state = "running"; this.quellen = []; }
  createGain() { const k = new Knoten("gain"); k.gain = { value: 1 }; return k; }
  createStereoPanner() { const k = new Knoten("pan"); k.pan = { value: 0 }; return k; }
  createBuffer(_c, n) { return { duration: n / 22050, copyToChannel() {} }; }
  createBufferSource() { const k = new Knoten("src"); k.playbackRate = { value: 1, setValueAtTime() {} }; k.start = () => {}; k.stop = () => {}; this.quellen.push(k); return k; }
  setSinkId() { return Promise.resolve(); }
  close() {}
}

test("Split Audio Channels: Musik links, Effekte rechts, aus = Stereo", async () => {
  let ctx;
  globalThis.AudioContext = class extends FakeContext { constructor() { super(); ctx = this; } };
  const { createTon } = await import("../src/renderer/spiele/ton.js");
  const ton = createTon();
  ton.play("mario", "_music");
  ton.play("mario", "jump");
  const [musik, effekt] = ctx.quellen;
  const pan = (src) => src.ziele[0].ziele[0];   // Quelle → Lautstärke → Panner
  assert.strictEqual(pan(musik).art, "pan");
  assert.strictEqual(pan(effekt).art, "pan");
  assert.strictEqual(pan(musik).pan.value, 0);
  assert.strictEqual(pan(effekt).pan.value, 0);
  ton.setGetrennt(true);
  assert.strictEqual(pan(musik).pan.value, -1);
  assert.strictEqual(pan(effekt).pan.value, 1);
  ton.setGetrennt(false);
  assert.strictEqual(pan(musik).pan.value, 0);
  assert.strictEqual(pan(effekt).pan.value, 0);
  // vor dem ersten Ton gesetzt, gilt beim Anlegen des Kontexts
  ton.close();
  const ton2 = createTon();
  ton2.setGetrennt(true);
  ton2.play("snake", "eat");
  assert.strictEqual(pan(ctx.quellen[0]).pan.value, 1);
});
