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

// The marker is art/sprites/trail_marker.png. Until it is drawn, a plain box stands in.
function marker() {
  const img = el('img', 'map-marker');
  img.alt = '';
  img.onerror = () => img.replaceWith(Object.assign(el('div', 'map-marker placeholder-box', 'YOU'), { style: img.style.cssText }));
  img.src = new URL('../../art/sprites/trail_marker.png', import.meta.url).href;
  return img;
}

/**
 * Shows the map for a few seconds, then resolves. A click or key press skips ahead.
 * The marker starts at last week's stop and travels to this week's.
 */
export async function showMap(week, lastWeek, day) {
  const { stops, seconds } = await loadMap();
  const root = ui.screen('trail/trail_map');
  root.classList.add('trail-map');
  root.append(el('div', 'map-banner', `Week ${week} of ${lastWeek}, Day ${day}`));

  // Dots and names are only for the placeholder. The real background has the stops drawn on it.
  // (CSS hides them once the background image loads.)
  stops.forEach((stop, i) => {
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
