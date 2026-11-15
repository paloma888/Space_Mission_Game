// slices/briefing/hiring.js: the hiring screen (Slice 1 brief section 10).
// Rules and money math live in hiring-rules.js. This file only draws and reacts to clicks.

import * as ui from '../../core/ui.js';
import { pick } from '../../core/state.js';
import * as rules from './hiring-rules.js';

const STAT_LABELS = { pilot: 'Piloting', eng: 'Engineering', nerves: 'Nerves' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Budget changes go through applyEffects in core/events.js (Person 3). The fallback only
// handles budget, and exists so hiring still works if that file ever fails to load.
async function loadApplyEffects() {
  try {
    const eventsModule = await import('../../core/events.js');
    if (typeof eventsModule.applyEffects === 'function') return eventsModule.applyEffects;
  } catch (err) {
    console.warn('core/events.js did not load. Hiring uses a budget-only fallback.', err);
  }
  return (state, effects) => { state.budget += effects.budget ?? 0; };
}

// The cast sheet gives each person's tic, shown as their quote. Missing file: no quote.
async function loadCastSheet() {
  try {
    const castList = await (await fetch(new URL('../../core/characters.json', import.meta.url))).json();
    return Object.fromEntries(castList.map((castMember) => [castMember.id, castMember]));
  } catch {
    return {};
  }
}

// Resolves when the player presses Continue with a legal crew.
// Resuming works for free: whoever is already in state.crew and state.staff shows as hired.
export async function runHiring(state, { candidates, staff, hiringText }) {
  const [applyEffects, castSheet] = await Promise.all([loadApplyEffects(), loadCastSheet()]);

  return new Promise((resolve) => {
    const root = ui.screen('briefing/hiring_hall'); // dashboard on from here (brief section 3)
    root.classList.add('hiring');
    const layout = el('div', 'hiring-layout');
    const tabRow = el('div', 'hiring-tabs');
    const cardGrid = el('div', 'hiring-cards');
    const detailColumn = el('div', 'hiring-detail');
    const footer = el('div', 'hiring-footer');
    layout.append(tabRow, cardGrid, detailColumn, footer);
    root.append(layout);

    let activeKind = 'astronaut';
    let selectedId = candidates[0]?.id;
    let rosaIsTalking = false;
    const cardsById = new Map();

    const peopleFor = (kind) => (kind === 'astronaut' ? candidates : staff);
    const selectedPerson = () => peopleFor(activeKind).find((person) => person.id === selectedId);

    // While Rosa talks, the screen ignores clicks (they advance her lines instead).
    async function rosaSays(lines) {
      rosaIsTalking = true;
      layout.classList.add('is-talking');
      try {
        for (const line of lines) await ui.say(line.speaker, line.text, line);
      } finally {
        rosaIsTalking = false;
        layout.classList.remove('is-talking');
      }
    }

    // ---------- Tabs

    function renderTabs() {
      tabRow.replaceChildren(
        ui.button('Astronauts', () => switchTab('astronaut'), { variant: activeKind === 'astronaut' ? 'primary' : 'quiet' }),
        ui.button('Staff', () => switchTab('staff'), { variant: activeKind === 'staff' ? 'primary' : 'quiet' }),
      );
    }

    function switchTab(kind) {
      if (kind === activeKind) return;
      activeKind = kind;
      selectedId = peopleFor(kind)[0]?.id;
      renderAll();
    }

    // ---------- Cards

    function buildCard(person) {
      const card = el('div', 'hire-card');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', person.name);

      const head = el('div', 'hire-card-head');
      const info = el('div', 'hire-card-info');
      info.append(el('div', 'hire-card-name', person.name), el('div', 'hire-card-cost', `$${person.cost}M`));
      const whyButton = ui.button('Why?', () => explain(person), { variant: 'quiet' });
      info.append(whyButton);
      head.append(ui.portrait(person.portrait ?? person.id, 64), info);
      card.append(head);

      if (activeKind === 'astronaut') {
        for (const skill of ['pilot', 'eng', 'nerves']) {
          card.append(ui.bar(person[skill], 5, `${STAT_LABELS[skill]} ${person[skill]}`));
        }
      } else {
        card.append(el('div', 'hire-card-role', person.title));
        card.append(ui.bar(person.skill, 5, `Skill ${person.skill}`));
        card.append(el('div', 'hire-card-effect', person.effect));
      }
      card.append(el('div', 'hire-card-badge', 'HIRED'));

      const select = () => {
        if (rosaIsTalking) return;
        selectedId = person.id;
        updateCards();
        renderDetail();
      };
      card.addEventListener('click', select);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
      return card;
    }

    function renderCards() {
      cardsById.clear();
      cardGrid.classList.toggle('is-staff', activeKind === 'staff');
      cardGrid.replaceChildren(...peopleFor(activeKind).map((person) => {
        const card = buildCard(person);
        cardsById.set(person.id, card);
        return card;
      }));
      updateCards();
    }

    // Only classes change here, so portraits aren't rebuilt (and re-requested) on every click.
    function updateCards() {
      for (const person of peopleFor(activeKind)) {
        const card = cardsById.get(person.id);
        const hired = rules.isHired(state, activeKind, person.id);
        card.classList.toggle('is-selected', person.id === selectedId);
        card.classList.toggle('is-hired', hired);
        card.classList.toggle('is-unaffordable', !hired && person.cost > state.budget);
      }
    }

    // ---------- Detail panel

    function renderDetail() {
      const person = selectedPerson();
      if (!person) { detailColumn.replaceChildren(); return; }
      const detailPanel = ui.panel(person.name);
      const subtitle = activeKind === 'astronaut' ? (castSheet[person.id]?.title ?? 'Astronaut candidate') : person.title;
      detailPanel.append(ui.portrait(person.portrait ?? person.id, 128), el('div', 'hiring-subtitle', subtitle));
      detailPanel.append(el('p', 'hiring-bio', person.bio));
      if (activeKind === 'staff') detailPanel.append(labeledLine('Effect', person.effect));
      detailPanel.append(labeledLine('Strength', person.strength), labeledLine('Flaw', person.flaw));
      const tic = castSheet[person.id]?.tic;
      if (tic) detailPanel.append(el('p', 'hiring-quote', `"${tic}"`));
      detailPanel.append(hireButton(person));
      detailColumn.replaceChildren(detailPanel);
    }

    function labeledLine(label, text) {
      const line = el('p', 'hiring-line');
      line.append(el('span', 'hiring-line-label', `${label}: `), document.createTextNode(text ?? ''));
      return line;
    }

    function hireButton(person) {
      const wrap = el('div', 'hiring-hire');
      if (rules.isHired(state, activeKind, person.id)) {
        wrap.append(ui.button(`Release (+$${person.cost}M)`, () => toggleHire(person), { variant: 'quiet' }));
        return wrap;
      }
      const blockReason = rules.hireBlockReason(state, activeKind, person);
      const button = ui.button(`Hire ($${person.cost}M)`, () => toggleHire(person));
      if (blockReason) {
        button.disabled = true;
        button.title = blockReason;
      }
      wrap.append(button);
      if (blockReason) wrap.append(el('div', 'why', blockReason));
      return wrap;
    }

    // Quick hiring would stack toasts on top of each other, so a new one replaces the last.
    function showPersonLine(person, text) {
      document.querySelectorAll('#app > .toast').forEach((oldToast) => oldToast.remove());
      ui.toast(`${person.name}: ${text}`, 2500);
    }

    function toggleHire(person) {
      if (rosaIsTalking) return;
      if (rules.isHired(state, activeKind, person.id)) {
        rules.release(state, activeKind, person.id, applyEffects);
        ui.sfx('briefing-release');
        showPersonLine(person, pick(person.lines?.released ?? ['...']));
      } else if (rules.hire(state, activeKind, person, applyEffects)) {
        ui.sfx('briefing-hire');
        showPersonLine(person, pick(person.lines?.hired ?? ['...']));
      }
      ui.refresh();
      updateCards();
      renderDetail();
      renderFooter();
    }

    // ---------- Why? button: Rosa explains the astronaut's best skill or the staff role

    function explain(person) {
      if (rosaIsTalking) return;
      const topic = activeKind === 'astronaut' ? rules.bestSkill(person) : person.role;
      rosaSays(hiringText.why[topic] ?? []);
    }

    // ---------- Footer: crew seats, staff list, money, Continue

    function renderFooter() {
      const seats = el('div', 'hiring-seats');
      for (let seatIndex = 0; seatIndex < rules.CREW_SIZE; seatIndex++) {
        const astronaut = state.crew[seatIndex];
        // First name only: full names don't fit in a seat.
        const seat = el('div', `hiring-seat${astronaut ? ' is-filled' : ''}`, astronaut ? astronaut.name.split(' ')[0] : 'Empty seat');
        if (astronaut) seat.title = astronaut.name;
        seats.append(seat);
      }
      const staffCount = state.staff.length;
      const staffHeading = el('div', 'hiring-staff-heading', staffCount > 0 ? `Staff: ${staffCount} hired` : 'Staff: No staff yet');
      const summary = el('div', 'hiring-summary');
      summary.append(staffHeading);
      if (staffCount > 0) {
        summary.append(el('div', 'hiring-staff-list', state.staff.map((member) => member.name).join(', ')));
      }
      summary.append(el('div', null, `Spent $${rules.totalSpent(state)}M`));
      const continueWrap = el('div', 'hiring-continue');
      const continueButton = ui.button('Continue', onContinue);
      if (!rules.canContinue(state)) {
        continueButton.disabled = true;
        continueWrap.append(continueButton, el('div', 'why', 'Pick three astronauts.'));
      } else {
        continueWrap.append(continueButton);
      }
      footer.replaceChildren(seats, summary, continueWrap);
    }

    // Brief section 10, rule 6: one combined warning if key staff are missing.
    async function onContinue() {
      if (rosaIsTalking || !rules.canContinue(state)) return;
      const missingRoles = rules.missingKeyRoles(state);
      if (missingRoles.length > 0) {
        const warning = hiringText.missingWarning;
        rosaIsTalking = true;
        layout.classList.add('is-talking');
        try {
          await ui.say('rosa', rules.missingWarningText(missingRoles, warning));
          const choiceIndex = await ui.ask('rosa', warning.question, [{ label: 'Yes' }, { label: 'Go back' }]);
          if (choiceIndex === 1) return;
        } finally {
          rosaIsTalking = false;
          layout.classList.remove('is-talking');
        }
      }
      resolve();
    }

    function renderAll() {
      renderTabs();
      renderCards();
      renderDetail();
      renderFooter();
    }

    renderAll();
    ui.refresh();
  });
}
