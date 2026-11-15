// The screens: Slice 5: Launch & Report (owner: Person 5). RULEBOOK section 3, Slice 5 brief section 3.
// Flow: roll the launch -> play it -> ending screen -> mission report -> Try Again menu.
// The launch is rolled once by resolveLaunch() and every screen after that only replays the result.

// ---------- JavaScript cheat sheet: the syntax this file uses, in plain words
//   const x = 5;            a name for a value that won't be replaced. `let` is the same but can change.
//   (a, b) => a + b         a short function: "give me a and b, I give back a + b".
//   async function / await  `await` pauses here until something finishes (a timer, a click, a file),
//                           without freezing the page. Only allowed inside an `async` function.
//   new Promise(resolve => ...)  "I'll finish later". Calling resolve() means "done now", and
//                           whoever was `await`-ing it carries on.
//   `T-${n}`                a template string: back-ticks, and ${...} drops a value into the text.
//   a ?? b                  use a, or b if a is missing (null or undefined).
//   a?.b                    read a.b, but don't crash if a is missing.
//   cond ? x : y            if cond is true use x, otherwise y. A one-line if/else.
//   for (const x of list)   do something once for each item in the list.
//   el.append(child)        put an element on the page inside another one.

// ---------- Imports: borrow tools from other files
import * as ui from '../../core/ui.js';            // Person 1's screen helpers: screen, panel, button, say, ask...
import { addFlag, loadCheckpoint, random } from '../../core/state.js';
import {
  resolveLaunch, noLaunch, computeScore, oddsWords, pickHistoryCard, didLaunch, endReason, progressTrack,
} from './launch-sim.js';
import { mountOrbitExplorer } from './orbit-explorer.js';
import { mountLaunchAnim } from './launch-anim.js';
import { LAUNCH_COLORS, makeCanvas, buildRocket } from './launch-art.js';
import { readPalette, pickColors } from './pixel.js';

// Tells core/screens.js who this slice is (Rulebook section 4).
export const meta = { id: 'finale', owner: 'Person 5' };

// Turns a path like './endings.json' into a full address next to this file, so it works from any page.
const here = (path) => new URL(path, import.meta.url);

/**
 * Job: the entry point. Runs the whole slice in order and is the only function other files call.
 *   1. Load the CSS and every text file.
 *   2. Bankrupt or window closed? Skip the launch. Otherwise roll it ONCE with resolveLaunch,
 *      copy the result into the state (stages, emergencies, outcome, flags) and play it.
 *   3. Ending screen: the 3D globe for orbit, a simple panel for everything else.
 *   4. Mission report.
 *   5. Try Again menu, which calls done().
 * @param {Object} state - the shared backpack from slices 1 to 4. This function DOES change it.
 * @param {Function} done - call it to leave the slice, e.g. done('build'). core/screens.js decides what's next.
 * @param {Object} opts - test.html only: opts.rng forces an outcome, opts.reportOnly skips to the report.
 *   The real game passes neither.
 * @returns {Promise} - finishes when the player picks a Try Again option.
 * ⭐
 */
export async function show(state, done, opts = {}) {
  // Step 1: get the styles and all the text files ready.
  addStyles();
  const data = await loadData();

  // Step 2: the launch. Either skip it (no launch happened) or roll it once and play it.
  let result;
  if (state.outcome === 'bankrupt' || state.outcome === 'window_closed') {
    result = noLaunch(state.outcome); // no launch happened, go straight to the ending
  } else {
    result = resolveLaunch(state, opts.rng ?? random);   // THE dice roll (launch-sim.js)
    // Save the result into the shared state, so other code (and the dashboard) can see it.
    state.stages = result.stages;
    state.emergencies = result.emergencies;
    state.outcome = result.outcome;
    result.flagsToAdd.forEach((f) => addFlag(state, f));
    ui.refresh();
    if (!opts.reportOnly) await playLaunch(state, result, data.text); // wait until the launch finishes showing
  }

  // Step 3: the ending screen. Find this outcome's texts in endings.json, then pick which screen to show.
  const ending = endingFor(data.endings, state);
  if (opts.reportOnly) { /* skip the ending screen */ }
  else if (state.outcome === 'orbit' || state.outcome === 'aliens') await orbitEnding(state, ending);
  else await plainEnding(state, ending); // launch_failure, came_home_early, bankrupt, window_closed

  // Steps 4 and 5: the report, then the Try Again menu. Each one waits for the player's click.
  await report(state, result, data, ending);
  await menu(state, done);
}

// ---------- Data (every file is optional: a missing one never breaks the slice)

// Reads one JSON file. If it's missing or broken, warns in the console and returns `fallback` instead.
async function loadJson(path, fallback) {
  // try { ... } catch { ... }: try the risky part; if anything goes wrong, jump to catch instead of crashing.
  try {
    const res = await fetch(here(path));           // ask the server for the file
    if (!res.ok) throw new Error(`${res.status}`);  // e.g. 404 = file not found: treat it as an error
    return await res.json();                        // turn the file's text into a JavaScript object
  } catch (err) {
    console.warn(`finale: could not load ${path}. Using a fallback.`, err);
    return fallback;
  }
}

// Loads all six text files at the same time and merges the three history card lists into one.
async function loadData() {
  // Promise.all starts every load at once and waits for all of them. The [ ... ] on the left
  // unpacks the answers in the same order; ...cardLists collects the last three into one list.
  const [endings, badges, text, ...cardLists] = await Promise.all([
    loadJson('./endings.json', {}),
    loadJson('./badges.json', []),
    loadJson('./launch-text.json', { stages: {}, emergencies: {} }),
    loadJson('../trail/history.json', []),
    loadJson('../launchweek/history.json', []),
    loadJson('./history.json', []),
  ]);
  return { endings, badges, text, cards: cardLists.flat() }; // flat() turns 3 lists into 1
}

// When the money ran out in these places and nobody was hired for PR, Rosa's tip teaches the
// fundraising rule from Amendment A13 instead of the usual tip.
const NO_PR_TIP_REASONS = ['broke_build', 'broke_trail'];

/**
 * Job: this ending's words from endings.json (title, text and Rosa's 3 lines).
 *   No-launch endings also have a `reasons` list: the reason from endReason() can replace the
 *   title, text or Rosa's lines. Anything a reason leaves out falls back to the outcome's own words.
 * @param {Object} endings - everything in endings.json.
 * @param {Object} state - the shared backpack (outcome, flags, staff...). Only read.
 * @returns {Object} - { title, text, rosa, reason }. reason is null when the rocket launched.
 */
function endingFor(endings, state) {
  const base = endings[state.outcome] ?? { title: state.outcome, text: '', rosa: [] };
  const reason = endReason(state);
  const ending = { ...base, ...(base.reasons?.[reason] ?? {}), reason }; // the reason's words win
  const hasPR = (state.staff ?? []).some((s) => s.role === 'pr');
  if (NO_PR_TIP_REASONS.includes(reason) && !hasPR && base.noPrTip && ending.rosa?.length) {
    ending.rosa = [...ending.rosa.slice(0, -1), base.noPrTip]; // swap the last line (the tip)
  }
  return ending;
}

// Adds finale.css to the page once, so this slice brings its own styles without editing index.html.
function addStyles() {
  if (document.querySelector('link[data-finale]')) return; // already added: nothing to do
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = here('./finale.css').href;
  link.dataset.finale = '';
  document.head.append(link);
}

// ---------- Small helpers

// Shortcut to make an HTML element with a style class and text, e.g. el('p', 'fin-go', 'Hello').
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Gives you sleep(ms) to pause, and skip() to make every remaining pause end instantly (the Skip button).
function makeSkipper() {
  const waiting = new Set();       // every pause that is currently waiting
  const s = { skipped: false };
  // skip(): remember we skipped, and wake up every pause right now.
  s.skip = () => { s.skipped = true; waiting.forEach((wake) => wake()); waiting.clear(); };
  // sleep(ms): after Skip, return instantly. Otherwise wait ms milliseconds (or until Skip is pressed).
  s.sleep = (ms) => (s.skipped ? Promise.resolve() : new Promise((resolve) => {
    const wake = () => { clearTimeout(timer); waiting.delete(wake); resolve(); };
    const timer = setTimeout(wake, ms);
    waiting.add(wake);
  }));
  return s;
}

// ---------- 1. The launch. playLaunch() is the DIRECTOR: it reads the dice result and tells the
// animation (launch-anim.js) what to show, beat by beat. The animation never rolls dice itself,
// so the pictures always match the numbers.

// Launch timing, slowed down so kids can read every line. Change these to speed it up or slow it down.
const COUNTDOWN_FROM = 5;   // the countdown starts at T-5
const TICK_MS = 1000;        // one countdown number per second (1000 milliseconds)
const LINE_MS = 3000;        // a new sentence every 3 seconds

/**
 * Job: plays the launch animation, stage by stage, with captions. It only REPLAYS the result.
 *   Countdown T-5 to T-0, then a new sentence every 3 seconds: each stage shows GO or FAIL with a
 *   caption while the rocket climbs. Then it ends one of three ways:
 *     failed stage    -> the engines sputter out and the screen fades: "Launch failure. The crew is safe."
 *     came home early -> the capsule turns for home, glowing orange, and the screen fades
 *     orbit           -> the Kirby-style fly-away, a twinkle, then a white flash into the 3D globe
 *   A Skip button appears after 3 seconds.
 * @param {Object} state - the shared backpack (the animation reads site, rocket and weather).
 * @param {Object} result - what resolveLaunch returned.
 * @param {Object} text - the captions from launch-text.json.
 * @returns {Promise} - finishes when the launch is done showing.
 * ⭐
 */
async function playLaunch(state, result, text) {
  // Set up the screen: music, the animation full screen (dashboard hidden), and text on top of it.
  ui.music('launch_theme');
  const root = ui.screen(null, { dashboard: false });
  root.classList.add('fin-launch');
  const sk = makeSkipper();
  const count = el('div', 'fin-count');   // the big T-5 number, top center
  const alt = el('div', 'fin-alt');       // the altitude counter, top right
  const log = el('div', 'fin-log');       // the captions, bottom left (next to the rocket, not on it)
  const anim = mountLaunchAnim(root, state, { sleep: sk.sleep, altitudeEl: alt });
  root.append(count, alt, log);

  // The Skip button: hidden at first, shows up after 3 seconds.
  const skip = ui.button('Skip', () => sk.skip(), { variant: 'quiet' });
  skip.classList.add('fin-skip');
  skip.hidden = true;
  root.append(skip);
  setTimeout(() => { skip.hidden = false; }, 3000); // brief: Skip appears after 3 seconds

  // line(): adds one caption. kind ('go', 'fail', 'warn') picks its color. Only the newest 4
  // stay, so the box never grows over the rocket.
  const line = (words, kind) => {
    log.append(el('div', kind ? `fin-${kind}` : '', words));
    while (log.children.length > 4) log.firstChild.remove();
  };

  // The countdown: T-5, T-4 ... T-1, one per second, then T-0 and ignition.
  line(text.countdown ?? 'Here we go.');
  for (let n = COUNTDOWN_FROM; n >= 1; n--) {
    count.textContent = `T-${n}`;
    anim.countdown(n);                     // near the end, the crew arm swings back to the tower
    ui.sfx('fin-countdown');
    await sk.sleep(TICK_MS);
  }
  count.textContent = 'T-0';
  ui.sfx('fin-ignite');

  // The four stages, one sentence every LINE_MS (3 seconds). Stops at the first FAIL.
  let failed = false;
  for (const stage of result.stages) {
    const words = text.stages?.[stage.id] ?? { name: stage.id.toUpperCase(), pass: '', fail: '' };
    if (stage.skipped) {             // secret ending: the rest of the stages never happen
      line(text.skipped ?? '...', 'warn');
      break;
    }
    anim.stage(stage.id, stage.passed);  // start this stage's animation (it sputters if it's going to fail)
    if (stage.id === 'liftoff') await showEmergencies(result, 'liftoff', text, line, sk, anim); // lightning
    await sk.sleep(LINE_MS);
    count.textContent = '';              // the countdown is over once the first result is in
    if (stage.passed) {
      ui.sfx('fin-go');
      line(`${words.name}: GO. ${words.pass}`, 'go');
    } else {
      ui.sfx('fin-fail');
      line(`${words.name}: FAIL. ${words.fail}`, 'fail');
      failed = true;
      break;                         // `break` leaves the loop early: no more stages after a fail
    }
  }

  // How the launch ends.
  if (failed) {
    await anim.fail(text.failure ?? 'Launch failure. The crew is safe.');
  } else {
    // Problems up in orbit (if any) play out with the capsule alone above the Earth.
    const troubleInOrbit = result.emergencies.some((e) => e.stage === 'orbit');
    if (troubleInOrbit) {
      anim.toSpace();
      await showEmergencies(result, 'orbit', text, line, sk, anim);
    }
    if (result.outcome === 'came_home_early') {
      await anim.headHome(text.homeEarly ?? 'Heading home early. The crew is safe.');
    } else {
      await sk.sleep(troubleInOrbit ? LINE_MS : 1500); // time to read the last line before flying off
      ui.sfx('fin-whoosh');
      await anim.zoomOut();          // fly off into space, twinkle, white flash (orbitEnding fades it away)
    }
  }
  anim.destroy();
}

// Shows each emergency at one stage: the alarm (with its animation), then a pause, then fixed or not.
async function showEmergencies(result, stage, text, line, sk, anim) {
  // .filter() keeps only the emergencies that happened at this stage.
  for (const e of result.emergencies.filter((x) => x.stage === stage)) {
    const words = text.emergencies?.[e.type] ?? { alert: e.type, saved: '', unfixed: '' };
    await sk.sleep(stage === 'liftoff' ? 1200 : LINE_MS); // lightning hits soon after liftoff
    if (e.type === 'lightning') {
      ui.sfx('fin-thunder');
      anim.lightning();
    } else {
      anim.alarm(e.type);            // power: the lights flicker. life support: a red alarm blinks
    }
    line(words.alert, 'warn');
    await sk.sleep(LINE_MS); // the tense pause before we find out
    anim.settle(e.type, e.saved);    // fixed: lights back to normal. Not fixed: lights out, or the alarm keeps going
    line(e.saved ? words.saved : words.unfixed, e.saved ? 'go' : 'fail');
  }
}

// Starts a new screen covered (white or dark) and fades the cover away: the second half of a
// transition. The launch fades TO white or dark; the next screen fades back FROM it.
function unveil(root, kind) {
  const cover = el('div', `fin-veil fin-veil-${kind} on fin-unveil`);
  root.append(cover);
  setTimeout(() => cover.remove(), 1200);
}

// ---------- 2. Endings

/**
 * Job: the winning screen. Starts the 3D globe with fireworks, shows the title, pops up the
 *   ending text in a small Rosa box after 1.5 seconds (click it to close it), and waits for
 *   the Mission report button, which shuts the globe down before moving on.
 * @param {Object} state - the shared backpack (the globe reads site, orbit and crew names).
 * @param {Object} ending - this outcome's entry from endings.json (title and text).
 * @returns {Promise} - finishes when the player presses Mission report.
 */
function orbitEnding(state, ending) {
  // Celebration sounds (silent until the sound files exist).
  const aliens = state.outcome === 'aliens';
  ui.music('ending_orbit');
  ui.sfx(aliens ? 'fin-alien' : 'fin-fanfare');

  // "I'll finish later": this screen finishes when resolve() is called by the button below.
  return new Promise((resolve) => {
    // The 3D globe fills the screen, fading in from the launch's white flash.
    const root = ui.screen();
    root.classList.add('fin-explore');
    const explorer = mountOrbitExplorer(root, state, { celebrate: true, aliens });
    unveil(root, 'white');

    // Title at the top, controls hint at the bottom.
    root.append(el('div', 'fin-explore-title', ending.title));
    root.append(el('div', 'fin-explore-hint', 'Drag to spin. Scroll to zoom. Click things. Can you find the Moon?'));

    // Rosa's line sits in a small box the player can close, so it never blocks dragging.
    const note = el('div', 'panel fin-rosa-note');
    note.append(ui.portrait('rosa', 64), el('p', '', ending.text));
    note.addEventListener('click', () => note.remove());
    setTimeout(() => root.append(note), 1500);

    // The button that moves on: stop the globe first, then finish this screen.
    const next = ui.button('Mission report', () => { explorer.destroy(); resolve(); });
    next.classList.add('fin-explore-next');
    root.append(next);
  });
}

// Background art for each ending: art/backgrounds/finale/<name>.png (placeholder until drawn).
const ENDING_ART = {
  launch_failure: 'ending_launch_failure',
  came_home_early: 'ending_came_home_early',
  bankrupt: 'ending_bankrupt',
  window_closed: 'ending_window',
};

// The simple ending screen for launch_failure, came_home_early, bankrupt and window_closed:
// background, title, text and a Mission report button.
async function plainEnding(state, ending) {
  ui.sfx('fin-fail');
  const root = ui.screen(`finale/${ENDING_ART[state.outcome] ?? 'ending_launch_failure'}`);
  root.classList.add('fin-ending');
  unveil(root, 'dark');                // fades in from the launch's dark fade
  const box = ui.panel();
  box.append(el('h1', '', ending.title), el('p', '', ending.text));
  root.append(box);
  // Wait here until the player clicks the button.
  await new Promise((resolve) => box.append(ui.button('Mission report', resolve)));
}

// ---------- 3. Mission report

// What each medal id says on screen.
const MEDAL_NAMES = { gold: 'Gold medal', silver: 'Silver medal', bronze: 'Bronze medal' };
// Rounds a score to one decimal for display, e.g. 8.3333 -> "8.3".
const fmt = (n) => (Math.round(n * 10) / 10).toString();

/**
 * Job: the mission report screen. Gets the score from computeScore and saves it in state.score,
 *   then draws four areas:
 *     Left   - score rows that pop in one by one, the total, the medal (or why there isn't one), badges
 *     Middle - the NASA history card from pickHistoryCard, with source links (only real https links)
 *     Right  - launched: "What shaped your odds" from oddsWords (words only, never the probability)
 *              no launch: "How far you got", the progress track from progressTrack
 *     Bottom - Rosa's three debrief lines and a What next? button
 *   No launch (bankrupt, window_closed): the rows that need a launch show "-", and the badges are greyed out.
 * @param {Object} state - the shared backpack. Sets state.score.
 * @param {Object} result - what resolveLaunch (or noLaunch) returned.
 * @param {Object} data - everything loadData() read: endings, badges, text, cards.
 * @param {Object} ending - from endingFor(): Rosa's lines and the reason the game ended.
 * @returns {Promise} - finishes when the player presses What next?
 * ⭐
 */
function report(state, result, data, ending) {
  // Work out the score (launch-sim.js) and remember it in the shared state.
  ui.music('report_loop');
  const score = computeScore(state, result);
  state.score = score.total;
  const launched = didLaunch(state.outcome);

  // A fresh screen with the report background. finale.css lays it out in columns.
  const root = ui.screen('finale/report_bg');
  root.classList.add('fin-report');

  // Left: score rows appear one by one, then the total, medal and badges.
  const left = ui.panel('Mission score');
  score.lines.forEach((l, i) => {             // i = row number (0, 1, 2...), used to delay each row
    const row = el('div', l.locked ? 'fin-row fin-locked' : 'fin-row');
    if (l.locked) {
      // A row a grounded rocket can't earn: a grey "needs a launch" where the points would be.
      // (On the same line, not under it, so the whole panel still fits without scrolling.)
      row.append(el('span', '', l.label), el('span', 'fin-needs', 'needs a launch'));
    } else {
      row.append(el('span', '', l.label), el('span', '', `${fmt(l.points)} / ${l.max}`));
    }
    row.style.animationDelay = `${i * 0.35}s`; // each row pops in 0.35 seconds after the one above
    left.append(row);
  });
  const total = el('div', 'fin-row fin-total');
  total.append(el('span', '', 'Total'), el('span', '', `${fmt(score.total)} / 100`));
  total.style.animationDelay = `${score.lines.length * 0.35}s`;
  left.append(total);
  setTimeout(() => ui.sfx('fin-medal'), score.lines.length * 350 + 300); // medal sound after the rows
  // No medal: just the reason (e.g. "Launch the rocket to earn a medal."). Short, so the panel fits.
  left.append(el('div', `fin-medal fin-medal-${score.medal ?? 'none'}`,
    score.medal ? MEDAL_NAMES[score.medal] : score.medalReason));
  // Badges: lit if earned, dim with a hint if not. Labels come from badges.json.
  // No launch: all greyed out with one caption, and no per-badge hints (they'd be confusing here).
  const badges = el('div', launched ? 'fin-badges' : 'fin-badges fin-badges-locked');
  for (const b of data.badges) {
    const earned = score.badges.find((x) => x.id === b.id)?.earned;
    const chip = el('div', `fin-badge ${earned ? 'on' : 'off'}`, b.label);
    chip.title = earned ? 'Earned!' : launched ? b.hint : 'Launch your ship to unlock badges'; // hover text
    if (!earned && launched) chip.append(el('div', 'fin-badge-hint', b.hint));
    badges.append(chip);
  }
  left.append(badges);
  if (!launched) left.append(el('p', 'fin-badges-note', 'Launch your ship to unlock badges'));

  // Middle: the real NASA story that matches what happened.
  const card = pickHistoryCard(data.cards, state, result);
  const middle = ui.panel(card ? card.title : 'From the history books');
  // Cards with a `todo` aren't checked against their NASA source yet. Warn in the console (F12)
  // so nobody forgets before the submission. Never invent a link (Rulebook 7.4).
  if (card?.todo) console.warn(`finale: history card "${card.id}" is not checked yet. TODO: ${card.todo}`);
  if (card) {
    if (card.tone === 'memorial') middle.classList.add('fin-card-memorial');
    middle.classList.add('fin-card');
    // The story and lesson scroll if they're long. The sources sit below them, always on screen,
    // because judges must see the NASA source without scrolling (Checkpoint 3).
    const body = el('div', 'fin-card-body');
    body.append(el('p', '', card.story), el('p', 'fin-card-lesson', card.lesson));
    const sources = el('div', 'fin-card-sources');
    // Source links open in a new tab.
    for (const s of card.sources ?? []) {
      if (!/^https:\/\//.test(s.url ?? '')) continue; // never show a TODO or broken link
      const a = el('a', 'fin-source', `Source: ${s.title}`);
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      sources.append(a);
    }
    middle.append(body, sources);
  } else {
    // No card matched: a short note instead.
    const success = state.outcome === 'orbit' || state.outcome === 'aliens';
    middle.append(el('p', '', success
      ? 'No history lesson needed today. Your launch went by the book.'
      : 'Every mission teaches something. Look at what shaped your odds, then try again.'));
  }

  // Right: what shaped the odds, in words only (never show the probability).
  // With no launch there were no odds, so it shows how far the player got instead.
  const right = launched ? ui.panel('What shaped your odds') : trackPanel(state, ending.reason);
  if (launched) {
    for (const o of oddsWords(state)) {
      const row = el('div', 'fin-odds');
      row.append(el('div', '', o.label), el('div', `fin-${o.tone}`, o.words)); // tone picks the color
      right.append(row);
    }
  }

  // Bottom: Rosa's debrief.
  const debrief = el('div', 'panel fin-debrief');
  debrief.append(ui.portrait('rosa', 96));
  const lines = el('div', 'fin-debrief-lines');
  for (const text of ending.rosa ?? []) lines.append(el('p', '', text));
  debrief.append(lines);

  // Put all four areas on the page, then wait for the What next? button.
  root.append(left, middle, right, debrief);
  return new Promise((resolve) => debrief.append(ui.button('What next?', resolve)));
}

/**
 * Job: the "How far you got" panel for endings with no launch. One row per step, joined by a
 *   thin line (finale.css): a filled square when done, the player's rocket where the game
 *   stopped (with a red label), and an empty square for steps never reached.
 *   Squares are drawn with CSS because Press Start 2P has no check mark or emoji.
 * @param {Object} state - the shared backpack. Only read.
 * @param {string} reason - from endReason(), picks the red label.
 * @returns {HTMLElement} - the finished panel.
 */
function trackPanel(state, reason) {
  const box = ui.panel('How far you got');
  const list = el('ol', 'fin-track');
  for (const step of progressTrack(state, reason)) {
    const row = el('li', `fin-step fin-step-${step.status}`);  // fin-step-done, -stopped or -todo
    const mark = el('div', 'fin-step-mark');
    mark.append(
      step.status === 'stopped' ? rocketMarker(state) : el('span', 'fin-step-box'),
      el('span', 'fin-step-line'), // stretches down to the next step, whatever the marker's size
    );
    const words = el('div', 'fin-step-words');
    words.append(el('div', 'fin-step-label', step.label));
    if (step.detail) words.append(el('div', 'fin-step-detail', step.detail));
    if (step.stopLabel) words.append(el('div', 'fin-step-stop', step.stopLabel));
    row.append(mark, words);
    list.append(row);
  }
  box.append(list);
  return box;
}

/**
 * Job: a small picture of the player's own rocket for the track. Starts as the code-drawn
 *   placeholder (launch-art.js), then swaps in the team's art/sprites/rocket_<id>.png if it exists.
 * @param {Object} state - reads state.rocket.
 * @returns {HTMLElement} - a canvas (or an <img> once the team's picture loads).
 */
function rocketMarker(state) {
  // The same colors the launch uses, picked from the team's palette.
  const pal = readPalette();
  const C = pickColors(pal, LAUNCH_COLORS);
  const ink = Object.fromEntries(Object.entries(C).map(([role, i]) => [role, pal.hex[i]]));
  const parts = buildRocket(ink, state.rocket);

  // Stack the pieces into one picture: upper stage on top of the first stage, boosters at its sides.
  // The first stage can be wider than the top (its fins stick out), so the canvas fits the widest
  // piece and each piece is centered. Otherwise the fins and half the body get cut off.
  const { upper, lower, boosters } = parts;
  const side = boosters?.[0]?.width ?? 0;
  const middle = Math.max(upper.width, lower.width);
  const { canvas, g } = makeCanvas(middle + side * 2, upper.height + lower.height);
  g.drawImage(upper, side + Math.floor((middle - upper.width) / 2), 0);
  g.drawImage(lower, side + Math.floor((middle - lower.width) / 2), upper.height);
  if (boosters) {
    const [l, r] = boosters;
    g.drawImage(l, 0, canvas.height - l.height);
    g.drawImage(r, side + middle, canvas.height - r.height);
  }
  canvas.className = 'fin-step-rocket';

  // The team's picture, if it's been drawn. A missing file just keeps the placeholder.
  const img = new Image();
  img.className = 'fin-step-rocket';
  img.alt = '';
  img.onload = () => canvas.replaceWith(img);
  img.src = new URL(`../../art/sprites/rocket_${state.rocket ?? 'condor'}.png`, import.meta.url).href;
  return canvas;
}

// ---------- 4. Try Again (Slice 5 brief section 11)

/**
 * Job: the Try Again menu. Rosa asks what's next, with four choices:
 *   Change my crew or staff -> load the 'afterHiring' save, back to Slice 1
 *   Change my build         -> load the 'afterBuild' save, back to Slice 2
 *   Same plan, new luck     -> load the 'afterBuild' save, back to the trail
 *   Start over              -> a brand new game
 *   A choice is greyed out if its save is missing (for example after using the dev panel).
 * @param {Object} state - the shared backpack. Loading a save replaces everything in it.
 * @param {Function} done - leaves the slice and tells screens.js where to go.
 * @returns {Promise} - finishes after done() is called.
 */
async function menu(state, done) {
  // has('afterBuild') -> true if that save exists. !! turns "something or nothing" into true or false.
  const has = (name) => !!state.checkpoints?.[name];
  const why = 'No saved plan to go back to';
  const choices = [
    { label: 'Change my crew or staff', disabled: !has('afterHiring'), why },
    { label: 'Change my build', disabled: !has('afterBuild'), why },
    { label: 'Same plan, new luck', disabled: !has('afterBuild'), why },
    { label: 'Start over' },
  ];
  // Rosa asks; `pick` is the number of the button clicked (0 = first).
  const pick = await ui.ask('rosa', 'Want to try again? Change one thing and see what happens.', choices);

  // A checkpoint restores the whole state, so outcome, score, weather and so on reset too.
  if (pick === 0) { loadCheckpoint(state, 'afterHiring'); state.resume = 'hiring'; return done('briefing'); }
  if (pick === 1) { loadCheckpoint(state, 'afterBuild'); state.resume = 'build'; return done('build'); }
  if (pick === 2) { loadCheckpoint(state, 'afterBuild'); state.resume = null; return done('trail'); }
  return done('briefing', { fresh: true });
}
