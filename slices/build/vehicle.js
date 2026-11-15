// slices/build/vehicle.js: the rocket, launch site and orbit screens (Slice 2 brief section 7).
// Each screen resolves with 'next' or 'back'. Rockets and sites come from the JSON files,
// so adding or changing one never touches this code.

import * as ui from '../../core/ui.js';
import { el, art, talk, halOnce, chargeChange, reliabilityWord, signed } from './common.js';
import { compatPanel, currentLift } from './compat.js';
import { findRocket, findSite, liftFor, siteProblem } from './recompute.js';

// Shared frame: title + Why? on top, the screen's content, then the panel and Back/Next.
function frame(state, ctx, { title, whyKey, background, render, canGoNext, resolve, first }) {
  const root = ui.screen(background);
  root.classList.add('vehicle');
  const head = el('div', 'v-head');
  head.append(el('h2', null, title),
    ui.button('Why?', () => talk(root, 'rosa', ctx.lines.rosa?.[whyKey]), { variant: 'quiet' }));
  const body = el('div', 'v-body');
  const foot = el('div', 'v-foot');
  root.append(head, body, foot);

  function redraw() {
    body.replaceChildren();
    render(body, redraw);
    const buttons = el('div', 'v-buttons');
    const next = ui.button('Next', () => resolve('next'));
    const why = canGoNext();
    if (why) { next.disabled = true; next.title = why; }
    // The first screen of the slice has nothing to go back to.
    if (!first) buttons.append(ui.button('Back', () => resolve('back'), { variant: 'quiet' }));
    buttons.append(next);
    if (why) buttons.append(el('p', 'tier-why', why));
    foot.replaceChildren(compatPanel(state, ctx), buttons);
  }
  redraw();
  return { root, redraw };
}

// After any rocket, site or orbit change: a tight margin gets a word from Hal.
function marginKey(state, catalog) {
  const lift = currentLift(state, catalog);
  if (lift == null || !state.site) return null;
  const margin = lift - state.derived.capsuleMass;
  return margin >= 0 && margin < 0.5 ? 'marginThin' : null;
}

// ---------- Rocket

export function showRocket(state, ctx) {
  return new Promise((resolve) => {
    const { catalog, lines, recompute } = ctx;
    const site = () => findSite(catalog, state.site) ?? { liftBonus: 0 };
    let screen;

    async function pick(rocket) {
      if (state.rocket === rocket.id) return;
      const before = state.derived.spent;
      state.rocket = rocket.id;
      recompute(state);
      chargeChange(state, before);
      ui.sfx('build-select');
      screen.redraw();
      const hal = { condor_reflown: 'condorReflown', pelican: 'pelican' }[rocket.id];
      await halOnce(screen.root, lines, hal);
      await halOnce(screen.root, lines, marginKey(state, catalog));
    }

    screen = frame(state, ctx, {
      title: 'Pick a rocket', whyKey: 'rocket', background: 'build/rocket_yard', resolve, first: true,
      canGoNext: () => (state.rocket ? null : lines.shop?.pickRocket ?? 'Pick a rocket.'),
      render(body) {
        body.classList.add('v-cards', 'v-cards-4');
        const currentCost = findRocket(catalog, state.rocket)?.cost ?? 0;
        for (const rocket of catalog.rockets) {
          const card = el('button', 'tier-card v-card');
          card.type = 'button';
          if (rocket.id === state.rocket) card.classList.add('chosen');
          const lift = liftFor(rocket, site(), state.orbit);
          const margin = lift - state.derived.capsuleMass;
          // Rockets come before parts, so on a first visit there is no capsule to compare yet.
          const fit = !state.derived.capsuleMass ? ['ok', `Carries up to ${lift.toFixed(1)} t`]
            : margin < 0 ? ['bad', `Too heavy by ${Math.abs(margin).toFixed(1)} t`]
              : ['ok', `Your capsule: ${signed(margin)} t`];
          card.append(
            art(`art/sprites/${rocket.sprite}.png`, 'v-sprite', rocket.name),
            el('div', 'tier-name', rocket.name),
            el('div', 'tier-stat', `Lifts ${rocket.lift} t · $${rocket.cost}M`),
            el('div', 'tier-stat', reliabilityWord(rocket)),
            el('div', 'tier-trade', rocket.blurb),
            el('div', `v-fit ${fit[0]}`, fit[1]));
          if (rocket.id !== state.rocket && rocket.cost - currentCost > state.budget) {
            card.disabled = true;
            card.append(el('div', 'tier-why', lines.shop?.noMoney ?? 'Not enough budget.'));
          }
          card.onclick = () => pick(rocket);
          body.append(card);
        }
      },
    });
    // The rocket screen opens the slice, so Rosa's welcome lives here (once per game).
    if (!rocketIntroDone) {
      rocketIntroDone = true;
      talk(screen.root, 'rosa', lines.rosa?.rocketIntro);
    }
  });
}
let rocketIntroDone = false;

// ---------- Launch site: a world map with a clickable dot per site

// Each site's `map` in sites.json is its spot on world_map.png as a fraction of the
// width and height (0 to 1), placed by eye. Redrawn map? Nudge those numbers, not this code.
const MAP_W = 640;
const MAP_H = 356; // keeps the 899 x 500 map's shape
const mapX = (site) => (site.map?.x ?? 0.5) * MAP_W;
const mapY = (site) => (site.map?.y ?? 0.5) * MAP_H;

export function showSite(state, ctx) {
  return new Promise((resolve) => {
    const { catalog, lines, recompute } = ctx;
    let focus = state.site; // the dot whose card is open (not necessarily the chosen site)
    let screen;

    async function choose(site) {
      if (state.site === site.id) return;
      state.site = site.id;
      if (!site.orbits.includes(state.orbit)) {
        state.orbit = 'leo';
        ui.toast(lines.shop?.polarSwitched ?? 'Orbit changed to low Earth.', 3000);
      }
      const before = state.derived.spent;
      recompute(state);
      chargeChange(state, before); // sites cost nothing now (the fee is paid in launch week)
      ui.sfx('build-select');
      screen.redraw();
      await halOnce(screen.root, lines, site.id);
      await halOnce(screen.root, lines, marginKey(state, catalog));
    }

    screen = frame(state, ctx, {
      title: 'Pick a launch site', whyKey: 'site', background: 'build/rocket_yard', resolve,
      canGoNext: () => {
        if (!state.site) return lines.shop?.pickSite ?? 'Pick a launch site.';
        return siteProblem(findSite(catalog, state.site), state.rocket, null);
      },
      render(body, redraw) {
        body.classList.add('v-site');
        const map = el('div', 'v-map');
        for (const site of catalog.sites) {
          const dot = el('button', 'v-dot');
          dot.type = 'button';
          dot.title = site.name;
          dot.style.left = `${mapX(site)}px`;
          dot.style.top = `${mapY(site)}px`;
          if (site.id === state.site) dot.classList.add('chosen');
          if (site.id === focus) dot.classList.add('focus');
          // Labels near the right edge go on the left so they stay on the map.
          const label = el('span', `v-dot-label${mapX(site) > MAP_W - 120 ? ' left' : ''}`, site.name.split(',')[0]);
          dot.append(label);
          dot.onclick = () => { focus = site.id; ui.sfx('build-select'); redraw(); };
          map.append(dot);
        }
        body.append(map, siteCard(findSite(catalog, focus)));
      },
    });

    function siteCard(site) {
      const card = el('div', 'v-info');
      if (!site) {
        card.append(el('p', null, 'Click a dot on the map to see a launch site.'));
        return card;
      }
      const rocket = findRocket(catalog, state.rocket);
      const orbits = site.orbits.map((o) => (o === 'polar' ? 'Polar' : 'Low Earth')).join(', ');
      card.append(
        el('div', 'tier-name', site.name),
        el('div', 'tier-trade', site.blurb),
        el('div', 'tier-stat', `Launch fee: $${site.fee}M (paid in launch week)`),
        el('div', 'tier-stat', `Perk: ${site.perk}`),
        el('div', 'tier-stat', `Risk: ${site.risk}`),
        el('div', 'tier-stat', `Orbits: ${orbits}`));
      if (rocket) card.append(el('div', 'tier-stat', `${rocket.name} lifts ${liftFor(rocket, site, 'leo').toFixed(1)} t from here.`));
      const problem = siteProblem(site, state.rocket, null);
      const chosen = state.site === site.id;
      const pickBtn = ui.button(chosen ? 'Launching from here' : 'Launch from here', () => choose(site));
      // ✓ isn't in the pixel font and its fallback sits low, so it gets its own nudged span.
      if (chosen) pickBtn.append(el('span', 'check', '✓'));
      if (chosen || problem) pickBtn.disabled = true;
      card.append(pickBtn);
      if (problem) card.append(el('p', 'tier-why', problem));
      return card;
    }
  });
}

// ---------- Orbit

const ORBITS = [
  { id: 'leo', name: 'Low Earth orbit', text: 'Circles the middle of the planet. Your rocket gives its full lift.' },
  { id: 'polar', name: 'Polar orbit', text: 'Passes over both poles and sees the whole planet. Costs 15% of lift.' },
];

export function showOrbit(state, ctx) {
  return new Promise((resolve) => {
    const { catalog, lines, recompute } = ctx;
    const site = () => findSite(catalog, state.site);
    let screen;

    async function pick(orbit) {
      if (state.orbit === orbit) return;
      state.orbit = orbit;
      recompute(state);
      ui.sfx('build-select');
      screen.redraw();
      await halOnce(screen.root, lines, marginKey(state, catalog));
    }

    screen = frame(state, ctx, {
      title: 'Pick an orbit', whyKey: 'orbit', background: 'build/rocket_yard', resolve,
      canGoNext: () => {
        if (!state.orbit) return lines.shop?.pickOrbit ?? 'Pick an orbit.';
        return site() && !site().orbits.includes(state.orbit) ? 'This site cannot reach polar orbit.' : null;
      },
      render(body) {
        body.classList.add('v-cards', 'v-cards-2');
        const rocket = findRocket(catalog, state.rocket);
        for (const orbit of ORBITS) {
          const card = el('button', 'tier-card v-card');
          card.type = 'button';
          if (orbit.id === state.orbit) card.classList.add('chosen');
          card.append(el('div', 'tier-name', orbit.name), el('div', 'tier-trade', orbit.text));
          if (rocket && site()) {
            card.append(el('div', 'tier-stat', `${rocket.name} lifts ${liftFor(rocket, site(), orbit.id).toFixed(1)} t`));
          }
          const problem = site() ? siteProblem(site(), null, orbit.id) : null;
          if (problem) {
            card.disabled = true;
            card.append(el('div', 'tier-why', problem));
          }
          card.onclick = () => pick(orbit.id);
          body.append(card);
        }
      },
    });
  });
}
