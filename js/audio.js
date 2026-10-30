// Tiny synthesized sound effects (no audio files to download) + haptics.

let ctx = null;
let muted = false;

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const sfx = {
  tap() { tone(700, 0.05, 'triangle', 0.12); },
  pick() { tone(500, 0.08, 'triangle', 0.12, 0, 800); },
  drop() { tone(320, 0.14, 'sine', 0.22, 0, 640); },
  good(combo = 0) {
    const base = 660 * Math.pow(1.06, Math.min(combo, 8));
    tone(base, 0.12, 'triangle', 0.18);
    tone(base * 1.5, 0.2, 'triangle', 0.16, 0.08);
  },
  meh() { tone(260, 0.28, 'sine', 0.16, 0, 170); },
  undo() { tone(600, 0.1, 'triangle', 0.12, 0, 380); },
  star(i) { tone(880 * Math.pow(1.26, i), 0.3, 'triangle', 0.2); tone(1760 * Math.pow(1.26, i), 0.2, 'sine', 0.06, 0.02); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.08));
    tone(1568, 0.6, 'sine', 0.12, 0.34);
  },
  unlock() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.06, i * 0.06)); },
};

export function buzz(pattern) {
  if (!muted && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* not allowed */ }
  }
}
