// Worlds and levels. Levels are generated from a fixed seed so every
// player gets the same puzzle for "World 3 · Level 4".

import { F } from './fraction.js';
import { side, equation } from './engine.js';

export const LEVELS_PER_WORLD = 8;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => {
  let n = 0;
  while (n === 0) n = int(r, lo, hi);
  return n;
};
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// side helpers
const lin = (a, b, kFirst = false) => side(1, a, b, 0, kFirst); // a·v + b
const K = (n) => side(1, 0, n); // constant
const P = (o, b, c = 0) => side(o, 1, b, c); // o(v + b) + c
const over = (q) => F(1, q); // coefficient for v/q

export const WORLDS = [
  {
    name: 'Add & Subtract',
    icon: '➕',
    color: '#19c3a6',
    tray: 3,
    intro: {
      title: 'Undo the + and −',
      body: `<p>Your job: get <b>x</b> all by itself.</p>
        <p>If something is <b>added</b> to x, <b>subtract</b> it. If something is <b>subtracted</b>, <b>add</b> it.</p>
        <div class="demo"><div>x + 5 = 12</div><div class="demo-op">− 5 &nbsp;&nbsp;&nbsp;&nbsp; − 5</div><div>x = 7</div></div>
        <p>Whatever you do, you do to <b>both sides</b>. That keeps the scale balanced.</p>`,
    },
    gen(r, i) {
      const x = int(r, 1, 12);
      const b = int(r, 1, 9);
      switch (i) {
        case 0:
        case 1: return { eq: equation(lin(1, b), K(x + b)), x };
        case 2:
        case 3: { const y = int(r, b + 1, b + 12); return { eq: equation(lin(1, -b), K(y - b)), x: y }; }
        case 4: return { eq: equation(lin(1, b, true), K(x + b)), x };
        case 5: { const y = int(r, b + 1, b + 12); return { eq: equation(K(y - b), lin(1, -b)), x: y }; }
        case 6: return { eq: equation(K(x + b), lin(1, b, true)), x };
        default: { const B = int(r, 11, 25); const y = int(r, B + 1, B + 20); return { eq: equation(lin(1, -B), K(y - B)), x: y }; }
      }
    },
  },
  {
    name: 'Multiply & Divide',
    icon: '✖️',
    color: '#ff4f8b',
    tray: 3,
    intro: {
      title: 'Undo the × and ÷',
      body: `<p><b>3x</b> means 3 <b>times</b> x. To undo times, <b>divide</b>.</p>
        <div class="demo"><div>3x = 12</div><div class="demo-op">÷ 3 &nbsp;&nbsp;&nbsp;&nbsp; ÷ 3</div><div>x = 4</div></div>
        <p><b>x/4</b> means x <b>divided</b> by 4. To undo divide, <b>multiply</b>.</p>`,
    },
    gen(r, i) {
      const a = int(r, 2, 9);
      const x = int(r, 1, 10);
      const q = int(r, 2, 6);
      switch (i) {
        case 0:
        case 1: return { eq: equation(lin(a, 0), K(a * x)), x };
        case 2:
        case 3: return { eq: equation(lin(over(q), 0), K(x)), x: q * x };
        case 4: return { eq: equation(K(a * x), lin(a, 0)), x };
        case 5: return { eq: equation(K(x), lin(over(q), 0)), x: q * x };
        case 6: { const A = int(r, 6, 12); const y = int(r, 4, 12); return { eq: equation(lin(A, 0), K(A * y)), x: y }; }
        default: { const Q = int(r, 7, 10); return { eq: equation(lin(over(Q), 0), K(x)), x: Q * x }; }
      }
    },
  },
  {
    name: 'Two Steps',
    uses: [0, 1], // worlds whose skills this one builds on
    icon: '🪜',
    color: '#ffb000',
    tray: 4,
    intro: {
      title: 'Peel it like an onion',
      body: `<p>When x has two things stuck to it, undo them in <b>reverse order</b>: first the + or −, then the × or ÷.</p>
        <div class="demo"><div>2x + 3 = 11</div><div class="demo-op">− 3 &nbsp;&nbsp;&nbsp;&nbsp; − 3</div><div>2x = 8</div><div class="demo-op">÷ 2 &nbsp;&nbsp;&nbsp;&nbsp; ÷ 2</div><div>x = 4</div></div>`,
    },
    gen(r, i) {
      const a = int(r, 2, 6);
      const b = int(r, 1, 9);
      const x = int(r, 1, 10);
      const q = int(r, 2, 5);
      const v = i >= 4 ? pick(r, ['x', 'y', 'n', 'm']) : 'x';
      switch (i) {
        case 0: return { eq: equation(lin(a, b), K(a * x + b), v), x };
        case 1: return { eq: equation(lin(a, -b), K(a * x - b), v), x };
        case 2: return { eq: equation(lin(over(q), b), K(x + b), v), x: q * x };
        case 3: return { eq: equation(K(a * x + b), lin(a, b), v), x };
        case 4: return { eq: equation(lin(a, b, true), K(a * x + b), v), x };
        case 5: return { eq: equation(lin(over(q), -b), K(x - b), v), x: q * x };
        case 6: { const A = int(r, 3, 9); const y = int(r, 2, 12); return { eq: equation(lin(A, -b), K(A * y - b), v), x: y }; }
        default: return { eq: equation(K(x + b), lin(over(q), b), v), x: q * x };
      }
    },
  },
  {
    name: 'Negatives',
    uses: [2], // worlds whose skills this one builds on
    icon: '➖',
    color: '#7b61ff',
    tray: 4,
    intro: {
      title: 'Watch the signs',
      body: `<p>A minus sign in front of x means x is multiplied by <b>−1</b>.</p>
        <div class="demo"><div>−x = 6</div><div class="demo-op">× (−1) &nbsp;&nbsp; × (−1)</div><div>x = −6</div></div>
        <p>In <b>9 − 2x</b>, the 2x is being <b>subtracted</b>, so x is really multiplied by <b>−2</b>.</p>`,
    },
    gen(r, i) {
      const a = int(r, 2, 6);
      const b = int(r, 1, 9);
      const x = nz(r, -9, 9);
      const v = pick(r, ['x', 'y', 'n', 'k']);
      switch (i) {
        case 0: return { eq: equation(lin(-1, 0), K(-x), v), x };
        case 1: return { eq: equation(lin(-1, b), K(-x + b), v), x };
        case 2: return { eq: equation(lin(-1, b, true), K(b - x), v), x };
        case 3: { const y = nz(r, -9, -1); return { eq: equation(lin(a, b), K(a * y + b), v), x: y }; }
        case 4: return { eq: equation(lin(-a, 0), K(-a * x), v), x };
        case 5: return { eq: equation(lin(-a, b, true), K(b - a * x), v), x };
        case 6: return { eq: equation(lin(-a, -b), K(-a * x - b), v), x };
        default: return { eq: equation(K(b - a * x), lin(-a, b, true), v), x };
      }
    },
  },
  {
    name: 'Both Sides',
    uses: [2, 3], // worlds whose skills this one builds on
    icon: '⚖️',
    color: '#00a6fb',
    tray: 5,
    intro: {
      title: 'x on both sides',
      body: `<p>First gather all the x's on <b>one side</b> by adding or subtracting an x term from both sides.</p>
        <div class="demo"><div>5x + 2 = 3x + 10</div><div class="demo-op">− 3x &nbsp;&nbsp;&nbsp;&nbsp; − 3x</div><div>2x + 2 = 10</div></div>
        <p>Then it's a two-step puzzle you already know!</p>`,
    },
    gen(r, i) {
      const c = int(r, 1, 4);
      const a = c + int(r, 1, 4);
      const x = nz(r, -5, 9);
      const b = int(r, 1, 9);
      const v = pick(r, ['x', 'y', 'n', 'm', 't']);
      switch (i) {
        case 0: return { eq: equation(lin(a, 0), lin(c, (a - c) * x), v), x };
        case 1: return { eq: equation(lin(a, b), lin(c, (a - c) * x + b), v), x };
        case 2: return { eq: equation(lin(a, -b), lin(c, (a - c) * x - b), v), x };
        case 3: return { eq: equation(lin(c, (a - c) * x + b), lin(a, b), v), x };
        case 4: return { eq: equation(lin(a, b), lin(-c, (a + c) * x + b, true), v), x };
        case 5: return { eq: equation(lin(1, b), lin(-c, (1 + c) * x + b, true), v), x };
        case 6: return { eq: equation(lin(a, -b), lin(c, (a - c) * x - b), v), x };
        default: return { eq: equation(lin(-c, b, true), lin(a, b - (a + c) * x), v), x };
      }
    },
  },
  {
    name: 'Parentheses',
    uses: [2, 4], // worlds whose skills this one builds on
    icon: '🫧',
    color: '#ff6b35',
    tray: 5,
    intro: {
      title: 'Break the bubble',
      body: `<p><b>3(x + 2)</b> means 3 times the <b>whole</b> (x + 2). Two ways in:</p>
        <div class="demo"><div>3(x + 2) = 21</div><div class="demo-op">÷ 3 &nbsp;&nbsp;&nbsp;&nbsp; ÷ 3</div><div>x + 2 = 7</div></div>
        <p>…or use <b>Distribute</b> to turn it into 3x + 6.</p>
        <p>Careful: subtracting 2 first doesn't work – the 2 is trapped inside the bubble.</p>`,
    },
    gen(r, i) {
      const a = int(r, 2, 6);
      const b = int(r, 1, 7);
      const x = int(r, 1, 9);
      const d = int(r, 1, 9);
      const v = pick(r, ['x', 'y', 'n', 'm', 't']);
      switch (i) {
        case 0: return { eq: equation(P(a, b), K(a * (x + b)), v), x };
        case 1: return { eq: equation(P(a, -b), K(a * (x - b)), v), x };
        case 2: return { eq: equation(P(a, b, d), K(a * (x + b) + d), v), x };
        case 3: return { eq: equation(K(a * (x - b)), P(a, -b), v), x };
        case 4: { const A = int(r, 3, 6); const c = int(r, 1, A - 1); return { eq: equation(P(A, b), lin(c, A * (x + b) - c * x), v), x }; }
        case 5: return { eq: equation(P(a, -b, -d), K(a * (x - b) - d), v), x };
        case 6: return { eq: equation(P(-a, b), K(-a * (x + b)), v), x };
        default: {
          const A = int(r, 3, 6);
          for (let t = 0; t < 30; t++) {
            const c = int(r, 1, A - 1);
            const total = A * (x + b);
            if (total % c === 0) return { eq: equation(P(A, b), P(c, total / c - x), v), x };
          }
          return { eq: equation(P(A, b), lin(1, A * (x + b) - x), v), x };
        }
      }
    },
  },
];

export function getLevel(w, i) {
  const rng = mulberry32(1013 * (w + 1) + 7919 * (i + 1));
  const { eq, x } = WORLDS[w].gen(rng, i);
  return { eq, answer: F(x) };
}

export function levelRng(w, i, salt) {
  return mulberry32(31 * (w + 1) + 131 * (i + 1) + 977 * salt);
}
