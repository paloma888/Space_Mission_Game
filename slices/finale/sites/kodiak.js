// slices/finale/sites/kodiak.js: Kodiak, Alaska, drawn in code. Owner: Person 5, Erick.
// See sites/index.js for how the 3 layers (far, mid, near) and parallax work.

import {
  W, H, makeCanvas, drawPad, dot, box, hash2, noise3, RATES, mix, speckle, patch, scatterTufts, padGravel, island,
} from './draw.js';

// ---------- 🏔️ Kodiak, Alaska
// Narrow Cape on Kodiak Island, looking out to sea: a cold, windy, treeless headland. Rolling
// tundra grass with patches of old snow, a rocky shore, the grey North Pacific, and snowy
// mountains across the water, with a cliff headland nearby. Look closely for a Kodiak bear on the
// hill and a bald eagle overhead.

const K_SEA_TOP = 108;  // the horizon
const K_CLIFF_Y = 116;  // the top of the sea cliffs (the ocean ends here)
const K_MID_BASE = 128; // the foot of the rolling hills in the middle layer
const K_GROUND_Y = 134; // where the near ground starts

/**
 * Job: Kodiak's 3 layers.
 * @param {Object} ink - colors by role (launch-anim.js).
 * @returns {Array} - [{ img, rate }] for far, mid and near.
 */
export function kodiak(ink) {
  // This site's colors, named for what they paint. Each one is a palette color from `ink`.
  const c = {
    seaDeep: ink.sea, seaLight: ink.seaLight, foam: ink.cloud,
    rock: ink.rock, rockShade: ink.rockShade, rockDark: ink.ring,
    snow: ink.snow, snowShade: ink.snowShade,
    grass: ink.grassShade, grassLight: ink.grass, dryGrass: ink.sand, mud: ink.trunk,
    gravel: ink.rock, gravelLight: ink.snow,
    bear: ink.trunk, bearShade: ink.towerShade,
    sock: ink.flameOuter, sockStripe: ink.cloud, pole: ink.rockShade,
    bird: ink.ring, birdHead: ink.cloud,
  };
  return [
    { img: kodiakFar(c), rate: RATES.far },
    { img: kodiakMid(c), rate: RATES.mid },
    { img: kodiakNear(c, ink), rate: RATES.near },
  ];
}

// Far: snowy mountains across the water, the cold ocean, a small island, a cliff headland,
// the rocky shore, then tundra all the way down.
function kodiakFar(c) {
  const { canvas, g } = makeCanvas(W, H);
  mountains(g, c, [[14, 64], [50, 76], [90, 68], [132, 88], [166, 97]], K_SEA_TOP + 1);

  // The North Pacific: darker and calmer-looking than Florida's ocean, with only a few whitecaps.
  const LIGHT = [0, 0, 0, 0, 0.25, 0.25, 0.5, 0.5];
  for (let y = K_SEA_TOP; y < K_CLIFF_Y; y++) {
    const light = LIGHT[y - K_SEA_TOP];
    for (let x = 0; x < W; x++) {
      let color = mix(x, y, light) ? c.seaLight : c.seaDeep;
      if (y > K_SEA_TOP + 2 && hash2(x >> 2, y) < 0.02 && hash2(x, y) < 0.6) color = c.foam;
      dot(g, x, y, color);
    }
  }
  island(g, c, 232, K_SEA_TOP, 14, 5);
  headland(g, c, 282, 99);

  // The rocky shore: surf breaking on dark rocks, then tundra all the way down.
  for (let x = 0; x < W; x++) {
    dot(g, x, K_CLIFF_Y, hash2(x, 21) < 0.6 ? c.foam : c.seaLight);
    for (let y = K_CLIFF_Y + 1; y < K_CLIFF_Y + 3; y++) {
      dot(g, x, y, speckle(x, y, 0.3) ? c.rock : speckle(y, x, 0.3) ? c.rockDark : c.rockShade);
    }
    for (let y = K_CLIFF_Y + 3; y < H; y++) dot(g, x, y, y === K_CLIFF_Y + 3 ? c.grassLight : tundraPixel(c, x, y, 10));
  }

  eagle(g, c, 214, 58);
  return canvas;
}

// Mid: rolling tundra hills with snow patches, an old fence, and a Kodiak bear.
function kodiakMid(c) {
  const { canvas, g } = makeCanvas(W, H);
  // The hills' top edge: a big hill on the left, a smaller one on the right, gentle bumps between.
  const top = [];
  for (let x = 0; x < W; x++) {
    const big = 15 * Math.max(0, 1 - ((x - 58) / 70) ** 2);
    const small = 7 * Math.max(0, 1 - ((x - 262) / 50) ** 2);
    top[x] = Math.round(K_MID_BASE - Math.max(big, small) - 2 * noise3(x / 20, 1.5, 0.5));
  }
  for (let x = 0; x < W; x++) {
    for (let y = top[x]; y < H; y++) dot(g, x, y, y === top[x] ? c.grassLight : tundraPixel(c, x, y, 14));
  }
  fence(g, c, top, 196, 244);
  bear(g, c, 84, top[84] + 6);
  return canvas;
}

// Near: tundra with snow patches and dry grass, the gravel area, the pad, a windsock, and snowy
// boulders in front.
function kodiakNear(c, ink) {
  const { canvas, g } = makeCanvas(W, H);
  for (let y = K_GROUND_Y; y < H; y++) {
    for (let x = 0; x < W; x++) dot(g, x, y, y === K_GROUND_Y ? c.grassLight : tundraPixel(c, x, y, 26));
  }
  scatterTufts(g, K_GROUND_Y, 45, c.mud, c.dryGrass);
  padGravel(g, c.gravel, c.gravelLight);
  drawPad(g, ink);
  windsock(g, c, 236, 152);
  // Boulders, farther ones first so the nearer ones are drawn over them.
  for (const [x, y, r] of [[100, 160, 3], [302, 160, 5], [58, 172, 4], [270, 172, 7], [24, 178, 7], [312, 180, 6]]) {
    boulder(g, c, x, y, r);
  }
  return canvas;
}

// ---------- 🖌️ Things only Kodiak draws

// One pixel of tundra ground: dark grass with lighter blades, brown muddy patches, and patches
// of old snow. `size` is how big the patches are (smaller for faraway ground).
function tundraPixel(c, x, y, size) {
  const p = patch(x, y, size);
  if (p > 0.74) return speckle(x, y, 0.08) ? c.snowShade : c.snow;     // a snow patch
  if (p > 0.7 && mix(x, y, (p - 0.7) / 0.04)) return c.snow;            // its thin, patchy edge
  if (p < 0.22) return speckle(x, y, 0.25) ? c.mud : c.grass;          // muddy brown ground
  return speckle(x, y, 0.18) ? c.grassLight : c.grass;
}

// A range of snowy mountains standing on the horizon. peaks = [[x, topRow], ...]. Each column
// rises to its highest nearby peak. Left of a peak is sunlit, right of it is in shade, and snow
// covers the top part with a ragged edge. Sunlit snow is as pale as the sky, so the mountains'
// outline is drawn in the shady blue to keep them from vanishing into it.
function mountains(g, c, peaks, baseY) {
  for (let x = 0; x < W; x++) {
    let top = baseY;
    let peak = null;
    for (const p of peaks) {
      const slope = 1 + hash2(p[0], 9) * 0.5;                              // each peak its own steepness
      const t = p[1] + Math.abs(x - p[0]) * slope + (hash2(x >> 1, p[0]) < 0.3 ? 1 : 0); // + jagged edge
      if (t < top) { top = t; peak = p; }
    }
    if (!peak) continue;
    const sunny = x <= peak[0];
    const ridge = Math.round(top);
    for (let y = ridge; y < baseY; y++) {
      const snowy = y < peak[1] + 18 + Math.round(hash2(x, 3) * 6) && !speckle(x, y, 0.06); // a few rock streaks
      let color;
      if (snowy) color = y === ridge || !sunny ? c.snowShade : c.snow;
      else color = speckle(x, y, sunny ? 0.35 : 0.1) ? c.rock : c.rockShade; // rough rock, lighter in the sun
      dot(g, x, y, color);
    }
  }
}

// A cliff headland at the right edge, seen from the side: a grassy top and a steep rock face
// dropping into the sea, darker at the bottom where the waves hit.
function headland(g, c, x0, topY) {
  for (let x = x0; x < W; x++) {
    const top = topY + Math.max(0, x0 + 4 - x) * 2 + (hash2(x >> 1, 24) < 0.3 ? 1 : 0); // the face slopes in at the left
    for (let y = top; y < K_CLIFF_Y; y++) {
      let color = speckle(x, y, 0.25) ? c.rock : c.rockShade;
      if (y - top < 2) color = c.grassLight;                       // grass on top
      else if (y > K_CLIFF_Y - 4) color = speckle(x, y, 0.5) ? c.rockDark : c.rockShade;
      dot(g, x, y, color);
    }
    dot(g, x, K_CLIFF_Y - 1, hash2(x, 25) < 0.5 ? c.foam : c.rockDark); // waves at its foot
  }
}

// A bald eagle soaring: wide dark wings, with its white head in the middle.
function eagle(g, c, x, y) {
  for (const [dx, dy] of [[-4, 1], [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0], [4, 1]]) dot(g, x + dx, y + dy, c.bird);
  dot(g, x, y, c.birdHead);
  dot(g, x, y + 1, c.bird);
}

// A Kodiak bear walking to the right, small because it's far away. (x, y) is where its back feet stand.
function bear(g, c, x, y) {
  const rows = [[1, 2, 3, 5], [0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5], [0, 2, 3, 5]]; // back, body, belly, legs
  rows.forEach((cols, i) => cols.forEach((dx) => dot(g, x + dx, y - 3 + i, i < 2 ? c.bear : c.bearShade)));
}

// An old fence across the hill: a wooden post every 6 pixels with a wire between them.
// top[x] is the hill's top edge, so the fence follows the ground.
function fence(g, c, top, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    const y = top[x] + 4;
    dot(g, x, y - 2, c.pole);                               // the wire
    if ((x - x0) % 6 === 0) box(g, x, y - 4, 1, 4, c.mud);  // a post
  }
}

// A windsock on a pole: orange and white stripes, blown out to the right by the wind.
function windsock(g, c, x, baseY) {
  box(g, x, baseY - 26, 1, 26, c.pole);
  for (let i = 0; i < 10; i++) {
    const half = i < 4 ? 2 : i < 8 ? 1 : 0;                      // narrower toward the tip
    const color = Math.floor(i / 2) % 2 ? c.sockStripe : c.sock;
    box(g, x + 1 + i, baseY - 25 - half + (i > 6 ? 1 : 0), 1, half * 2 + 1, color); // the tip droops a bit
  }
}

// A rounded boulder: sunny on the left, dark on the right, with old snow on top.
function boulder(g, c, cx, baseY, r) {
  for (let y = -r; y <= 0; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y) * 1.3);
    for (let x = -half; x <= half; x++) {
      let color = x < -half / 3 ? c.rock : x > half / 2 ? c.rockDark : c.rockShade;
      if (y < -r * 0.55) color = x < 0 ? c.snow : c.snowShade; // the snowy cap
      dot(g, cx + x, baseY + y, color);
    }
  }
}
