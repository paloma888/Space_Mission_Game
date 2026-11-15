// slices/finale/explorer-sky.js: the deep sky behind the globe (orbit-explorer.js uses this).
// Owner: Person 5, Erick. 🌌 Everything is drawn in code with the team's 16 colors:
//   - Andromeda: a big spiral galaxy, tilted, with a bright core, blue arms, pink star nurseries
//     and dark dust lanes
//   - the Milky Way: our own galaxy, seen from inside as a band of faint stars across the sky
//   - Sagittarius A*: the black hole at the Milky Way's center, in an artist's style (a black
//     middle, a glowing ring, a swirling disk of hot gas, and a jet)
//   - the Large and Small Magellanic Clouds: two small galaxies that orbit ours
// The words you see when you click them (with NASA sources) live in explorer-facts.json.
//
// A "sprite" here is a small picture stored as { w, h, px }: px holds one palette number per
// pixel, or -1 for see-through.

import { BAYER, hash, hash2, noise3 } from './pixel.js';

// 🎨 The sky's colors, described by what they should look like (pickColors finds the closest
// palette color). The palette has no pink or purple, so those are made by dithering two colors.
export const SKY_COLORS = {
  galCore: '#f6dcb8', galGold: '#d6aa4f', galBlue: '#6d95ca', galDeep: '#1f3b73',
  galPink: '#bb6a52', galDust: '#915841',
  bhHot: '#f6dcb8', bhGold: '#d6aa4f', bhOrange: '#c9783e', bhRed: '#844136', bhJet: '#6d95ca', hole: '#03050f',
};

// Where each object sits, as a direction from the STARTING view (x right, y up, z toward the
// player). orbit-explorer.js turns these into fixed sky directions, the same way as the Moon.
export const SKY_PLACES = {
  andromeda: [-0.5, 0.3, 0.81],         // up and to the left: on screen right away
  galacticCenter: [0.82, -0.3, -0.48],  // behind you, to the right: the black hole, on the Milky Way band
  lmc: [-0.25, -0.9, 0.36],             // far below you (they're in the southern sky)
  smc: [-0.1, -0.93, 0.35],
};

// One spot in the 4x4 dither pattern (0 to 1). Comparing a shade with it mixes two colors evenly.
const dither = (x, y) => BAYER[((y + 64) & 3) * 4 + ((x + 64) & 3)];

/**
 * Job: draws Andromeda once, as a sprite. For each pixel: undo the tilt and the squash (we see
 *   the galaxy at a slant), then ask "how far from the center, and how close to a spiral arm?".
 *   The answers pick the color: white-gold core, blue arms with pink star nurseries, dark dust
 *   lanes just inside the arms, and a soft dithered edge that fades into space.
 * @param {Object} C - palette numbers by role (needs SKY_COLORS and 'star').
 * @returns {Object} - a sprite { w, h, px }.
 * ⭐
 */
export function buildAndromeda(C) {
  const w = 64, h = 34;
  const R = 30;          // its radius along the long side, in pixels
  const squash = 0.34;   // how flat it looks: we see it almost edge-on
  const tilt = -0.42;    // how much it's turned, in radians
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const px = new Int8Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Undo the tilt and the squash: (gx, gy) is where this pixel is on the flat galaxy.
      const dx = x - w / 2 + 0.5, dy = y - h / 2 + 0.5;
      const gx = (dx * ct + dy * st) / R;
      const gy = (-dx * st + dy * ct) / (R * squash);
      const r = Math.hypot(gx, gy);  // 0 at the center, 1 at the edge
      if (r > 1.08) continue;
      // Two spiral arms. Each arm is where this wave peaks; ln(r) makes them wind outward.
      const wave = 2 * Math.atan2(gy, gx) - Math.log(r + 0.04) * 5;
      const arm = ((Math.cos(wave) + 1) / 2) ** 3;           // 1 on an arm, 0 between arms
      const lane = ((Math.cos(wave + 1.1) + 1) / 2) ** 6;     // dust sits just inside each arm
      const lumpy = noise3(gx * 5 + 3, gy * 5 + 3, 1.7);      // patchy, so it isn't too perfect
      const glow = Math.exp(-r * 2.4) * (0.4 + 0.9 * arm) * (0.7 + 0.6 * lumpy);
      const b = dither(x, y);

      let c = -1;
      if (r < 0.06) c = C.star;                                            // the white-hot middle
      else if (r < 0.15) c = b < 0.25 ? C.galGold : C.galCore;
      else if (r < 0.32) c = b < (r - 0.15) / 0.17 ? C.galBlue : C.galGold; // the golden bulge, blending into blue
      else if (lane > 0.85 && r < 0.8 && lumpy > 0.45) {
        c = r < 0.5 ? C.galDust : C.galDeep;                               // thin dark dust lanes
      } else if (arm > 0.5 && noise3(gx * 13 + 9, gy * 13 + 9, 4.2) > 0.62) {
        c = b < 0.5 ? C.galPink : C.galCore;                               // a pink star nursery
      } else if (glow > 0.28) c = hash2(x, y) < 0.06 ? C.star : C.galBlue; // bright arm, a few stars
      else if (glow > 0.13) c = b < 0.5 ? C.galBlue : C.galDeep;
      else if (glow > 0.05 && b < (glow - 0.05) / 0.08) c = C.galDeep;    // the edge fading into space
      px[y * w + x] = c;
    }
  }
  return { w, h, px };
}

/**
 * Job: draws a Magellanic Cloud once, as a sprite: a lumpy, glowing smudge with no spiral.
 * @param {Object} C - palette numbers by role.
 * @param {number} w - width. @param {number} h - height.
 * @param {number} seed - makes each cloud a different shape.
 * @param {boolean} big - the Large Cloud gets a bright bar across it and a pink nebula.
 * @returns {Object} - a sprite { w, h, px }.
 */
export function buildCloud(C, w, h, seed, big) {
  const px = new Int8Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2 + 0.5) / (w / 2);
      const dy = (y - h / 2 + 0.5) / (h / 2);
      const r = Math.hypot(dx, dy);
      const lumpy = noise3(x / 3.2 + seed, y / 3.2 + seed, seed * 0.7);
      const bar = big ? Math.exp(-((dy * 1.6 + dx * 0.5) ** 2) * 6) * Math.max(0, 1 - Math.abs(dx)) : 0;
      const v = (1 - r) + (lumpy - 0.5) * 0.6 + bar * 0.3;         // how bright this pixel is
      // A cloud of countless faint stars, so it's a sprinkle of dots, thickest where it's brightest.
      const roll = hash2(x + Math.round(seed * 31), y + 57);
      let c = -1;
      if (big && Math.hypot(dx - 0.35, dy + 0.1) < 0.18 && roll < 0.8) c = roll < 0.4 ? C.galPink : C.galCore; // a pink nebula
      else if (v > 0.55 && roll < 0.85) c = roll < 0.25 ? C.star : C.galBlue;
      else if (v > 0.35 && roll < 0.55) c = roll < 0.2 ? C.galBlue : C.starDim;
      else if (v > 0.15 && roll < 0.22) c = C.starDim;                   // the thin outer haze
      px[y * w + x] = c;
    }
  }
  return { w, h, px };
}

/**
 * Job: the color of one pixel of the black hole at time t. Drawn fresh every frame, so the disk
 *   swirls (faster near the middle, like real orbits). From back to front:
 *   the jet -> the back half of the disk -> the black hole and its bright ring -> the front half
 *   of the disk, which passes in front of the hole.
 * @param {Object} C - palette numbers by role.
 * @param {number} x - pixel position from the center (right is +). @param {number} y - (down is +).
 * @param {number} t - seconds, for the swirl.
 * @returns {number} - a palette number, or -1 for see-through.
 */
export function blackHolePixel(C, x, y, t) {
  const b = dither(x, y);
  const d = Math.hypot(x, y);

  // The disk of hot gas: a flat ring seen almost edge-on (squashed to 30% of its height).
  const ex = x / 24, ey = y / (24 * 0.3);
  const rr = Math.hypot(ex, ey);
  let disk = -1;
  if (rr > 0.3 && rr < 1) {
    const swirl = Math.atan2(ey, ex) - (t * 0.9) / rr;          // inner parts go around faster
    const streaks = noise3(Math.cos(swirl) * 2 + 4, Math.sin(swirl) * 2 + 4, rr * 7);
    const heat = 1 - (rr - 0.3) / 0.7;                          // hottest at the inner edge
    const beam = 1 - 0.4 * (ex / rr);                           // the side coming toward us looks brighter
    const v = heat * beam * (0.55 + 0.7 * streaks);
    if (v > 0.95) disk = C.bhHot;
    else if (v > 0.7) disk = C.bhGold;
    else if (v > 0.45) disk = C.bhOrange;
    else if (v > 0.25) disk = C.bhRed;
    else if (v > 0.12 && b < 0.5) disk = C.bhRed;
  }

  if (disk >= 0 && y >= 0) return disk;                         // the front of the disk
  if (d < 5.5) return C.hole;                                   // the black hole itself
  if (d < 6.5 || (y < 0 && d < 7.5)) return d < 6.3 ? C.bhHot : C.bhGold; // its glowing ring (thicker on top)
  if (disk >= 0) return disk;                                   // the back of the disk

  // The jet: a thin beam shooting up and to the right, fading as it goes.
  const along = x * 0.3 - y * 0.95;
  const across = Math.abs(x * 0.95 + y * 0.3);
  if (along > 6 && along < 30 && across < 0.8 + along * 0.06 && b < (1 - along / 30) * 0.9) {
    return across < 0.6 && along < 14 ? C.star : C.bhJet;
  }
  return -1;
}
// How far the black hole's picture reaches from its center (the jet goes up to 30 pixels up).
export const BLACK_HOLE_BOX = { left: -26, right: 26, top: -30, bottom: 9 };

/**
 * Job: the stars of the Milky Way band. Our galaxy is a flat disk and we live inside it, so we
 *   see it as a band going all the way around the sky. It's thicker near its center (where the
 *   black hole is), like the real one.
 * @param {Object} C - palette numbers by role.
 * @param {Array} center - direction of the galaxy's center (the black hole), length 1.
 * @param {Array} axis - direction the band "faces" (at right angles to the band), length 1.
 * @returns {Array} - about 2600 points { d: direction, c: palette number }.
 */
export function milkyWayPoints(C, center, axis) {
  const side = cross(axis, center); // the third direction, along the band
  const pts = [];
  for (let i = 0; i < 2600; i++) {
    const a = (hash(i * 5 + 1) - 0.5) * Math.PI * 2;                // how far around the band
    const bulge = Math.exp(-a * a * 2.5);                           // 1 at the center, 0 far away
    const spread = (hash(i * 5 + 2) + hash(i * 5 + 3) - 1) * (0.07 + 0.12 * bulge); // most near the middle line
    const d = normalize([0, 1, 2].map((k) => center[k] * Math.cos(a) + side[k] * Math.sin(a) + axis[k] * spread));
    const bright = hash(i * 5 + 4);
    const c = bright > 0.93 ? C.star : bright > 0.75 ? (bulge > 0.3 ? C.galCore : C.galBlue) : C.starDim;
    pts.push({ d, c });
  }
  return pts;
}

// ---------- Small vector helpers
export const normalize = (v) => { const l = Math.hypot(...v) || 1; return v.map((n) => n / l); };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
