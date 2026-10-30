// Equation model, operations, solver and move-tray generation.
//
// Each side of an equation has the shape   o·(a·v + b) + c
// When o is 1 the parentheses disappear and c is folded into b, so a plain
// side like "3x + 5" is { o: 1, a: 3, b: 5, c: 0 }.

import { F } from './fraction.js';

const MINUS = '−';
export const varHTML = (v) => `<i class="var">${v}</i>`;

// ---------- sides & equations ----------

export function side(o, a, b, c = 0, kFirst = false) {
  return norm({ o: F(o), a: F(a), b: F(b), c: F(c), kFirst });
}

function norm(s) {
  s = { ...s };
  if (s.a.isZero() && !s.o.isOne()) {
    s.b = s.o.mul(s.b).add(s.c);
    s.o = F(1);
    s.c = F(0);
  }
  if (s.o.isOne() && !s.c.isZero()) {
    s.b = s.b.add(s.c);
    s.c = F(0);
  }
  return s;
}

export function distribute(s) {
  if (s.o.isOne()) return s;
  return norm({ ...s, a: s.o.mul(s.a), b: s.o.mul(s.b).add(s.c), o: F(1), c: F(0) });
}

export const equation = (L, R, v = 'x') => ({ L, R, v });

export const hasX = (s) => !s.a.isZero();
const hasParens = (s) => !s.o.isOne();
const isIsolated = (s) => s.o.isOne() && s.a.isOne() && s.b.isZero();
const isConst = (s) => s.a.isZero();

export function isSolved(eq) {
  return (isIsolated(eq.L) && isConst(eq.R)) || (isIsolated(eq.R) && isConst(eq.L));
}

export function solvedValue(eq) {
  return isIsolated(eq.L) ? eq.R.b : eq.L.b;
}

export function evalSide(s, x) {
  return s.o.mul(s.a.mul(x).add(s.b)).add(s.c);
}

const sideKey = (s) => `${s.o.key()},${s.a.key()},${s.b.key()},${s.c.key()}`;
export const eqKey = (eq) => `${sideKey(eq.L)}=${sideKey(eq.R)}`;

export function biggestNumber(eq) {
  let m = 0;
  for (const s of [eq.L, eq.R]) for (const f of [s.o, s.a, s.b, s.c]) m = Math.max(m, Math.abs(f.n), f.d);
  return m;
}

// ---------- operations ----------
// { t: 'add', n }   add n to both sides
// { t: 'addx', n }  add n·v to both sides
// { t: 'mul', n }   multiply both sides by n (÷k is mul by 1/k)
// { t: 'dist' }     distribute the parentheses (a rewrite of each side)

export const opKey = (op) => `${op.t}:${op.n ? op.n.key() : ''}`;

function applySide(s, op) {
  switch (op.t) {
    case 'add':
      return norm(s.o.isOne() ? { ...s, b: s.b.add(op.n) } : { ...s, c: s.c.add(op.n) });
    case 'addx': {
      const d = distribute(s);
      return norm({ ...d, a: d.a.add(op.n) });
    }
    case 'mul':
      return norm(
        s.o.isOne()
          ? { ...s, a: s.a.mul(op.n), b: s.b.mul(op.n) }
          : { ...s, o: s.o.mul(op.n), c: s.c.mul(op.n) },
      );
    case 'dist':
      return distribute(s);
  }
  throw new Error('unknown op ' + op.t);
}

export function applyOp(eq, op) {
  return { ...eq, L: applySide(eq.L, op), R: applySide(eq.R, op) };
}

const paren = (f) => (f.sign() < 0 ? `(${f})` : `${f}`);

export function opLabel(op, v = 'x') {
  switch (op.t) {
    case 'add':
      return `${op.n.sign() < 0 ? MINUS : '+'} ${op.n.abs()}`;
    case 'addx': {
      const A = op.n.abs();
      return `${op.n.sign() < 0 ? MINUS : '+'} ${A.isOne() ? '' : A}${v}`;
    }
    case 'mul': {
      const k = op.n;
      if (k.isInt()) return `× ${paren(k)}`;
      if (k.inv().isInt()) return `÷ ${paren(k.inv())}`;
      return `× ${paren(k)}`;
    }
    case 'dist':
      return 'Distribute';
  }
}

// Same as opLabel, with the variable styled.
export function opHTML(op, v = 'x') {
  const label = opLabel(op, v);
  return op.t === 'addx' ? label.replace(new RegExp(`${v}$`), varHTML(v)) : label;
}

// What kind of tile it is (for colouring).
export function opKind(op) {
  if (op.t === 'mul') return op.n.abs().isInt() ? 'mul' : 'div';
  if (op.t === 'add') return op.n.sign() < 0 ? 'sub' : 'add';
  return op.t;
}

// ---------- the "sensible next moves" from a position ----------
// Every move carries a short explanation used by the hint system and
// a `focus` describing which part of the equation it targets.

const signed = (f) => `${f.sign() < 0 ? MINUS : '+'} ${f.abs()}`;

function termText(a, v) {
  v = varHTML(v);
  const A = a.abs();
  const sign = a.sign() < 0 ? MINUS : '';
  if (A.isOne()) return sign + v;
  if (A.isInt()) return `${sign}${A}${v}`;
  if (A.n === 1) return `${sign}${v}/${A.d}`;
  return `${sign}${A.n}${v}/${A.d}`;
}

export function usefulMoves(eq) {
  const v = eq.v;
  const out = [];
  const add = (op) => {
    if (!out.some((m) => opKey(m) === opKey(op))) out.push(op);
  };
  for (const [name, s, other] of [['L', eq.L, eq.R], ['R', eq.R, eq.L]]) {
    if (!hasX(s)) continue;
    if (hasParens(s)) {
      if (!s.c.isZero()) {
        const op = { t: 'add', n: s.c.neg() };
        add({ ...op, focus: { side: name, role: 'oc' },
          why: `The <b>${signed(s.c)}</b> is outside the parentheses, so it comes off first. Do <b>${opHTML(op, v)}</b> to both sides.` });
      } else {
        const op = { t: 'mul', n: s.o.inv() };
        add({ ...op, focus: { side: name, role: 'outer' },
          why: `Everything inside the ( ) is multiplied by <b>${s.o}</b>. Undo that: <b>${opHTML(op, v)}</b> on both sides.` });
      }
      add({ t: 'dist', focus: { side: name, role: 'outer' },
        why: `Distribute: multiply <b>${s.o}</b> by each thing inside the ( ).` });
    } else if (!s.b.isZero()) {
      const op = { t: 'add', n: s.b.neg() };
      add({ ...op, focus: { side: name, role: 'k' },
        why: `${varHTML(v)} is stuck with <b>${signed(s.b)}</b>. The opposite of ${signed(s.b)} is <b>${opHTML(op, v)}</b> – do it to both sides.` });
    }
    if (hasX(other)) {
      const a = distribute(s).a;
      const op = { t: 'addx', n: a.neg() };
      add({ ...op, focus: { side: name, role: 'x' },
        why: `There are ${varHTML(v)}'s on both sides. Clear <b>${termText(a, v)}</b> from this side by doing <b>${opHTML(op, v)}</b> to both sides.` });
    } else if (!hasParens(s) && s.b.isZero() && !s.a.isOne()) {
      const op = { t: 'mul', n: s.a.inv() };
      let why;
      if (s.a.eq(-1)) why = `<b>${MINUS}</b>${varHTML(v)} means <b>${MINUS}1 ×</b> ${varHTML(v)}. Multiply both sides by <b>${MINUS}1</b> to flip the sign.`;
      else if (s.a.isInt()) why = `${varHTML(v)} is multiplied by <b>${s.a}</b>. The opposite of × ${paren(s.a)} is <b>${opHTML(op, v)}</b> – do it to both sides.`;
      else if (s.a.inv().isInt()) why = `${varHTML(v)} is divided by <b>${s.a.inv()}</b>. The opposite of ÷ ${paren(s.a.inv())} is <b>${opHTML(op, v)}</b> – do it to both sides.`;
      else why = `${varHTML(v)} is multiplied by <b>${s.a}</b>. Multiply both sides by the flip, <b>${s.a.inv()}</b>.`;
      add({ ...op, focus: { side: name, role: 'x' }, why });
    }
  }
  return out;
}

// ---------- solver ----------
// Breadth-first search over the sensible moves.
// Returns { par, best: [first moves that achieve par] } or null.

export function solve(eq, maxDepth = 6) {
  if (isSolved(eq)) return { par: 0, best: [] };
  let layer = usefulMoves(eq).map((m) => ({ eq: applyOp(eq, m), first: m }));
  const seen = new Set();
  for (let depth = 1; depth <= maxDepth && layer.length; depth++) {
    const winners = layer.filter((n) => isSolved(n.eq));
    if (winners.length) {
      const best = new Map(winners.map((n) => [opKey(n.first), n.first]));
      // Prefer inverse operations over "distribute" so hints teach undoing.
      return { par: depth, best: [...best.values()].sort((a, b) => (a.t === 'dist') - (b.t === 'dist')) };
    }
    const next = [];
    for (const n of layer) {
      for (const m of usefulMoves(n.eq)) {
        const ne = applyOp(n.eq, m);
        const k = eqKey(ne) + '#' + opKey(n.first);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ eq: ne, first: n.first });
      }
    }
    layer = next;
  }
  return null;
}

// ---------- tray of tiles ----------

function mistakesFor(op) {
  // The classic wrong turns a struggling student makes.
  switch (op.t) {
    case 'add':
      return [{ t: 'add', n: op.n.neg() }];
    case 'addx':
      return [{ t: 'addx', n: op.n.neg() }, { t: 'add', n: op.n }];
    case 'mul': {
      const k = op.n;
      const out = [{ t: 'mul', n: k.inv() }];
      if (k.inv().isInt()) out.push({ t: 'add', n: k.inv().abs().neg() });
      else if (k.isInt()) out.push({ t: 'add', n: k.abs() });
      return out;
    }
    default:
      return [];
  }
}

function trapsFor(eq) {
  // Tempting moves suggested by the shape of the equation.
  const out = [];
  for (const s of [eq.L, eq.R]) {
    if (!hasX(s)) continue;
    if (hasParens(s) && !s.b.isZero()) out.push({ t: 'add', n: s.b.neg() });
    if (!s.a.isOne() && !s.a.eq(-1)) {
      if (s.a.isInt()) out.push({ t: 'add', n: s.a.abs().neg() });
      if (!s.b.isZero() && s.o.isOne() && s.a.isInt()) out.push({ t: 'mul', n: s.a });
    }
  }
  return out;
}

export function makeTray(eq, size, rand = Math.random) {
  const sol = solve(eq);
  const pool = sol ? sol.best : usefulMoves(eq);
  const correct = pool.filter((m) => m.t !== 'dist');
  const dist = usefulMoves(eq).find((m) => m.t === 'dist');

  const tiles = [];
  const keys = new Set();
  const push = (op, extra = {}) => {
    if (!op || tiles.length >= size) return;
    if (op.n && (op.n.isZero() || (op.t === 'mul' && op.n.isOne()))) return;
    const k = opKey(op);
    if (keys.has(k)) return;
    keys.add(k);
    tiles.push({ ...op, ...extra });
  };

  // One or two right answers.
  const shuffled = shuffle([...correct], rand);
  push(shuffled[0]);
  if (size >= 5 && shuffled[1]) push(shuffled[1]);

  const distractors = shuffle(
    [...correct.flatMap(mistakesFor), ...trapsFor(eq)],
    rand,
  );
  for (const d of distractors) push(d);

  let tries = 0;
  while (tiles.length < size && tries++ < 50) {
    const r = 1 + Math.floor(rand() * 9);
    const roll = rand();
    if (roll < 0.5) push({ t: 'add', n: F(rand() < 0.5 ? r : -r) });
    else if (roll < 0.75) push({ t: 'mul', n: F(r === 1 ? 2 : r) });
    else push({ t: 'mul', n: F(1, r === 1 ? 2 : r) });
  }

  const out = shuffle(tiles, rand);
  if (dist) out.push({ ...dist });
  return out;
}

export function shuffle(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function starsFor(moves, par) {
  if (moves <= par) return 3;
  if (moves <= par + 2) return 2;
  return 1;
}
