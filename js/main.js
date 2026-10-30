import {
  applyOp, isSolved, solvedValue, solve, makeTray, opLabel, opHTML, varHTML, opKind, opKey, starsFor, evalSide, biggestNumber,
} from './engine.js';
import { equationHTML, substitutionHTML } from './render.js';
import { WORLDS, LEVELS_PER_WORLD, getLevel, levelRng } from './levels.js';
import { store } from './storage.js';
import { sfx, buzz, setMuted, isMuted } from './audio.js';
import { confetti, floatText, pulse, wait } from './fx.js';

const $ = (s) => document.querySelector(s);
const el = {
  eq: $('#equation'),
  dz: $('#dropzone'),
  beam: $('#beam'),
  tray: $('#tray'),
  history: $('#history'),
  coach: $('#coach'),
  coachText: $('#coach-text'),
  moves: $('#stat-moves'),
  par: $('#stat-par'),
  stars: $('#stat-stars'),
  undo: $('#btn-undo'),
  hint: $('#btn-hint'),
  modal: $('#modal'),
  modalCard: $('#modal-card'),
  finger: $('#finger'),
  toast: $('#toast'),
};

const PRAISE = ['Nice!', 'Great move!', 'Yes!', 'Smart!', 'Nailed it!', 'Good thinking!', 'Boom!'];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const lastLevel = (w, i) => i === LEVELS_PER_WORLD - 1 && w === WORLDS.length - 1;

let S = null; // current game state

// ---------- screens & navigation ----------

function show(name, push = true) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  if (name === 'home') $('#home-stars').textContent = store.totalStars();
  if (name === 'map') renderMap();
  if (push && name !== 'home') history.pushState({ screen: name }, '');
  hideFinger();
}

addEventListener('popstate', () => {
  closeModal();
  if ($('#screen-game').classList.contains('active')) show('map', false);
  else show('home', false);
});

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { sfx.tap(); show(b.dataset.go); }));
$('#btn-play').addEventListener('click', () => { sfx.tap(); show('map'); });
$('#btn-back').addEventListener('click', () => { sfx.tap(); show('map'); });

function syncSound() {
  setMuted(store.muted);
  $('#btn-sound').textContent = store.muted ? '🔇' : '🔊';
  $('#btn-home-sound').textContent = store.muted ? '🔇 Sound off' : '🔊 Sound on';
}
for (const b of ['#btn-sound', '#btn-home-sound']) {
  $(b).addEventListener('click', () => { store.muted = !store.muted; syncSound(); sfx.tap(); });
}
syncSound();

// ---------- map ----------

// Every level is open, so a student can jump to the skill they need.
// The map still points at a recommended next level, and a world's intro
// suggests warming up first if the skills it builds on haven't been tried.

const cleared = (w) => {
  let n = 0;
  for (let i = 0; i < LEVELS_PER_WORLD; i++) if (store.stars(w, i)) n++;
  return n;
};
const firstUnsolved = (w) => {
  for (let i = 0; i < LEVELS_PER_WORLD; i++) if (!store.stars(w, i)) return i;
  return 0;
};
const missingSkills = (w) => (WORLDS[w].uses || []).filter((u) => !cleared(u));

const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function renderMap() {
  $('#map-stars').textContent = store.totalStars();
  let current = null;
  $('#worlds').innerHTML = WORLDS.map((W, w) => {
    let got = 0;
    const lv = [];
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const st = store.stars(w, i);
      got += st;
      const isCurrent = !st && !current;
      if (isCurrent) current = `${w}-${i}`;
      lv.push(`<button class="lvl ${st ? 'done' : ''} ${isCurrent ? 'current' : ''}"
        data-w="${w}" data-i="${i}" aria-label="Level ${i + 1}${isCurrent ? ', next up' : ''}">
        ${isCurrent ? '<span class="lvl-next">NEXT</span>' : ''}
        <span class="lvl-num">${i + 1}</span>
        ${st ? `<span class="lvl-stars">${starStr(st)}</span>` : ''}
      </button>`);
    }
    const uses = (W.uses || []).map((u) => WORLDS[u].name).join(' + ');
    return `<div class="world" style="--wc:${W.color}">
      <div class="world-head">
        <span class="world-icon">${W.icon}</span>
        <div class="world-titles">
          <div class="world-num">World ${w + 1}</div>
          <div class="world-name">${W.name}</div>
          ${uses ? `<div class="world-uses">Uses ${uses}</div>` : ''}
        </div>
        <div class="world-stars">★ ${got}/${LEVELS_PER_WORLD * 3}</div>
      </div>
      <div class="levels">${lv.join('')}</div>
    </div>`;
  }).join('');
  $('#worlds').querySelectorAll('.lvl').forEach((b) =>
    b.addEventListener('click', () => { sfx.tap(); startLevel(+b.dataset.w, +b.dataset.i); }));
  const cur = $('#worlds .lvl.current');
  if (cur) requestAnimationFrame(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

// ---------- game ----------

function startLevel(w, i, { restart = false } = {}) {
  const { eq, answer } = getLevel(w, i);
  const sol = solve(eq);
  S = {
    w, i, eq0: eq, eq, answer, par: sol.par,
    history: [], moves: 0, combo: 0, hintStage: 0, busy: false, won: false,
    restarts: restart && S ? S.restarts + 1 : 0, shown: 3,
  };
  if (!$('#screen-game').classList.contains('active')) show('game');
  $('#lvl-world').textContent = `World ${w + 1} · ${WORLDS[w].name}`;
  $('#lvl-name').textContent = `Level ${i + 1}`;
  el.par.textContent = S.par;
  el.dz.style.setProperty('--wc', WORLDS[w].color);
  renderAll();
  coach(startTip());
  closeModal();
  if (!store.seenIntro(w)) showIntro(w);
  else maybeTutorial();
}

function startTip() {
  const v = S.eq.v;
  if (S.w === 0 && S.i === 0) return `Get ${varHTML(v)} all by itself! <b>Drag</b> a move onto the equation – or just <b>tap</b> it.`;
  if (S.par === 1) return `What's stuck to ${varHTML(v)}? Pick the move that undoes it.`;
  return pickOne([
    `Get ${varHTML(v)} alone in ${S.par} moves for ★★★.`,
    `What's stuck to ${varHTML(v)}? Undo it one move at a time.`,
    `Peel things off ${varHTML(v)}, outside first. Best is ${S.par} moves.`,
  ]);
}

function renderAll() {
  renderEquation();
  renderHistory();
  renderStats();
  renderTray();
}

function fitEquation() {
  const box = el.dz.clientWidth - 28;
  let size = Math.min(56, Math.max(28, box / 6.5));
  el.eq.style.fontSize = size + 'px';
  while (el.eq.offsetWidth > box && size > 14) {
    size -= 2;
    el.eq.style.fontSize = size + 'px';
  }
}
addEventListener('resize', () => S && fitEquation());

function renderEquation(anim) {
  el.eq.innerHTML = equationHTML(S.eq);
  el.eq.classList.remove('pending-state', 'solved');
  fitEquation();
  if (anim) pulse(el.eq, anim);
}

function renderHistory() {
  el.history.innerHTML = S.history
    .map((h) => `<div class="hrow"><div class="heq">${equationHTML(h.eq)}</div><div class="hop hop-${opKind(h.op)}">${h.op.t === 'dist' ? 'distribute' : `${opHTML(h.op, h.eq.v)} both sides`}</div></div>`)
    .join('');
  el.history.classList.toggle('empty', !S.history.length);
  el.history.scrollTop = el.history.scrollHeight;
}

function attainableStars() {
  const sol = solve(S.eq);
  if (!sol) return 1;
  return starsFor(S.moves + sol.par, S.par);
}

function renderStats() {
  el.moves.textContent = S.moves;
  const n = S.won ? starsFor(S.moves, S.par) : attainableStars();
  const spans = el.stars.querySelectorAll('span');
  spans.forEach((s, k) => {
    const on = k < n;
    if (!on && k < S.shown) pulse(s, 'lost');
    s.classList.toggle('on', on);
  });
  S.shown = n;
  el.undo.disabled = !S.history.length;
}

function renderTray() {
  const rng = levelRng(S.w, S.i, S.history.length + 17 * S.restarts + 1);
  const tiles = makeTray(S.eq, WORLDS[S.w].tray, rng);
  el.tray.innerHTML = '';
  tiles.forEach((op, k) => {
    const b = document.createElement('button');
    b.className = `tile tile-${opKind(op)}`;
    b.dataset.key = opKey(op);
    b.style.animationDelay = `${k * 45}ms`;
    b.innerHTML = `<span>${opHTML(op, S.eq.v)}</span>`;
    b.setAttribute('aria-label', `${opLabel(op, S.eq.v)} to both sides`);
    attachDrag(b, op);
    el.tray.appendChild(b);
  });
}

function coach(html, mood = '') {
  el.coachText.innerHTML = html;
  el.coach.className = `coach ${mood}`;
  pulse(el.coach, 'bump');
}

// ---------- drag & drop / tap ----------

function inside(x, y, r, pad = 24) {
  return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
}

function attachDrag(tile, op) {
  // Keyboard users: Enter/Space triggers click with detail 0.
  tile.addEventListener('click', (e) => { if (e.detail === 0) playMove(op, tile, true); });

  tile.addEventListener('pointerdown', (e) => {
    if (S.busy || S.won || e.button > 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const rect = tile.getBoundingClientRect();
    let ghost = null;
    let over = false;
    tile.setPointerCapture(e.pointerId);
    tile.classList.add('pressed');

    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!ghost && Math.hypot(dx, dy) > 8) {
        ghost = tile.cloneNode(true);
        ghost.classList.add('ghost');
        Object.assign(ghost.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
        document.body.appendChild(ghost);
        tile.classList.add('dragging');
        el.dz.classList.add('armed');
        sfx.pick();
        hideFinger();
      }
      if (ghost) {
        ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-12, Math.min(12, dx * 0.04))}deg) scale(1.12)`;
        const nowOver = inside(ev.clientX, ev.clientY, el.dz.getBoundingClientRect());
        if (nowOver && !over) buzz(8);
        over = nowOver;
        el.dz.classList.toggle('hot', over);
      }
    };

    const up = (ev) => {
      tile.removeEventListener('pointermove', move);
      tile.removeEventListener('pointerup', up);
      tile.removeEventListener('pointercancel', up);
      tile.classList.remove('pressed', 'dragging');
      el.dz.classList.remove('armed', 'hot');
      if (ghost) {
        if (over && ev.type === 'pointerup') {
          ghost.remove();
          playMove(op, tile, false);
        } else {
          const g = ghost;
          g.animate([{ transform: g.style.transform }, { transform: 'translate(0,0)' }], { duration: 220, easing: 'ease-out' }).onfinish = () => g.remove();
        }
      } else if (ev.type === 'pointerup') {
        playMove(op, tile, true);
      }
    };

    tile.addEventListener('pointermove', move);
    tile.addEventListener('pointerup', up);
    tile.addEventListener('pointercancel', up);
  });
}

async function flyToEquation(tile) {
  const r = tile.getBoundingClientRect();
  const d = el.eq.getBoundingClientRect();
  const ghost = tile.cloneNode(true);
  ghost.classList.add('ghost');
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  document.body.appendChild(ghost);
  const dx = d.left + d.width / 2 - (r.left + r.width / 2);
  const dy = d.top + d.height / 2 - (r.top + r.height / 2);
  sfx.pick();
  await ghost.animate(
    [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0.2 }],
    { duration: 260, easing: 'cubic-bezier(.5,0,.75,0)' },
  ).finished.catch(() => {});
  ghost.remove();
}

// ---------- making a move ----------

async function playMove(op, tile, fly) {
  if (S.busy || S.won) return;
  S.busy = true;
  hideFinger();
  clearHighlights();
  if (fly) await flyToEquation(tile);

  const before = S.eq;
  const oldSol = solve(before);
  sfx.drop();
  buzz(12);

  // Show the move written on both sides, like on paper.
  if (op.t !== 'dist') {
    el.eq.innerHTML = equationHTML(before, op);
    el.eq.classList.add('pending-state');
    fitEquation();
  }
  pulse(el.beam, 'wobble');
  await wait(op.t === 'dist' ? 250 : 800);

  const after = applyOp(before, op);
  S.history.push({ eq: before, op });
  S.eq = after;
  S.moves++;
  S.hintStage = 0;
  renderEquation('pop');
  renderHistory();

  if (isSolved(after)) {
    renderStats();
    await win();
    return;
  }

  const sol = solve(after);
  const v = after.v;
  const rect = el.eq.getBoundingClientRect();
  if (oldSol && sol && sol.par < oldSol.par) {
    S.combo++;
    sfx.good(S.combo);
    buzz(20);
    floatText(pickOne(PRAISE), rect.left + rect.width / 2, rect.top, 'good');
    coach(sol.par === 1 ? `Almost there! One more move gets ${varHTML(v)} alone.` : `${pickOne(PRAISE)} ${sol.par} more moves to get ${varHTML(v)} alone.`, 'happy');
  } else if (op.t === 'dist' && sol && oldSol && sol.par <= oldSol.par) {
    S.combo = 0;
    sfx.good(0);
    coach(`Distributed! The parentheses are gone. Now undo what's stuck to ${varHTML(v)}.`, 'happy');
  } else {
    S.combo = 0;
    sfx.meh();
    buzz([30, 50, 30]);
    pulse(el.dz, 'shake');
    pulse(el.undo, 'nudge');
    const wild = biggestNumber(after) > 999;
    coach(
      wild
        ? `Whoa, those numbers got wild! Tap <b>↶ Undo</b> to go back.`
        : `Still balanced – but ${varHTML(v)} isn't any closer to being alone. Tap <b>↶ Undo</b> and try a different move.`,
      'oops',
    );
  }
  renderStats();
  renderTray();
  S.busy = false;
}

el.undo.addEventListener('click', () => {
  if (!S || S.busy || S.won || !S.history.length) return;
  sfx.undo();
  S.eq = S.history.pop().eq;
  S.combo = 0;
  S.hintStage = 0;
  clearHighlights();
  renderEquation('pop');
  renderHistory();
  renderStats();
  renderTray();
  coach(`Back one step. What's stuck to ${varHTML(S.eq.v)}?`);
});

$('#btn-restart').addEventListener('click', () => {
  if (!S || S.busy) return;
  sfx.undo();
  startLevel(S.w, S.i, { restart: true });
});

// ---------- hints ----------

function clearHighlights() {
  el.eq.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl'));
  el.tray.querySelectorAll('.glow').forEach((n) => n.classList.remove('glow'));
}

function highlight(focus) {
  const sideEl = el.eq.querySelector(`.side[data-side="${focus.side}"]`);
  if (!sideEl) return;
  const direct = [...sideEl.children];
  const target = direct.find((c) => c.dataset.role === focus.role) || direct.find((c) => c.dataset.role === 'outer');
  if (target) target.classList.add('hl');
}

el.hint.addEventListener('click', () => {
  if (!S || S.busy || S.won) return;
  sfx.tap();
  const sol = solve(S.eq);
  if (!sol) {
    coach(`This one got tangled up. Tap <b>↶ Undo</b> to go back a step.`, 'oops');
    pulse(el.undo, 'nudge');
    return;
  }
  // Several moves can be equally good; hint at one that's in the tray.
  const m = sol.best.find((b) => el.tray.querySelector(`[data-key="${opKey(b)}"]`)) || sol.best[0];
  clearHighlights();
  if (S.hintStage === 0) {
    coach('💡 ' + m.why);
    if (m.focus) highlight(m.focus);
    S.hintStage = 1;
  } else {
    const tile = el.tray.querySelector(`[data-key="${opKey(m)}"]`);
    if (tile) tile.classList.add('glow');
    if (m.focus) highlight(m.focus);
    coach(`💡 Try <b>${opHTML(m, S.eq.v)}</b> – it's glowing below.`);
  }
});

// ---------- winning ----------

async function win() {
  S.won = true;
  const stars = starsFor(S.moves, S.par);
  const firstClear = !store.stars(S.w, S.i);
  store.setStars(S.w, S.i, stars);
  el.eq.classList.add('solved');
  const r = el.eq.getBoundingClientRect();
  sfx.win();
  buzz([30, 40, 60]);
  confetti(r.left + r.width / 2, r.top + r.height / 2, 140);
  coach(`${varHTML(S.eq.v)} is all by itself! 🎉`, 'happy');
  el.tray.innerHTML = '';
  await wait(1000);
  showWin(stars, firstClear);
  S.busy = false;
}

function showWin(stars, firstClear) {
  const v = S.eq.v;
  const val = solvedValue(S.eq);
  const lhs = evalSide(S.eq0.L, val);
  const rhs = evalSide(S.eq0.R, val);
  const end = lastLevel(S.w, S.i);
  const worldDone = S.i === LEVELS_PER_WORLD - 1;
  el.modalCard.innerHTML = `
    <div class="win-title">${pickOne(['Solved!', 'Nice work!', 'Awesome!', 'You did it!'])}</div>
    <div class="win-answer">${varHTML(v)} = ${val}</div>
    <div class="win-stars">${[0, 1, 2].map((k) => `<span class="big-star" data-k="${k}">★</span>`).join('')}</div>
    <div class="win-sub">${S.moves} move${S.moves === 1 ? '' : 's'} · best is ${S.par}</div>
    ${stars < 3 ? `<div class="win-tip">Can you do it in ${S.par}? Replay for ★★★</div>` : ''}
    <div class="check">
      <div class="check-label">Check it – put ${val} back in for ${varHTML(v)}:</div>
      <div class="check-eq">${substitutionHTML(S.eq0, val)}</div>
      <div class="check-eq result"><span>${lhs}</span><span class="equals">=</span><span>${rhs}</span><span class="tick">✓</span></div>
    </div>
    <div class="modal-btns">
      <button class="btn" id="m-replay">⟲ Replay</button>
      <button class="btn primary" id="m-next">${end ? 'Finish 🏆' : 'Next ▶'}</button>
    </div>`;
  openModal();
  [0, 1, 2].forEach((k) => {
    setTimeout(() => {
      const s = el.modalCard.querySelector(`[data-k="${k}"]`);
      if (!s) return;
      if (k < stars) {
        s.classList.add('on');
        sfx.star(k);
        buzz(15);
      } else s.classList.add('off');
    }, 350 + k * 320);
  });
  $('#m-replay').addEventListener('click', () => { sfx.tap(); startLevel(S.w, S.i, { restart: true }); });
  $('#m-next').addEventListener('click', () => {
    sfx.tap();
    if (end) return showFinale();
    if (worldDone && firstClear) {
      toast(`🎉 World ${S.w + 1} done! Next: ${WORLDS[S.w + 1].name}`);
      sfx.unlock();
    }
    if (worldDone) startLevel(S.w + 1, 0);
    else startLevel(S.w, S.i + 1);
  });
}

function showFinale() {
  const total = store.totalStars();
  el.modalCard.innerHTML = `
    <div class="win-title">Champion! 🏆</div>
    <p class="finale">You solved every level. You can solve for x like a pro!</p>
    <div class="win-sub">★ ${total} / ${WORLDS.length * LEVELS_PER_WORLD * 3} stars</div>
    ${total < WORLDS.length * LEVELS_PER_WORLD * 3 ? '<div class="win-tip">Go back and grab any missing stars!</div>' : ''}
    <div class="modal-btns"><button class="btn primary" id="m-map">Levels</button></div>`;
  openModal();
  confetti(innerWidth / 2, innerHeight / 3, 200);
  sfx.win();
  $('#m-map').addEventListener('click', () => { closeModal(); show('map'); });
}

// ---------- intro / tutorial ----------

const styleX = (html) => html.replace(/(?<![a-z])x(?![a-z])/g, varHTML('x'));

function showIntro(w) {
  const W = WORLDS[w];
  const missing = missingSkills(w);
  const warm = missing[0];
  el.modalCard.innerHTML = `
    <div class="intro-badge" style="--wc:${W.color}">${W.icon}</div>
    <div class="intro-world">World ${w + 1}: ${W.name}</div>
    <div class="intro-title">${styleX(W.intro.title)}</div>
    <div class="intro-body">${styleX(W.intro.body)}</div>
    ${missing.length ? `<div class="intro-warn">This world uses skills from <b>${missing.map((u) => WORLDS[u].name).join('</b> and <b>')}</b>. Jump in, or warm up there first.</div>` : ''}
    <div class="modal-btns">
      ${missing.length ? `<button class="btn" id="m-warm">Warm up: ${WORLDS[warm].name}</button>` : ''}
      <button class="btn primary" id="m-go">Let's go!</button>
    </div>`;
  openModal();
  $('#m-go').addEventListener('click', () => {
    sfx.tap();
    store.markIntro(w);
    closeModal();
    maybeTutorial();
  });
  if (missing.length) {
    $('#m-warm').addEventListener('click', () => { sfx.tap(); startLevel(warm, firstUnsolved(warm)); });
  }
}

function maybeTutorial() {
  if (!(S.w === 0 && S.i === 0 && !S.history.length)) return;
  const best = solve(S.eq).best[0];
  const tile = el.tray.querySelector(`[data-key="${opKey(best)}"]`);
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  const d = el.eq.getBoundingClientRect();
  const f = el.finger;
  f.classList.remove('hidden');
  f.getAnimations().forEach((a) => a.cancel());
  f.animate(
    [
      { transform: `translate(${r.left + r.width / 2 - 20}px, ${r.top + r.height / 2}px)`, opacity: 0 },
      { transform: `translate(${r.left + r.width / 2 - 20}px, ${r.top + r.height / 2}px)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${d.left + d.width / 2 - 20}px, ${d.top + d.height / 2}px)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${d.left + d.width / 2 - 20}px, ${d.top + d.height / 2}px)`, opacity: 0 },
    ],
    { duration: 2200, iterations: Infinity, delay: 600, easing: 'ease-in-out' },
  );
}

function hideFinger() {
  el.finger.classList.add('hidden');
  el.finger.getAnimations().forEach((a) => a.cancel());
}

// ---------- modal & toast ----------

function openModal() {
  el.modal.classList.remove('hidden');
  pulse(el.modalCard, 'pop-in');
}
function closeModal() {
  el.modal.classList.add('hidden');
}

let toastTimer;
function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

// ---------- boot ----------

$('#home-stars').textContent = store.totalStars();
history.replaceState({ screen: 'home' }, '');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Handy for debugging in the console.
window.__freeTheX = { store, startLevel, isMuted };
