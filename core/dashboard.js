// core/dashboard.js: the always-on resource strip at the top of the screen. Owner: Person 2.
// Slice 2 brief section 10. screens.js calls mountDashboard() once, and every
// ui.refresh() calls updateDashboard(state). Reliability is never shown: it is hidden by design.

// Namespace import: ui.js imports this file too, so a named import could run before ui.js is ready.
import * as ui from './ui.js';

const asset = (path) => new URL(`../${path}`, import.meta.url).href;

// Left to right, in the order the team picked. `tip` is the hover text, `rosa` the click explanation.
const GAUGES = [
  { id: 'days', label: 'DAYS', icon: 'dash_calendar',
    tip: 'Days: today, out of 42. You can launch from day 36 to day 42.',
    rosa: 'We have 42 days in all. Launch day can be 36 to 42. Think of the last train home: miss it and the trip is off.' },
  { id: 'morale', label: 'MORALE', icon: 'dash_morale',
    tip: 'Morale: how your team feels, from 0 to 100.',
    rosa: 'Morale is how the team feels. A happy crew is like a happy road trip: fewer arguments, better choices.' },
  { id: 'comms', label: 'COMMS', icon: 'dash_comms',
    tip: 'Comms: how good your radio to Mission Control is.',
    rosa: 'Comms is your radio to the ground. A better radio is like a clear phone call. We hear about trouble sooner.' },
  { id: 'mass', label: 'MASS MARGIN', icon: 'dash_mass',
    tip: 'Mass margin: spare lift. Below zero, the rocket cannot carry your capsule.',
    rosa: 'Mass margin is spare lift, like the weight limit on a suitcase. Go over it and the rocket stays on the ground.' },
  { id: 'power', label: 'POWER', icon: 'dash_power',
    tip: 'Power: watts your parts use, out of what the battery supplies.',
    rosa: 'Power is like a phone battery. Every part sips from it. Use more than it holds and things switch off mid-flight.' },
  { id: 'budget', label: 'BUDGET', icon: 'dash_budget',
    tip: 'Budget: money left, in millions of dollars.',
    rosa: 'This is our money, in millions. Every part costs some. If it hits zero before launch, the mission is over.' },
];

let root = null;
const cells = {};   // gauge id -> { box, value, sub, fill }
let last = null;    // numbers from the previous update, to spot changes
let cardOpen = false;

const STYLE = `
/* Fixed columns so a gauge never resizes when its text changes ("--" to "STANDARD").
   Days and Power are wider to fit "Day 42 of 42" and "420 / 800 W" at 16px; the rest share evenly.
   6 gauges + 56px mute slot = 1280px. The tight padding and gap are what make the longest text fit. */
#dashboard .dash { display: grid; grid-template-columns: 240px 185px 190px 190px 234px 185px 56px;
  height: 56px; background: var(--c4); border-bottom: 4px solid var(--c12); color: var(--c1); }
#dashboard .gauge { position: relative; min-width: 0; overflow: hidden; display: flex; align-items: center; gap: 4px;
  padding: 0 4px; border-right: 4px solid var(--c8); pointer-events: auto; cursor: help; }
#dashboard .gauge:hover { background: var(--c8); }
#dashboard .gauge img { width: 32px; height: 32px; image-rendering: pixelated; flex: none; }
#dashboard .g-label { font-size: var(--small); color: var(--c14); margin-bottom: 6px; white-space: nowrap; }
#dashboard .g-value { font-size: var(--body); white-space: nowrap; }
#dashboard .g-sub { font-size: var(--small); color: var(--c14); }
#dashboard .g-bar { width: 96px; height: 12px; background: var(--c0); border: 2px solid var(--c12); }
#dashboard .g-bar > div { height: 100%; width: 0; background: var(--dash-ok); }
#dashboard .dash { --dash-ok: var(--c9); --dash-warn: var(--c10); --dash-bad: var(--c2); }
#dashboard .ok .g-value { color: var(--dash-ok); }
#dashboard .warn .g-value { color: var(--dash-warn); }
#dashboard .bad .g-value { color: var(--dash-bad); }
#dashboard .warn .g-bar > div { background: var(--dash-warn); }
#dashboard .bad .g-bar > div { background: var(--dash-bad); }
#dashboard .flash { animation: dash-flash 300ms steps(2); }
@keyframes dash-flash { 50% { background: var(--c12); } }
#dashboard .float { position: absolute; right: 12px; top: 4px; font-size: var(--small);
  color: var(--c10); pointer-events: none; animation: dash-float 900ms steps(6) forwards; }
@keyframes dash-float { to { transform: translateY(-20px); opacity: 0; } }
#mute-slot { flex: none; width: 56px; height: 56px; pointer-events: auto; }
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mountDashboard(element) {
  if (!element) return;
  if (!document.getElementById('dashboard-style')) {
    const style = el('style');
    style.id = 'dashboard-style';
    style.textContent = STYLE;
    document.head.append(style);
  }
  root = el('div', 'dash');
  for (const g of GAUGES) {
    const box = el('div', 'gauge');
    box.title = g.tip;
    // Missing icon art must never break anything, so a failed image just disappears.
    const icon = el('img');
    icon.alt = '';
    icon.onerror = () => icon.remove();
    icon.src = asset(`art/icons/${g.icon}.png`);
    const text = el('div');
    const label = el('div', 'g-label', g.label);
    const value = el('div', 'g-value', '--');
    text.append(label, value);
    const cell = { box, label, value };
    if (g.id === 'morale') {
      // Morale shows a bar where the others show text. Its number goes in the label.
      const barBox = el('div', 'g-bar');
      cell.fill = el('div');
      barBox.append(cell.fill);
      text.append(barBox);
      value.hidden = true;
    }
    box.append(icon, text);
    // pointerdown is stopped so a click here doesn't also skip a line of dialogue.
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.addEventListener('click', () => explain(g));
    cells[g.id] = cell;
    root.append(box);
  }
  const mute = el('div');
  mute.id = 'mute-slot'; // Person 1 puts the mute button here
  root.append(mute);
  element.replaceChildren(root);
  last = null;
}

async function explain(g) {
  if (cardOpen) return;
  cardOpen = true;
  await ui.card(`<h2>Rosa Vega</h2><p>${g.rosa}</p>`);
  cardOpen = false;
}

// ---------- Reading the state. Every read has a fallback so a half-empty state never throws.

function read(state) {
  const d = state.derived ?? {};
  const day = state.day ?? 1;
  const closes = state.windowCloses ?? 42;
  return {
    day, closes, left: closes - day,
    morale: state.morale ?? 0,
    comms: d.comms && d.comms !== 'none' ? d.comms : null,
    hasLift: Boolean(state.rocket && state.site),
    margin: d.massMargin ?? 0,
    hasPower: Boolean(state.parts?.power?.tier),
    use: d.powerUse ?? 0,
    supply: d.powerSupply ?? 0,
    budget: state.budget ?? 0,
  };
}

const level = (bad, warn) => (bad ? 'bad' : warn ? 'warn' : 'ok');
const signed = (n) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;

function setCell(id, value, mood) {
  const c = cells[id];
  c.value.textContent = value;
  c.box.classList.remove('ok', 'warn', 'bad');
  if (mood) c.box.classList.add(mood);
}

// Brief flash plus a little "+10" floating up, so the player notices what changed.
function pulse(id, delta) {
  const box = cells[id].box;
  box.classList.remove('flash');
  void box.offsetWidth; // restart the animation if it is already running
  box.classList.add('flash');
  if (delta) {
    const f = el('span', 'float', delta);
    box.append(f);
    setTimeout(() => f.remove(), 900);
  }
}

export function updateDashboard(state) {
  if (!root || !state) return;
  const v = read(state);

  setCell('days', `Day ${v.day} of ${v.closes}`, level(v.left <= 7, v.left <= 14));
  cells.days.label.textContent = `DAYS · ${Math.max(0, v.left)} LEFT`;

  cells.morale.label.textContent = `MORALE ${Math.round(v.morale)}`;
  cells.morale.fill.style.width = `${Math.max(0, Math.min(100, v.morale))}%`;
  setCell('morale', String(v.morale), level(v.morale <= 20, v.morale <= 40));

  setCell('comms', v.comms ? v.comms.toUpperCase() : '--', v.comms ? level(false, v.comms === 'budget') : null);

  setCell('mass', v.hasLift ? `${signed(v.margin)} t` : '--',
    v.hasLift ? level(v.margin < 0, v.margin < 1) : null);

  setCell('power', v.hasPower ? `${v.use} / ${v.supply} W` : '--',
    v.hasPower ? level(v.use > v.supply, v.use > 0.9 * v.supply) : null);

  setCell('budget', `$${v.budget}M`, level(v.budget < 100, v.budget < 200));

  // Skip the very first update so the dashboard doesn't flash on page load.
  if (last) {
    const changed = (key) => Math.abs(v[key] - last[key]) > 1e-9;
    for (const [id, key] of [['days', 'day'], ['morale', 'morale'], ['budget', 'budget']]) {
      if (changed(key)) pulse(id, signed(v[key] - last[key]));
    }
    // When mass or power first appears ("--" to a number), flash without a delta:
    // "+12" from a placeholder would mean nothing to the player.
    if (v.hasLift !== last.hasLift) pulse('mass');
    else if (v.hasLift && changed('margin')) pulse('mass', signed(v.margin - last.margin));
    if (v.hasPower !== last.hasPower) pulse('power');
    else if (v.hasPower && changed('use')) pulse('power', signed(v.use - last.use));
    if (v.comms !== last.comms) pulse('comms');
  }
  last = v;
}
