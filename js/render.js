// Turns equations into HTML.

import { opHTML } from './engine.js';

const MINUS = '−';

function num(f) {
  const A = f.abs();
  if (A.isInt()) return `<span class="num">${A.n}</span>`;
  return `<span class="frac"><span class="top">${A.n}</span><span class="bot">${A.d}</span></span>`;
}

function varTerm(a, v) {
  const A = a.abs();
  const V = `<i class="var">${v}</i>`;
  if (A.isOne()) return V;
  if (A.isInt()) return `<span class="num">${A.n}</span>${V}`;
  const top = A.n === 1 ? V : `<span class="num">${A.n}</span>${V}`;
  return `<span class="frac"><span class="top">${top}</span><span class="bot">${A.d}</span></span>`;
}

function joinTerms(terms) {
  if (!terms.length) return '<span class="term"><span class="num">0</span></span>';
  return terms
    .map((t, i) => {
      const sign =
        i === 0
          ? t.neg ? `<span class="sign lead">${MINUS}</span>` : ''
          : `<span class="sign">${t.neg ? MINUS : '+'}</span>`;
      return `<span class="term" data-role="${t.role}">${sign}${t.html}</span>`;
    })
    .join('');
}

function innerTerms(s, v) {
  const terms = [];
  if (!s.a.isZero()) terms.push({ neg: s.a.sign() < 0, html: varTerm(s.a, v), role: 'x' });
  if (!s.b.isZero()) terms.push({ neg: s.b.sign() < 0, html: num(s.b), role: 'k' });
  if (s.kFirst) terms.reverse();
  return terms;
}

export function sideHTML(s, v) {
  if (s.o.isOne()) return joinTerms(innerTerms(s, v));
  const lead = s.o.sign() < 0 ? `<span class="sign lead">${MINUS}</span>` : '';
  const coef = s.o.abs().isOne() ? '' : num(s.o);
  const inner = joinTerms(innerTerms(s, v));
  let html = `<span class="term" data-role="outer">${lead}${coef}<span class="paren">(</span>${inner}<span class="paren">)</span></span>`;
  if (!s.c.isZero()) {
    html += `<span class="term" data-role="oc"><span class="sign">${s.c.sign() < 0 ? MINUS : '+'}</span>${num(s.c)}</span>`;
  }
  return html;
}

const termCount = (s) => (s.o.isOne() ? (s.a.isZero() ? 0 : 1) + (s.b.isZero() ? 0 : 1) : 1 + (s.c.isZero() ? 0 : 1));

// A side with the pending operation written next to it, e.g. "(2x + 3) ÷ 2".
function sideWithOp(s, op, v) {
  const label = opHTML(op, v);
  const pend = `<span class="pending">${label.replace(/^([+−×÷]) /, '<span class="sign">$1</span>')}</span>`;
  if (op.t === 'mul' && termCount(s) > 1) {
    return `<span class="paren">(</span>${sideHTML(s, v)}<span class="paren">)</span>${pend}`;
  }
  return sideHTML(s, v) + pend;
}

export function equationHTML(eq, pendingOp = null) {
  const v = eq.v;
  const L = pendingOp && pendingOp.t !== 'dist' ? sideWithOp(eq.L, pendingOp, v) : sideHTML(eq.L, v);
  const R = pendingOp && pendingOp.t !== 'dist' ? sideWithOp(eq.R, pendingOp, v) : sideHTML(eq.R, v);
  return `<span class="side" data-side="L">${L}</span><span class="equals">=</span><span class="side" data-side="R">${R}</span>`;
}

// "2(5) + 3 = 13" style substitution line for the win screen.
export function substitutionHTML(eq, value) {
  const shown = value.sign() < 0 || !value.isInt() ? `(${value})` : `${value}`;
  const sub = `<span class="subv">${shown}</span>`;
  const swap = (s) => sideHTML(s, '§').replace(/<span class="num">(\d+)<\/span><i class="var">§<\/i>/g, '<span class="num">$1</span>·<i class="var">§</i>').replace(/<i class="var">§<\/i>/g, sub);
  return `<span class="side">${swap(eq.L)}</span><span class="equals">=</span><span class="side">${swap(eq.R)}</span>`;
}
