// slices/build/intro.js: the opener between the briefing and the build, matching the
// trail's week map (Person 3): a banner, a short pixel-step animation, then it moves on
// by itself after a few seconds. A click or key press skips ahead.

import * as ui from '../../core/ui.js';
import { el, art, playSound } from './common.js';

export function showIntro(state, { catalog, lines }) {
  const I = lines.intro ?? {};
  const root = ui.screen('build/rocket_yard');
  root.classList.add('vehicle', 'build-intro');

  // The rocket screen's own layout (title row + four-card grid), made invisible except for
  // the rocket pictures. So each rocket rises to exactly the spot it has on the next screen,
  // and stays lined up even if that screen's layout changes.
  const head = el('div', 'v-head intro-ghost-head');
  head.append(el('h2', null, 'Pick a rocket'), ui.button('Help', null, { variant: 'quiet' }));
  const grid = el('div', 'v-body v-cards v-cards-4');
  catalog.rockets.forEach((rocket, i) => {
    const card = el('div', 'tier-card v-card intro-ghost-card');
    const pic = art(`art/sprites/${rocket.sprite}.png`, 'v-sprite intro-rocket', rocket.name);
    pic.style.animationDelay = `${0.15 + i * 0.2}s`;
    card.append(pic);
    grid.append(card);
  });
  root.append(head, grid);

  root.append(el('div', 'intro-banner', I.banner ?? 'Part 2: Build Your Mission'));
  const sub = (I.sub ?? 'Day {day} · ${budget}M to spend')
    .replace('{day}', state.day).replace('{budget}', state.budget);
  root.append(el('div', 'intro-sub', sub));
  playSound('build-next');

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', finish);
      resolve();
    };
    const timer = setTimeout(finish, (I.seconds ?? 2.5) * 1000);
    // Wait a moment so the click that ended the briefing doesn't skip this straight away.
    setTimeout(() => {
      window.addEventListener('pointerdown', finish);
      window.addEventListener('keydown', finish);
    }, 300);
  });
}
