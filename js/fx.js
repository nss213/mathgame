// Confetti and other visual juice.

const canvas = document.getElementById('confetti');
const g = canvas.getContext('2d');
const COLORS = ['#ffc83d', '#ff4f8b', '#19c3a6', '#00a6fb', '#ff7a1a', '#7b61ff', '#ffffff'];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let parts = [];
let running = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

export function confetti(x = innerWidth / 2, y = innerHeight / 2, count = 120) {
  if (reduced) count = Math.min(count, 20);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 9;
    parts.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 6,
      r: 4 + Math.random() * 6,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      life: 90 + Math.random() * 60,
      shape: Math.random() < 0.3 ? 'circle' : 'rect',
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

function tick() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += 0.28;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    g.save();
    g.globalAlpha = Math.min(1, p.life / 30);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.c;
    if (p.shape === 'circle') {
      g.beginPath();
      g.arc(0, 0, p.r / 2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    }
    g.restore();
  }
  if (parts.length) requestAnimationFrame(tick);
  else {
    running = false;
    g.clearRect(0, 0, innerWidth, innerHeight);
  }
}

// Little "+1"-style floating text.
export function floatText(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = 'float-text ' + cls;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// Restart a CSS animation class on an element.
export function pulse(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 150) : ms));
