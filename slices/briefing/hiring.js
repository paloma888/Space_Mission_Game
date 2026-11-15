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
    const carousel = el('div', 'hiring-carousel');
    const cardRow = el('div', 'hiring-cards');
    const previousArrow = ui.button('◀', () => shiftRow(-1));
    const nextArrow = ui.button('▶', () => shiftRow(1));
    previousArrow.classList.add('hiring-arrow', 'hiring-arrow-prev');
    nextArrow.classList.add('hiring-arrow', 'hiring-arrow-next');
    previousArrow.setAttribute('aria-label', 'Previous card');
    nextArrow.setAttribute('aria-label', 'Next card');
    carousel.append(previousArrow, cardRow, nextArrow);
    const positionCounter = el('div', 'hiring-counter');
    const detailColumn = el('div', 'hiring-detail');
    const footer = el('div', 'hiring-footer');
    layout.append(tabRow, carousel, positionCounter, detailColumn, footer);
    root.append(layout);

    let activeKind = 'astronaut';
    let selectedId = candidates[0]?.id;
    // Index of the middle card of the three. 0 puts the first person in the middle.
    let middleIndex = 0;
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
      middleIndex = 0;
      renderAll();
    }

    // ---------- Carousel: each step moves the row by one card and loops at both ends,
    // so the arrows are never disabled. Hired comes from state, so it survives any position.

    function shiftRow(step) {
      if (rosaIsTalking) return;
      centerOn(middleIndex + step);
    }

    // The selected person is always the middle card, so the detail strip and Hire button
    // always describe the card in the center.
    function centerOn(personIndex) {
      const people = peopleFor(activeKind);
      middleIndex = rules.wrapIndex(personIndex, people.length);
      selectedId = people[middleIndex].id;
      renderCards();
      renderDetail();
    }

    // Arrow keys move the row too. Ignored while Rosa talks, since any key advances her lines then.
    function onArrowKey(event) {
      if (event.key === 'ArrowLeft') shiftRow(-1);
      else if (event.key === 'ArrowRight') shiftRow(1);
    }
    window.addEventListener('keydown', onArrowKey);

    function renderCounter() {
      positionCounter.textContent = `${middleIndex + 1} of ${peopleFor(activeKind).length}`;
    }

    // ---------- Cards

    function buildCard(person) {
      const card = el('div', 'hire-card');
      card.dataset.personId = person.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', person.name);

      // The name gets the full card width (two lines fit every name, even Sam 'Sparks' Whitaker).
      // Beside the portrait it only had room for about 10 characters a line.
      const head = el('div', 'hire-card-head');
      const info = el('div', 'hire-card-info');
      info.append(el('div', 'hire-card-cost', `$${person.cost}M`));
      const whyButton = ui.button('Why?', () => explain(person), { variant: 'quiet' });
      info.append(whyButton);
      head.append(ui.portrait(person.portrait ?? person.id, 64), info);
      card.append(el('div', 'hire-card-name', person.name), head);

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

      // Clicking a side card slides it into the middle, which selects it.
      const select = () => {
        if (rosaIsTalking || person.id === selectedId) return;
        centerOn(peopleFor(activeKind).indexOf(person));
      };
      card.addEventListener('click', select);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
      return card;
    }

    // Only the three visible cards exist. Hired and selected come from state and selectedId,
    // so they survive the row moving away and back.
    function renderCards() {
      cardsById.clear();
      cardRow.classList.toggle('is-staff', activeKind === 'staff');
      cardRow.replaceChildren(...rules.peopleAround(peopleFor(activeKind), middleIndex).map((person) => {
        const card = buildCard(person);
        cardsById.set(person.id, card);
        return card;
      }));
      updateCards();
      renderCounter();
    }

    // Only classes change here, so portraits aren't rebuilt (and re-requested) on every click.
    function updateCards() {
      for (const person of peopleFor(activeKind)) {
        const card = cardsById.get(person.id);
        if (!card) continue; // on another page
        const hired = rules.isHired(state, activeKind, person.id);
        card.classList.toggle('is-selected', person.id === selectedId);
        card.classList.toggle('is-hired', hired);
        card.classList.toggle('is-unaffordable', !hired && person.cost > state.budget);
      }
    }

    // ---------- Detail panel

    // A compact strip under the cards: small portrait | name and bio | strength, flaw, quote | Hire.
    // Not a ui.panel on purpose: panels are solid, and the strip must let the background show.
    function renderDetail() {
      const person = selectedPerson();
      if (!person) { detailColumn.replaceChildren(); return; }
      const subtitle = activeKind === 'astronaut' ? (castSheet[person.id]?.title ?? 'Astronaut candidate') : person.title;

      const aboutColumn = el('div', 'hiring-detail-about');
      aboutColumn.append(el('div', 'hiring-detail-name', person.name), el('div', 'hiring-subtitle', subtitle),
        el('p', 'hiring-bio', person.bio));

      const traitsColumn = el('div', 'hiring-detail-traits');
      if (activeKind === 'staff') traitsColumn.append(labeledLine('Effect', person.effect));
      traitsColumn.append(labeledLine('Strength', person.strength), labeledLine('Flaw', person.flaw));
      const tic = castSheet[person.id]?.tic;
      if (tic) traitsColumn.append(el('p', 'hiring-quote', `"${tic}"`));

      detailColumn.replaceChildren(ui.portrait(person.portrait ?? person.id, 64), aboutColumn, traitsColumn, hireButton(person));
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
    // Matches toasts anywhere: ui.toast() currently ends up appending them to <body>, not #app.
    function showPersonLine(person, text) {
      document.querySelectorAll('.toast').forEach((oldToast) => oldToast.remove());
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
        // First name only, and 'Empty' not 'Empty seat': a seat fits about 7 letters.
        const seat = el('div', `hiring-seat${astronaut ? ' is-filled' : ''}`, astronaut ? astronaut.name.split(' ')[0] : 'Empty');
        if (astronaut) seat.title = astronaut.name;
        seats.append(seat);
      }
      // Staff chips scroll sideways, so six hires never push Spent or Continue around.
      const staffCount = state.staff.length;
      const staffArea = el('div', 'hiring-staff');
      staffArea.append(el('div', 'hiring-staff-heading', staffCount > 0 ? `Staff ${staffCount}` : 'No staff yet'));
      const staffChips = el('div', 'hiring-staff-chips');
      staffChips.append(...state.staff.map((member) => el('span', 'hiring-chip', member.name.split(' ')[0])));
      staffArea.append(staffChips);
      const spent = el('div', 'hiring-spent', `Spent $${rules.totalSpent(state)}M`);

      // Fixed width with the button on the right edge, so Continue never moves.
      const continueWrap = el('div', 'hiring-continue');
      const continueButton = ui.button('Continue', onContinue);
      if (!rules.canContinue(state)) {
        continueButton.disabled = true;
        continueButton.title = 'Pick three astronauts.';
        continueWrap.append(el('div', 'why', 'Pick three astronauts.'));
      }
      continueWrap.append(continueButton);
      footer.replaceChildren(seats, staffArea, spent, continueWrap);
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
      window.removeEventListener('keydown', onArrowKey);
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
