// core/screens.js: runs the five slices in order. Owner: Person 1.
// Follows RULEBOOK section 3 (screen flow) and section 12 (dev panel).

import { createState, fakeState, checkEnd, PRESET_NAMES } from './state.js';
import * as ui from './ui.js';
import * as dashboard from './dashboard.js'; // works even while dashboard.js is still empty

export const ORDER = ['briefing', 'build', 'trail', 'launchweek', 'finale'];

// The friendly error screen. Demo day must never show a blank page, so a broken slice shows
// Rosa and a Continue button that moves on. The real error is already in the console (F12).
function showLostContact(done) {
  const root = ui.screen();
  const lostContactPanel = ui.panel();
  lostContactPanel.append(ui.portrait('rosa', 128));
  lostContactPanel.append(Object.assign(document.createElement('p'), {
    textContent: 'Mission Control lost contact for a moment',
  }));
  lostContactPanel.append(ui.button('Continue', () => done()));
  root.append(lostContactPanel);
}

// Load a slice's entry file. If it is broken, show the lost-contact screen so nobody is blocked.
async function loadSlice(id) {
  try {
    return await import(`../slices/${id}/${id}.js`);
  } catch (err) {
    console.error(`Slice "${id}" failed to load. Fix slices/${id}/${id}.js.`, err);
    return { show: (state, done) => showLostContact(done) };
  }
}

// Runs one slice and waits until it calls done(target, opts). Resolves with { target, opts }.
// target: a slice id to jump to (or nothing for the next one). opts.fresh: start a brand-new game.
function runSlice(mod, state) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (target, opts = {}) => {
      if (finished) return; // ignore a second done(), e.g. a double click
      finished = true;
      resolve({ target, opts: opts ?? {} });
    };
    Promise.resolve()
      .then(() => mod.show(state, done))
      .catch((err) => {
        console.error('A slice crashed:', err);
        // If the slice already called done(), the game has moved on. Don't cover the next screen.
        if (!finished) showLostContact(done);
      });
  });
}

// Replace everything in state with a fresh game, keeping the same object.
function resetInPlace(state) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, createState());
}

export async function start(state = createState(), from = 'briefing') {
  ui.bindState(state);
  const dash = document.getElementById('dashboard');
  if (dash) dashboard.mountDashboard?.(dash);
  ui.refresh();

  let i = Math.max(0, ORDER.indexOf(from));
  while (true) {
    const id = ORDER[i];
    const { target, opts } = await runSlice(await loadSlice(id), state);
    const targetIsSlice = ORDER.includes(target);

    // done(target, { fresh: true }) from any slice: brand-new game, then the target or the start.
    if (opts.fresh) {
      resetInPlace(state);
      ui.refresh();
      i = targetIsSlice ? ORDER.indexOf(target) : 0;
      continue;
    }
    ui.refresh();

    if (id === 'finale') {
      if (targetIsSlice) { i = ORDER.indexOf(target); continue; }
      // Try Again: finale set state.resume and loaded a checkpoint. The matching slice
      // reads state.resume and skips ahead (it should set state.resume = null after reading it).
      if (state.resume === 'hiring') { i = ORDER.indexOf('briefing'); continue; }
      if (state.resume === 'build') { i = ORDER.indexOf('build'); continue; }
      // Play Again with no target and no resume: start over with a brand-new game.
      resetInPlace(state);
      ui.refresh();
      i = 0;
      continue;
    }

    // After every done(), check for bankrupt or window_closed (RULEBOOK section 3).
    const end = checkEnd(state);
    if (end) state.outcome = end;
    if (state.outcome || target === 'finale') { i = ORDER.indexOf('finale'); continue; }
    if (targetIsSlice) { i = ORDER.indexOf(target); continue; } // dev jumps
    i += 1;
  }
}

// ---------- Dev panel: press the backtick key (`) to jump to any slice with any preset.

function devPanel() {
  let open = null;
  window.addEventListener('keydown', (e) => {
    if (e.key !== '`') return;
    if (open) { open.remove(); open = null; return; }
    const p = new URLSearchParams(location.search);
    open = document.createElement('div');
    open.className = 'dev-panel';
    open.innerHTML = `
      <strong>Dev panel</strong>
      <label>Slice <select id="dev-slice">${ORDER.map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label>Preset <select id="dev-preset">${PRESET_NAMES.map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label>Seed <input id="dev-seed" size="6" value="${p.get('seed') ?? ''}"></label>
      <button id="dev-go">Go</button>`;
    document.body.append(open);
    open.querySelector('#dev-slice').value = p.get('slice') ?? 'briefing';
    open.querySelector('#dev-preset').value = p.get('preset') ?? 'fresh';
    open.querySelector('#dev-go').onclick = () => {
      const q = new URLSearchParams({
        slice: open.querySelector('#dev-slice').value,
        preset: open.querySelector('#dev-preset').value,
      });
      const seed = open.querySelector('#dev-seed').value.trim();
      if (seed) q.set('seed', seed);
      location.search = q.toString(); // reloads the page at that slice and preset
    };
  });
}

// ---------- Browser Back button: stay in the game instead of leaving the page.

function holdBackButton() {
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => {
    history.pushState(null, '', location.href);
    ui.toast('Use the buttons in the game to move around.');
  });
}

// ---------- Boot: index.html calls this. ?slice=trail&preset=midTrail starts mid-game.

export function boot() {
  devPanel();
  holdBackButton();
  const p = new URLSearchParams(location.search);
  const preset = p.get('preset');
  const state = preset ? fakeState(preset) : createState();
  window.state = state; // type "state" in the console (F12) to inspect it
  start(state, p.get('slice') ?? 'briefing');
}