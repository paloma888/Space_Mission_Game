// core/screens.js: runs the five slices in order. Owner: Person 1.
// Follows RULEBOOK section 3 (screen flow) and section 12 (dev panel).

import { createState, fakeState, checkEnd, PRESET_NAMES } from './state.js';
import * as ui from './ui.js';
import * as dashboard from './dashboard.js'; // works even while dashboard.js is still empty

export const ORDER = ['briefing', 'build', 'trail', 'launchweek', 'finale'];

// Load a slice's entry file. If it is broken, show a placeholder so the rest of the team isn't blocked.
async function loadSlice(id) {
  try {
    return await import(`../slices/${id}/${id}.js`);
  } catch (err) {
    console.error(`Slice "${id}" failed to load. Fix slices/${id}/${id}.js.`, err);
    return {
      show(state, done) {
        const root = ui.screen();
        root.append(ui.panel(`Slice "${id}" failed to load. See the console (F12).`));
        root.append(ui.button('Skip to next', () => done()));
      },
    };
  }
}

// Runs one slice and waits until it calls done(). Resolves with what was passed to done().
function runSlice(mod, state) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (next) => {
      if (finished) return; // ignore a second done()
      finished = true;
      resolve(next);
    };
    Promise.resolve()
      .then(() => mod.show(state, done))
      .catch((err) => {
        console.error('A slice crashed:', err);
        ui.toast('Something broke on this screen. See the console (F12).', 4000);
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
    const next = await runSlice(await loadSlice(id), state);
    ui.refresh();

    if (id === 'finale') {
      // Try Again: finale set state.resume and loaded a checkpoint. The matching slice
      // reads state.resume and skips ahead (it should set state.resume = null after reading it).
      if (state.resume === 'hiring') { i = ORDER.indexOf('briefing'); continue; }
      if (state.resume === 'build') { i = ORDER.indexOf('build'); continue; }
      // Play Again: start over with a brand-new game.
      resetInPlace(state);
      ui.refresh();
      i = 0;
      continue;
    }

    // After every done(), check for bankrupt or window_closed (RULEBOOK section 3).
    const end = checkEnd(state);
    if (end) state.outcome = end;
    if (state.outcome || next === 'finale') { i = ORDER.indexOf('finale'); continue; }
    if (next && ORDER.includes(next)) { i = ORDER.indexOf(next); continue; } // dev jumps
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