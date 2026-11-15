// Step A of each week: the trail map with a marker moving to this week's stop
// (Slice 3 brief section 3). Stop positions come from map.json so they can be
// moved to match the hand-drawn background without touching code.

import * as ui from '../../core/ui.js';

const ART_SCALE = 4; // 320 x 180 art is shown at 4 times size (Rulebook section 9)

let map = null;

async function loadMap() {
  if (!map) map = await (await fetch(new URL('./map.json', import.meta.url))).json();
  return map;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function place(node, stop) {
  node.style.left = `${stop.x * ART_SCALE}px`;
  node.style.top = `${stop.y * ART_SCALE}px`;
}

// Falling snow: small square flakes that drop in pixel-sized jumps (see trail.css).
// Positions and speeds come from each flake's number, not random(), so the snow
// never uses up the seeded random numbers that decide which events happen.
function snowfall(count) {
  const layer = el('div', 'map-snow');
  for (let i = 0; i < count; i++) {
    const flake = el('div', `map-flake${i % 3 === 0 ? ' is-big' : ''}`);
    flake.style.left = `${(i * 197) % 1280}px`;
    flake.style.animationDuration = `${3 + (i % 5) * 0.6}s`;
    flake.style.animationDelay = `-${(i * 0.53) % 4}s`; // negative: already mid-fall when the map opens
    layer.append(flake);
  }
  return layer;
}

// A dashed line through every stop, drawn on the same 320 x 180 grid as the art.
// crispEdges keeps the line on whole pixels, so it looks pixelated, not smooth.
function routePath(stops) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'map-path');
  svg.setAttribute('viewBox', '0 0 320 180');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', stops.map((s) => `${s.x},${s.y}`).join(' '));
  svg.append(line);
  return svg;
}

// The marker is art/sprites/trail_marker.png. Until it is drawn, a plain box stands in.
function marker() {
  const img = el('img', 'map-marker');
  img.alt = '';
  img.onerror = () => img.replaceWith(Object.assign(el('div', 'map-marker placeholder-box', 'YOU'), { style: img.style.cssText }));
  img.src = new URL('../../art/sprites/trail_marker.png', import.meta.url).href;
  return img;
}

// The map's picture. By default ui.screen loads trail_map.png as usual.
// If map.json names a GIF ("background": "trail_map.gif"), that file is used instead,
// so an animated map plays behind the marker. It is opt-in, so a missing GIF never
// fills the console with errors. If the named file fails to load, the usual
// labeled placeholder shows instead.
function mapScreen(background) {
  if (!background || !background.endsWith('.gif')) return ui.screen('trail/trail_map');
  const root = ui.screen();
  const img = new Image();
  img.onload = () => { root.style.backgroundImage = `url("${img.src}")`; };
  img.onerror = () => {
    console.warn(`Could not load art/backgrounds/trail/${background}. Showing the placeholder.`);
    root.classList.add('placeholder-bg'); // also brings back the stop names (see trail.css)
    root.dataset.label = `background: trail/${background}`;
  };
  img.src = new URL(`../../art/backgrounds/trail/${background}`, import.meta.url).href;
  return root;
}

/**
 * Shows the map for a few seconds, then resolves. A click or key press skips ahead.
 * The marker starts at last week's stop and travels to this week's.
 */
export async function showMap(week, lastWeek, day) {
  const { stops, seconds, background, snow } = await loadMap();
  const root = mapScreen(background);
  root.classList.add('trail-map');
  if (snow) root.append(snowfall(snow));
  root.append(el('div', 'map-banner', `Week ${week} of ${lastWeek}, Day ${day}`));

  // Dots and names are only for the placeholder. The real background has the stops drawn on it.
  // (CSS hides them once the background image loads.)
  // Until the hand-drawn map exists, the placeholder shows a simple route made of UI pieces:
  // a dashed path through the stops and a light at each one. CSS hides all of it as soon
  // as a real background loads, so the drawing always wins.
  root.append(routePath(stops));
  const current = Math.min(week, stops.length) - 1;
  stops.forEach((stop, i) => {
    const light = el('div', `map-light${i < current ? ' is-done' : ''}${i === current ? ' is-here' : ''}`);
    place(light, stop);
    root.append(light);
    const dot = el('div', 'map-stop', `${i + 1}. ${stop.name}`);
    place(dot, stop);
    root.append(dot);
  });

  const here = stops[Math.min(week, stops.length) - 1];
  const from = stops[Math.max(week - 2, 0)];
  let pin = marker();
  place(pin, from);
  root.append(pin);
  ui.sfx('trail-week');

  await new Promise((resolve) => {
    // Pause briefly so the player sees where the marker starts before it sets off.
    setTimeout(() => {
      pin = root.querySelector('.map-marker') ?? pin; // the image may have been swapped for the box
      place(pin, here);
    }, 400);
    const finish = () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', finish);
      resolve();
    };
    const timer = setTimeout(finish, seconds * 1000);
    // Wait a moment so the click that ended last week doesn't skip this map.
    setTimeout(() => {
      window.addEventListener('pointerdown', finish);
      window.addEventListener('keydown', finish);
    }, 300);
  });
}
