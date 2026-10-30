import { test } from 'node:test';
import assert from 'node:assert/strict';
import { F } from '../js/fraction.js';
import {
  side, equation, applyOp, isSolved, solvedValue, solve, makeTray, opKey, opLabel, evalSide,
} from '../js/engine.js';
import { WORLDS, LEVELS_PER_WORLD, getLevel } from '../js/levels.js';

test('fractions reduce and keep sign in numerator', () => {
  const f = F(6, -8);
  assert.equal(f.n, -3);
  assert.equal(f.d, 4);
  assert.equal(F(1, 3).add(F(1, 6)).key(), '1/2');
  assert.equal(F(0, 5).n, 0);
});

test('x + 5 = 12 solves in one move', () => {
  const eq = equation(side(1, 1, 5), side(1, 0, 12));
  const sol = solve(eq);
  assert.equal(sol.par, 1);
  assert.equal(opLabel(sol.best[0]), '− 5');
  const done = applyOp(eq, sol.best[0]);
  assert.ok(isSolved(done));
  assert.equal(solvedValue(done).key(), '7');
});

test('subtracting inside parentheses is applied outside them', () => {
  const eq = equation(side(3, 1, 2), side(1, 0, 21));
  const after = applyOp(eq, { t: 'add', n: F(-2) });
  assert.equal(after.L.c.key(), '-2');
  assert.equal(after.L.o.key(), '3');
  assert.equal(after.R.b.key(), '19');
});

test('dividing first beats distributing for 3(x + 2) = 21', () => {
  const eq = equation(side(3, 1, 2), side(1, 0, 21));
  assert.equal(solve(eq).par, 2);
  assert.equal(opLabel(solve(eq).best[0]), '÷ 3');
  const d = applyOp(eq, { t: 'dist' });
  assert.equal(solve(d).par, 2);
});

test('every level is solvable, has the stated answer and a correct tile', () => {
  WORLDS.forEach((W, w) => {
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const { eq, answer } = getLevel(w, i);
      const name = `W${w + 1}-${i + 1}`;
      assert.ok(evalSide(eq.L, answer).eq(evalSide(eq.R, answer)), `${name} answer checks`);
      const sol = solve(eq);
      assert.ok(sol && sol.par >= 1, `${name} solvable`);
      assert.ok(sol.par <= 5, `${name} par ${sol.par} reasonable`);
      // Follow the hints to the end.
      let cur = eq;
      for (let s = 0; s < 8 && !isSolved(cur); s++) cur = applyOp(cur, solve(cur).best[0]);
      assert.ok(isSolved(cur), `${name} hints reach solution`);
      assert.equal(solvedValue(cur).key(), answer.key(), `${name} value`);
      // Tray contains a right answer and the requested number of tiles.
      for (let t = 0; t < 5; t++) {
        const tray = makeTray(eq, W.tray);
        const best = new Set(sol.best.filter((m) => m.t !== 'dist').map(opKey));
        assert.ok(tray.some((m) => best.has(opKey(m))), `${name} tray has a correct move`);
        assert.equal(tray.filter((m) => m.t !== 'dist').length, W.tray, `${name} tray size`);
        assert.equal(new Set(tray.map(opKey)).size, tray.length, `${name} tray unique`);
      }
    }
  });
});
