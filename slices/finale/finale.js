// Slice 5: Launch & Report (owner: Person 5). RULEBOOK section 3, Slice 5 brief section 3.
// Flow: roll the launch -> play it -> ending screen -> mission report -> Try Again menu.
// The launch is rolled once by resolveLaunch() and every screen after that only replays the result.

import * as ui from '../../core/ui.js';
import { addFlag, loadCheckpoint, random } from '../../core/state.js';
import { resolveLaunch, noLaunch, computeScore, oddsWords, pickHistoryCard } from './launch-sim.js';
import { mountOrbitExplorer } from './orbit-explorer.js';

export const meta = { id: 'finale', owner: 'Person 5' };

const here = (path) => new URL(path, import.meta.url);

// test.html only: opts.rng forces an outcome, opts.reportOnly skips straight to the report.
// The real game passes neither.
export async function show(state, done, opts = {}) {
  addStyles();
  const data = await loadData();

  let result;
  if (state.outcome === 'bankrupt' || state.outcome === 'window_closed') {
    result = noLaunch(state.outcome); // no launch happened, go straight to the ending
  } else {
    result = resolveLaunch(state, opts.rng ?? random);
    state.stages = result.stages;
    state.emergencies = result.emergencies;
    state.outcome = result.outcome;
    result.flagsToAdd.forEach((f) => addFlag(state, f));
    ui.refresh();
    if (!opts.reportOnly) await playLaunch(state, result, data.text);
  }

  const ending = data.endings[state.outcome] ?? { title: state.outcome, text: '', rosa: [] };
  if (opts.reportOnly) { /* skip the ending screen */ }
  else if (state.outcome === 'orbit' || state.outcome === 'aliens') await orbitEnding(state, ending);
  else if (state.outcome === 'lost') await memorial(state, ending);
  else await plainEnding(state, ending);

  await report(state, result, data, ending);
  await menu(state, done);
}

// ---------- Data (every file is optional: a missing one never breaks the slice)

async function loadJson(path, fallback) {
  try {
    const res = await fetch(here(path));
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`finale: could not load ${path}. Using a fallback.`, err);
    return fallback;
  }
}

async function loadData() {
  const [endings, badges, text, ...cardLists] = await Promise.all([
    loadJson('./endings.json', {}),
    loadJson('./badges.json', []),
    loadJson('./launch-text.json', { stages: {}, emergencies: {} }),
    loadJson('../trail/history.json', []),
    loadJson('../launchweek/history.json', []),
    loadJson('./history.json', []),
  ]);
  return { endings, badges, text, cards: cardLists.flat() };
}

function addStyles() {
  if (document.querySelector('link[data-finale]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = here('./finale.css').href;
  link.dataset.finale = '';
  document.head.append(link);
}

// ---------- Small helpers

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// sleep() that a Skip button can cut short.
function makeSkipper() {
  const waiting = new Set();
  const s = { skipped: false };
  s.skip = () => { s.skipped = true; waiting.forEach((wake) => wake()); waiting.clear(); };
  s.sleep = (ms) => (s.skipped ? Promise.resolve() : new Promise((resolve) => {
    const wake = () => { clearTimeout(timer); waiting.delete(wake); resolve(); };
    const timer = setTimeout(wake, ms);
    waiting.add(wake);
  }));
  return s;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- 1. The launch. Placeholder text version. The canvas animation replaces it later
// and plays the same `result`, so it can never disagree with the numbers.

async function playLaunch(state, result, text) {
  ui.music('launch_theme');
  const root = ui.screen(`launchweek/${state.site ?? 'canaveral'}`);
  root.classList.add('fin-launch');
  const box = ui.panel('Launch');
  const count = el('div', 'fin-count');
  const log = el('div', 'fin-log');
  box.append(count, log);
  root.append(box);

  const sk = makeSkipper();
  const skip = ui.button('Skip', () => sk.skip(), { variant: 'quiet' });
  skip.classList.add('fin-skip');
  skip.hidden = true;
  root.append(skip);
  setTimeout(() => { skip.hidden = false; }, 3000); // brief: Skip appears after 3 seconds

  const line = (words, kind) => log.append(el('div', kind ? `fin-${kind}` : '', words));

  line(text.countdown ?? 'Here we go.');
  for (let n = 5; n >= 1; n--) {
    count.textContent = `T-${n}`;
    ui.sfx('fin-countdown');
    await sk.sleep(700);
  }
  count.textContent = 'T-0';
  ui.sfx('fin-ignite');

  for (const stage of result.stages) {
    const words = text.stages?.[stage.id] ?? { name: stage.id.toUpperCase(), pass: '', fail: '' };
    if (stage.skipped) {
      line(text.skipped ?? '...', 'warn');
      break;
    }
    if (stage.id === 'liftoff') await showEmergencies(result, 'liftoff', text, line, sk, root);
    await sk.sleep(1300);
    if (stage.passed) {
      ui.sfx('fin-go');
      line(`${words.name}: GO. ${words.pass}`, 'go');
    } else {
      ui.sfx('fin-fail');
      line(`${words.name}: FAIL. ${words.fail}`, 'fail');
      break;
    }
  }
  await showEmergencies(result, 'orbit', text, line, sk, root);
  await sk.sleep(1500);
  skip.remove();
}

async function showEmergencies(result, stage, text, line, sk, root) {
  for (const e of result.emergencies.filter((x) => x.stage === stage)) {
    const words = text.emergencies?.[e.type] ?? { alert: e.type, saved: '', lost: '' };
    await sk.sleep(900);
    if (e.type === 'lightning') { ui.sfx('fin-thunder'); flash(root); }
    line(words.alert, 'warn');
    await sk.sleep(2000); // the tense two-second beat
    line(e.saved ? words.saved : words.lost, e.saved ? 'go' : 'fail');
  }
}

function flash(root) {
  root.classList.remove('fin-flash');
  void root.offsetWidth; // restart the animation if it already ran
  root.classList.add('fin-flash');
}

// ---------- 2. Endings

function orbitEnding(state, ending) {
  const aliens = state.outcome === 'aliens';
  ui.music('ending_orbit');
  ui.sfx(aliens ? 'fin-alien' : 'fin-fanfare');
  return new Promise((resolve) => {
    const root = ui.screen();
    root.classList.add('fin-explore');
    const explorer = mountOrbitExplorer(root, state, { celebrate: true, aliens });

    root.append(el('div', 'fin-explore-title', ending.title));
    root.append(el('div', 'fin-explore-hint', 'Drag to spin. Scroll to zoom. Click things. Can you find the Moon?'));

    // Rosa's line sits in a small box the player can close, so it never blocks dragging.
    const note = el('div', 'panel fin-rosa-note');
    note.append(ui.portrait('rosa', 64), el('p', '', ending.text));
    note.addEventListener('click', () => note.remove());
    setTimeout(() => root.append(note), 1500);

    const next = ui.button('Mission report', () => { explorer.destroy(); resolve(); });
    next.classList.add('fin-explore-next');
    root.append(next);
  });
}

// The crew-loss screen. Rulebook 1 and 8: a fade, a plaque, no jokes, Rosa stays quiet.
async function memorial(state, ending) {
  ui.music('ending_sad');
  const root = ui.screen('finale/memorial_plaque');
  root.classList.add('fin-memorial');
  const plaque = el('div', 'fin-plaque');
  plaque.append(el('div', 'fin-plaque-head', 'In memory of'));
  for (const c of state.crew ?? []) plaque.append(el('div', 'fin-plaque-name', c.name));
  plaque.append(el('p', 'fin-plaque-line', ending.plaque ?? ''));
  root.append(plaque);
  await wait(4000);
  await new Promise((resolve) => root.append(ui.button('Continue', resolve, { variant: 'quiet' })));
}

const ENDING_ART = { abort: 'ending_abort', bankrupt: 'ending_bankrupt', window_closed: 'ending_window' };

async function plainEnding(state, ending) {
  ui.sfx(state.outcome === 'abort' ? 'fin-parachute' : 'fin-fail');
  const root = ui.screen(`finale/${ENDING_ART[state.outcome] ?? 'ending_abort'}`);
  root.classList.add('fin-ending');
  const box = ui.panel();
  box.append(el('h1', '', ending.title), el('p', '', ending.text));
  root.append(box);
  await new Promise((resolve) => box.append(ui.button('Mission report', resolve)));
}

// ---------- 3. Mission report

const MEDAL_NAMES = { gold: 'Gold medal', silver: 'Silver medal', bronze: 'Bronze medal' };
const fmt = (n) => (Math.round(n * 10) / 10).toString();

function report(state, result, data, ending) {
  ui.music('report_loop');
  const score = computeScore(state, result);
  state.score = score.total;

  const root = ui.screen('finale/report_bg');
  root.classList.add('fin-report');

  // Left: score rows appear one by one, then the total, medal and badges.
  const left = ui.panel('Mission score');
  score.lines.forEach((l, i) => {
    const row = el('div', 'fin-row');
    row.append(el('span', '', l.label), el('span', '', `${fmt(l.points)} / ${l.max}`));
    row.style.animationDelay = `${i * 0.35}s`;
    left.append(row);
  });
  const total = el('div', 'fin-row fin-total');
  total.append(el('span', '', 'Total'), el('span', '', `${fmt(score.total)} / 100`));
  total.style.animationDelay = `${score.lines.length * 0.35}s`;
  left.append(total);
  setTimeout(() => ui.sfx('fin-medal'), score.lines.length * 350 + 300);
  left.append(el('div', `fin-medal fin-medal-${score.medal ?? 'none'}`,
    score.medal ? MEDAL_NAMES[score.medal] : `No medal this time. ${score.medalReason}`));
  const badges = el('div', 'fin-badges');
  for (const b of data.badges) {
    const earned = score.badges.find((x) => x.id === b.id)?.earned;
    const chip = el('div', `fin-badge ${earned ? 'on' : 'off'}`, b.label);
    chip.title = earned ? 'Earned!' : b.hint;
    if (!earned) chip.append(el('div', 'fin-badge-hint', b.hint));
    badges.append(chip);
  }
  left.append(badges);

  // Middle: the real NASA story that matches what happened.
  const card = pickHistoryCard(data.cards, state, result);
  const middle = ui.panel(card ? card.title : 'From the history books');
  if (card) {
    if (card.tone === 'memorial') middle.classList.add('fin-card-memorial');
    middle.append(el('p', '', card.story), el('p', 'fin-card-lesson', card.lesson));
    for (const s of card.sources ?? []) {
      if (!/^https:\/\//.test(s.url ?? '')) continue; // never show a TODO or broken link
      const a = el('a', 'fin-source', `Source: ${s.title}`);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      middle.append(a);
    }
  } else {
    const success = state.outcome === 'orbit' || state.outcome === 'aliens';
    middle.append(el('p', '', success
      ? 'No history lesson needed today. Your launch went by the book.'
      : 'Every mission teaches something. Look at what shaped your odds, then try again.'));
  }

  // Right: what shaped the odds, in words only (never show the probability).
  const right = ui.panel('What shaped your odds');
  for (const o of oddsWords(state)) {
    const row = el('div', 'fin-odds');
    row.append(el('div', '', o.label), el('div', `fin-${o.tone}`, o.words));
    right.append(row);
  }

  // Bottom: Rosa's debrief.
  const debrief = el('div', 'panel fin-debrief');
  debrief.append(ui.portrait('rosa', 96));
  const lines = el('div', 'fin-debrief-lines');
  for (const text of ending.rosa ?? []) lines.append(el('p', '', text));
  debrief.append(lines);

  root.append(left, middle, right, debrief);
  return new Promise((resolve) => debrief.append(ui.button('What next?', resolve)));
}

// ---------- 4. Try Again (Slice 5 brief section 11)

async function menu(state, done) {
  const has = (name) => !!state.checkpoints?.[name];
  const why = 'No saved plan to go back to';
  const choices = [
    { label: 'Change my crew or staff', disabled: !has('afterHiring'), why },
    { label: 'Change my build', disabled: !has('afterBuild'), why },
    { label: 'Same plan, new luck', disabled: !has('afterBuild'), why },
    { label: 'Start over' },
  ];
  const pick = await ui.ask('rosa', 'Want to try again? Change one thing and see what happens.', choices);

  // A checkpoint restores the whole state, so outcome, score, weather and so on reset too.
  if (pick === 0) { loadCheckpoint(state, 'afterHiring'); state.resume = 'hiring'; return done('briefing'); }
  if (pick === 1) { loadCheckpoint(state, 'afterBuild'); state.resume = 'build'; return done('build'); }
  if (pick === 2) { loadCheckpoint(state, 'afterBuild'); state.resume = null; return done('trail'); }
  return done('briefing', { fresh: true });
}
