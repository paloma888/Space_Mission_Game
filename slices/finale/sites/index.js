// slices/finale/sites/index.js: the launch sites, drawn in code with the team's 16 colors.
// Owner: Person 5, Erick. One file per site in this folder; draw.js is their shared toolbox.
// Sites not drawn yet use the simple scene in launch-art.js.
//
// 🏞️ Each site is 3 see-through layers, back to front. As the camera climbs, they slide down at
// different speeds (parallax): far things move less than near things, like the view from a car
// window. That makes a flat picture feel deep.
//   far  - the horizon and faraway landmarks. Slides slowest.
//   mid  - the middle distance.
//   near - the ground, the pad and the big trees. Slides with the pad and the tower.
// Every layer is solid from its horizon down to the bottom edge. So when a nearer layer slides
// away faster, there's always land behind it, never a hole.
//
// The team's own picture (art/backgrounds/launchweek/site_<id>.png) still replaces all of this
// when it exists. Colors come from `ink`, which launch-anim.js picks from the team's palette.

import { canaveral } from './canaveral.js';
import { kodiak } from './kodiak.js';
import { kourou } from './kourou.js';
import { mahia } from './mahia.js';
import { sriharikota } from './sriharikota.js';

// Which sites are drawn so far, by id.
const SITES = { canaveral, kodiak, kourou, mahia, sriharikota };

/**
 * Job: builds a launch site's layers, if this file knows how to draw that site.
 * @param {Object} ink - colors by role, as '#rrggbb' strings (from launch-anim.js).
 * @param {string} siteId - 'canaveral', 'kodiak', 'kourou', 'mahia' or 'sriharikota'.
 * @returns {Array|null} - [{ img, rate }, ...] back to front, or null if the site isn't drawn here yet.
 * ⭐
 */
export function buildSite(ink, siteId) {
  const draw = SITES[siteId];
  return draw ? draw(ink) : null;
}
