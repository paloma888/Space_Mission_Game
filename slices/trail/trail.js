// Slice 3: The Trail (owner: Person 3)
// Five weekly turns between hiring and launch week (Rulebook section 3,
// Slice 3 brief section 3). Each week: header, assign staff, resolve, one
// event, summary. The math lives in week.js and the numbers in tasks.json.
//
// The rival ticker lives in rival.js.
//
// Still to come: the moving marker on the trail map.

import * as ui from '../../core/ui.js';
import { checkEnd } from '../../core/state.js';
import { applyEffects, describeChanges, loadAllEvents, pickEvent, runEvent } from '../../core/events.js';
import { TASK_IDS, PROGRESS_IDS, planWeek, projectWeek, resolveWeek, sumChanges } from './week.js';
import { loadRival, mountTicker, rivalPercent } from './rival.js';

export const meta = { id: 'trail', owner: 'Person 3' };

const LAST_WEEK = 5;
const PROGRESS_NAMES = { build: 'Build', testing: 'Testing', training: 'Training' };

// The slice brings its own stylesheet so index.html and test.html need no changes.
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('./trail.css', import.meta.url);
document.head.append(css);

// Rosa explains skipped testing once per game, not every week.
let warnedAboutTesting = false;

// Zenith's progress this week (0 to 100), or null when rival.json is missing.
let zenithPercent = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Three progress bars. Returns the pieces so callers can update them later.
function progressBars(state) {
  const box = el('div');
  const parts = {};
  for (const id of PROGRESS_IDS) {
    const wrap = el('div', 'trail-progress');
    const bar = ui.bar(state.progress[id], 100, `${PROGRESS_NAMES[id]} ${state.progress[id]}`);
    const note = el('p', 'small', '');
    wrap.append(bar, note);
    box.append(wrap);
    parts[id] = { bar, note };
    // The rival's bar goes right under Build so the player can compare the two at a glance.
    if (id === 'build' && zenithPercent !== null) {
      const rival = el('div', 'trail-rival');
      rival.append(ui.bar(zenithPercent, 100, `Zenith ${zenithPercent}`));
      box.append(rival);
    }
  }
  return { box, parts };
}

// Step B: the player gives every hired person one task. Resolves with { staffId: taskId }.
function assignScreen(state, tasks, week) {
  return new Promise((resolve) => {
    const root = ui.screen('trail/workshop');
    root.classList.add('trail');
    const assignments = {};

    const staffPanel = ui.panel(`Week ${week}: who does what?`);
    const tip = el('p', 'trail-tip small', 'Pick one job for each person.');

    const side = ui.panel('This week');
    const { box, parts } = progressBars(state);
    const totals = el('p', 'trail-totals');
    const start = ui.button('Start the Week', () => resolve(assignments));

    // Called after every click so the preview always matches the choices.
    function update() {
      const plan = planWeek(state, assignments, tasks);
      for (const id of PROGRESS_IDS) parts[id].note.textContent = `+${plan[id]} this week`;
      const after = projectWeek(state, plan, tasks);
      totals.textContent = `Budget $${after.budget}M. Morale ${after.morale}.`;
      start.disabled = state.staff.some((person) => !assignments[person.id]);
    }

    for (const person of state.staff) {
      const row = el('div', 'trail-row');
      const who = el('div', 'trail-who');
      who.append(el('div', null, person.name), el('div', null, person.title || person.role),
        ui.bar(person.skill, 5, `Skill ${person.skill}`));

      const buttons = el('div');
      for (const taskId of TASK_IDS) {
        const b = ui.button(tasks[taskId].label, () => {
          assignments[person.id] = taskId;
          buttons.querySelectorAll('.task-on').forEach((on) => on.classList.remove('task-on'));
          b.classList.add('task-on');
          tip.textContent = `Rosa: ${tasks[taskId].tip}`;
          update();
        }, { variant: 'quiet' });
        b.classList.add('task-btn');
        buttons.append(b);
      }
      row.append(ui.portrait(person.portrait || person.id, 64), who, buttons);
      staffPanel.append(row);
    }

    staffPanel.append(tip);
    side.append(box, totals, start);
    root.append(staffPanel, side);
    update();
  });
}

// Step C: show the bars filling up and a toast with the week's numbers.
async function showResolve(state, before, changes, week) {
  const root = ui.screen('trail/workshop');
  root.classList.add('trail');
  const panel = ui.panel(`Week ${week}: the team gets to work`);
  panel.classList.add('trail-summary');

  // Draw the bars at last week's values first, so the fill visibly grows.
  const { box, parts } = progressBars({ progress: before });
  panel.append(box);
  root.append(panel);
  ui.sfx('trail-progress');
  await wait(100);
  for (const id of PROGRESS_IDS) {
    parts[id].bar.querySelector('.bar-fill').style.width = `${state.progress[id]}%`;
    parts[id].bar.querySelector('.bar-label').textContent = `${PROGRESS_NAMES[id]} ${state.progress[id]}`;
  }
  const lines = describeChanges(sumChanges(changes));
  if (lines.length) ui.toast(lines.join('   '), 2500);
  await wait(1800);
}

// Step E: a short list of everything that changed this week.
function summaryScreen(state, changes, week, isLast) {
  return new Promise((resolve) => {
    const root = ui.screen('trail/workshop');
    root.classList.add('trail');
    const panel = ui.panel(`Week ${week} is done`);
    panel.classList.add('trail-summary');

    const list = el('ul');
    for (const line of describeChanges(sumChanges(changes))) list.append(el('li', null, line));
    panel.append(list,
      el('p', null, `Budget $${state.budget}M. Morale ${state.morale}.`),
      ui.button(isLast ? 'On to launch week' : 'Next week', resolve));
    root.append(panel);
  });
}

export async function show(state, done) {
  const [tasks, bulletins] = await Promise.all([
    fetch(new URL('./tasks.json', import.meta.url)).then((res) => res.json()),
    loadRival(),
    loadAllEvents(),
  ]);
  ui.music('build_loop');

  const ticker = mountTicker(bulletins);
  // Whatever way the trail ends, the ticker must not follow the player into the next slice.
  const finish = (next) => { ticker.remove(); done(next); };

  // Start from state.week so presets like midTrail pick up in the middle.
  for (let week = state.week; week <= LAST_WEEK; week++) {
    state.week = week;
    zenithPercent = rivalPercent(bulletins, week);
    ticker.setWeek(week);

    // A. Week header
    ui.screen('trail/trail_map');
    ui.sfx('trail-week');
    await ui.say('rosa', `Week ${week} of ${LAST_WEEK}. Day ${state.day}.`);

    // B. Assign staff
    let assignments = {};
    if (state.staff.length > 0) {
      assignments = await assignScreen(state, tasks, week);
    } else {
      await ui.say('rosa', 'No staff this week. The crew will do what they can.');
    }

    // C. Resolve
    const before = { ...state.progress };
    const resolved = resolveWeek(state, planWeek(state, assignments, tasks), tasks);
    const weekChanges = [...resolved.changes];
    await showResolve(state, before, resolved.changes, week);
    if (resolved.skippedTesting && !warnedAboutTesting) {
      warnedAboutTesting = true;
      await ui.say('rosa', 'Nobody tested this week. Small flaws hide when no one looks. Measure twice, launch once.');
    }
    // Overhead may push the budget to 0 or below (Rulebook 6.2).
    if (checkEnd(state)) return finish('finale');

    // D. Event
    const event = pickEvent(state, week);
    if (event) {
      const played = await runEvent(state, event);
      weekChanges.push(...played.changes);
      if (played.ended) return finish('finale');
    }

    // E. Summary, then time moves on
    // Events can add days, so the launch window may open before week 5 is over.
    const isLast = week === LAST_WEEK || state.day + 7 >= state.windowOpens;
    await summaryScreen(state, weekChanges, week, isLast);
    applyEffects(state, { day: 7 });
    if (checkEnd(state)) return finish('finale');
    if (isLast) break;
  }

  finish();
}
