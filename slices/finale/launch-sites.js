// slices/finale/launch-sites.js: the launch sites, drawn in code with the team's 16 colors.
// Owner: Person 5, Erick. Sites not drawn here yet use the simple scene in launch-art.js.
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

import { W, H, makeCanvas, drawPad, dot, box, disk } from './launch-art.js';
import { hash2, noise3, BAYER } from './pixel.js';

// How fast each layer slides, compared with the ground (1 = moves with the ground).
const RATES = { far: 0.35, mid: 0.65, near: 1 };

// True for a share `t` (0 to 1) of the pixels, spread evenly by the BAYER pattern.
// mix(x, y, 0.5) gives a checkerboard-like 50/50 mix of two colors. Good for water and sky.
const mix = (x, y, t) => BAYER[(y & 3) * 4 + (x & 3)] < t;
// True for a share `t` of the pixels, scattered unevenly. Good for plants and dirt, which
// would look like a checkerboard with mix().
const speckle = (x, y, t) => hash2(x, y) < t;
// Soft, blotchy patches from 0 to 1, about `size` pixels across. Makes big areas less flat.
const patch = (x, y, size) => noise3(x / size, y / (size * 0.5), 0.5);
// Half the width of the gravel area around the pad, at row y. It widens toward us.
const padHalf = (y) => 46 + (y - 152) * 1.15;

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

// ---------- 🌴 Cape Canaveral, Florida
// Looking east across the pad to the Atlantic Ocean. Flat and sandy, with saw palmetto scrub,
// cabbage palms (Florida's state tree), marsh ponds, a black-and-white striped lighthouse, and
// more launch pads lined up along the coast.

const SEA_TOP = 106;   // the horizon line, where the ocean meets the sky
const BEACH_Y = 118;   // where the waves break
const MID_BASE = 129;  // the bottom of the scrub clumps in the middle layer
const GROUND_Y = 134;  // where the near ground starts

/**
 * Job: Cape Canaveral's 3 layers.
 * @param {Object} ink - colors by role (launch-anim.js).
 * @returns {Array} - [{ img, rate }] for far, mid and near.
 */
function canaveral(ink) {
  // This site's colors, named for what they paint. Each one is a palette color from `ink`.
  const c = {
    seaDeep: ink.sea, seaLight: ink.seaLight, foam: ink.cloud,
    sand: ink.sand, sandShade: ink.sandShade,
    scrub: ink.grassShade, scrubLight: ink.grass, deadFrond: ink.trunk,
    trunk: ink.rockShade, trunkLight: ink.rock,
    gravel: ink.rock, gravelLight: ink.sand,
    steel: ink.rock, steelShade: ink.rockShade,
    tank: ink.rock, tankLight: ink.cloud, tankShade: ink.rockShade,
    stripeDark: ink.ring, stripeLight: ink.sand, lamp: ink.beacon,
    bird: ink.rockShade,
  };
  return [
    { img: canaveralFar(c), rate: RATES.far },
    { img: canaveralMid(c), rate: RATES.mid },
    { img: canaveralNear(c, ink), rate: RATES.near },
  ];
}

// Far: the ocean, the beach, the lighthouse and other pads along the coast, then flat scrubland.
function canaveralFar(c) {
  const { canvas, g } = makeCanvas(W, H);

  // The ocean: deep blue at the horizon, lighter closer in, in steps (one number per row).
  const LIGHT = [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1];
  for (let y = SEA_TOP; y < BEACH_Y; y++) {
    const light = LIGHT[y - SEA_TOP];
    for (let x = 0; x < W; x++) {
      let color = mix(x, y, light) ? c.seaLight : c.seaDeep;
      // Whitecaps: short white dashes, more of them closer to shore.
      if (y > SEA_TOP + 3 && hash2(x >> 2, y) < 0.02 + light * 0.05 && hash2(x, y) < 0.7) color = c.foam;
      dot(g, x, y, color);
    }
  }

  // Breaking waves, wet sand, then dry sand.
  for (let x = 0; x < W; x++) {
    dot(g, x, BEACH_Y, hash2(x, 1) < 0.75 ? c.foam : c.seaLight);
    dot(g, x, BEACH_Y + 1, hash2(x >> 1, 2) < 0.3 ? c.foam : c.sandShade);
    box(g, x, BEACH_Y + 2, 1, 2, c.sand);
  }

  // Flat scrubland behind the beach, all the way down. Low dunes make its top edge a little bumpy.
  // Lighter patches here and there, so it doesn't look like one flat green sheet from above.
  for (let x = 0; x < W; x++) {
    const top = BEACH_Y + 4 - (hash2(x >> 2, 3) < 0.4 ? 1 : 0);
    for (let y = top; y < H; y++) {
      const light = y < top + 2 ? 0.55 : patch(x, y, 18) > 0.6 ? 0.35 : 0.08;
      dot(g, x, y, speckle(x, y, light) ? c.scrubLight : speckle(y, x, 0.02) ? c.deadFrond : c.scrub);
    }
  }
  // Marsh ponds in the scrub. They only show once the rocket climbs and the nearer layers drop away.
  for (const [x, y, r] of [[34, 142, 7], [112, 156, 10], [206, 138, 5], [258, 162, 9], [300, 144, 5], [70, 172, 8], [170, 170, 6]]) {
    pond(g, c, x, y, r);
  }

  lighthouse(g, c, 74, BEACH_Y + 4);
  distantPad(g, c, 196, BEACH_Y + 3, 18);
  distantPad(g, c, 246, BEACH_Y + 3, 13);
  pelican(g, c, 104, 62);
  pelican(g, c, 113, 67);
  return canvas;
}

// Mid: a belt of saw palmetto scrub with a few small cabbage palms.
function canaveralMid(c) {
  const { canvas, g } = makeCanvas(W, H);

  // The scrub's top edge is a row of rounded clumps. top[x] = the highest clump in each column.
  const top = new Array(W).fill(MID_BASE);
  for (let i = -1; i < 42; i++) {
    const cx = i * 8 + Math.round(hash2(i, 4) * 6);
    const r = 3 + Math.round(hash2(i, 5) * 2);
    for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++) {
      top[x] = Math.min(top[x], Math.round(MID_BASE - Math.sqrt(r * r - (x - cx) ** 2)));
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = top[x]; y < H; y++) {
      // The tops of the clumps catch the sun. Lower down: darker, with some brown dead fronds.
      const light = y - top[x] < 2 ? 0.7 : y - top[x] < 4 ? 0.3 : patch(x, y, 12) > 0.6 ? 0.25 : 0.07;
      dot(g, x, y, speckle(x, y, light) ? c.scrubLight : speckle(y, x, 0.03) ? c.deadFrond : c.scrub);
    }
  }

  cabbagePalm(g, c, 98, MID_BASE, 20, 1);
  cabbagePalm(g, c, 113, MID_BASE + 1, 14, -1);
  cabbagePalm(g, c, 262, MID_BASE, 16, 1);
  return canvas;
}

// Near: sandy ground, the gravel area around the pad, the pad itself, the water tower, and big
// palms and palmettos in front.
function canaveralNear(c, ink) {
  const { canvas, g } = makeCanvas(W, H);

  // Sandy soil, speckled, with a strip of grass at the back.
  for (let y = GROUND_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let color = speckle(x, y, 0.1) ? c.sandShade : c.sand;
      if (y < GROUND_Y + 4) color = speckle(x, y, 0.5) ? c.scrubLight : c.scrub;
      dot(g, x, y, color);
    }
  }
  for (let x = 0; x < W; x++) if (hash2(x, 6) < 0.45) dot(g, x, GROUND_Y - 1, c.scrubLight); // grass tips

  scatterTufts(g, GROUND_Y, 80, c.scrub, c.scrubLight);
  padGravel(g, c.gravel, c.gravelLight);
  drawPad(g, ink);
  waterTower(g, c, 222, 146);

  // Big trees and bushes in front. They stay on the sides, so the middle is clear for the rocket.
  // Farther ones first, so the nearer ones are drawn over them.
  cabbagePalm(g, c, 272, 170, 44, -1);
  cabbagePalm(g, c, 46, 170, 50, 1);
  cabbagePalm(g, c, 300, 178, 64, 1);
  cabbagePalm(g, c, 16, 179, 70, -1);
  for (const [x, y, size] of [[10, 178, 9], [36, 180, 8], [86, 179, 6], [236, 180, 6], [284, 180, 9], [314, 176, 7]]) {
    palmetto(g, c, x, y, size);
  }
  return canvas;
}

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
function kodiak(ink) {
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

// ---------- 🖌️ Things to draw (shared, so the next sites can reuse them)

/**
 * Job: a cabbage palm: a straight, rough trunk and a round, shaggy crown of fan-shaped leaves.
 * @param {number} x - where the trunk meets the ground. @param {number} baseY - that row.
 * @param {number} height - trunk height in pixels. Taller = closer to us, so the trunk gets thicker.
 * @param {number} lean - 1 or -1: which way the trunk bends a little.
 */
function cabbagePalm(g, c, x, baseY, height, lean) {
  const trunkW = height > 40 ? 3 : height > 17 ? 2 : 1;
  let tx = x;
  for (let i = 0; i < height; i++) {
    tx = x + Math.round(Math.sin((i / height) * 1.4) * height * 0.08 * lean);
    box(g, tx, baseY - i, trunkW, 1, c.trunk);
    // Old leaf stubs left on the trunk, zig-zagging from side to side.
    if (trunkW > 1 && (i + (x & 1)) % 4 === 0) dot(g, tx + (i % 8 < 4 ? 0 : trunkW - 1), baseY - i, c.trunkLight);
  }

  // The crown: a full, round head of leaves in every direction from the top of the trunk, drooping
  // toward their tips. Leaves pointing up catch the sun (light); hanging ones are in shade (dark),
  // and a few old ones have turned brown. Big palms get thicker leaves.
  const cx = tx + Math.floor(trunkW / 2);
  const cy = baseY - height;
  const r = Math.max(3, Math.round(height * 0.3));
  const thick = r >= 9;
  disk(g, cx, cy, Math.max(1, Math.round(r * 0.45)), c.scrub); // the dense middle
  const leaves = 12 + r * 3;
  // Hanging leaves first, then the ones pointing up, so the sunlit ones sit on top.
  const order = [...Array(leaves).keys()].sort((p, q) => Math.sin((q / leaves) * 6.283) - Math.sin((p / leaves) * 6.283));
  for (const k of order) {
    const a = (k / leaves) * Math.PI * 2 + hash2(x, k) * 0.3;
    const len = r * (0.7 + hash2(k, x) * 0.4);
    const pointsUp = Math.sin(a) < -0.2;                     // on a canvas, y grows downward
    const dead = !pointsUp && hash2(k, x + 1) < 0.12;        // an old brown leaf
    for (let s = 1; s <= len; s++) {
      const lx = Math.round(cx + Math.cos(a) * s);
      const ly = Math.round(cy + Math.sin(a) * s * 0.75 + (s * s) / (len * 2.2)); // the s² term is the droop
      const color = dead ? c.deadFrond : pointsUp || s > len - 1.5 ? c.scrubLight : c.scrub;
      dot(g, lx, ly, color);
      if (thick) dot(g, lx, ly + 1, color);
    }
  }
}

// A saw palmetto: a low clump of stiff, spiky fan leaves. size = about how tall it is.
function palmetto(g, c, cx, baseY, size) {
  for (let f = 0; f < 4; f++) {
    const fx = cx + Math.round((hash2(cx, f) - 0.5) * size * 1.4);
    const fy = baseY - Math.round(size * 0.3 + hash2(f, cx) * size * 0.4);
    disk(g, fx, fy + 1, Math.max(1, Math.round(size * 0.3)), c.scrub);
    for (let deg = -165; deg <= -15; deg += 15) { // spokes fanning out over the top
      const a = (deg * Math.PI) / 180;
      for (let s = 2; s <= size; s++) {
        dot(g, Math.round(fx + Math.cos(a) * s), Math.round(fy + Math.sin(a) * s * 0.8), s > size - 2 ? c.scrubLight : c.scrub);
      }
    }
  }
}

// A small grass tuft: a dark root and three light blades.
function tuft(g, x, y, base, tip) {
  dot(g, x, y, base);
  dot(g, x - 1, y - 1, tip);
  dot(g, x + 1, y - 1, tip);
  dot(g, x, y - 2, tip);
}

// Scatters `count` grass tufts over the near ground, but none on the gravel around the pad.
function scatterTufts(g, groundY, count, base, tip) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash2(i, 7) * W);
    const y = groundY + 7 + Math.floor(hash2(i, 8) * (H - groundY - 7));
    if (y >= 150 && Math.abs(x - 160) < padHalf(y) + 4) continue;
    tuft(g, x, y, base, tip);
  }
}

// The gravel area: a wide oval of crushed rock around the pad (it widens toward us), with a
// soft, dithered edge. Every site has one, so the pad always sits on the same kind of ground.
function padGravel(g, base, light) {
  for (let y = 152; y < H; y++) {
    const half = padHalf(y);
    for (let x = Math.ceil(160 - half); x <= Math.floor(160 + half); x++) {
      const edge = Math.min(x - (160 - half), 160 + half - x); // how far inside the oval's edge
      if (edge < 3 && !mix(x, y, edge / 3)) continue;
      dot(g, x, y, hash2(x, y) < 0.15 ? light : base);
    }
  }
}

// A small marsh pond: a flat oval of water with a glint of sky on it.
function pond(g, c, cx, cy, r) {
  const ry = Math.max(1, Math.round(r / 3));
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(r * Math.sqrt(1 - (y / (ry + 1)) ** 2));
    box(g, cx - half, cy + y, half * 2 + 1, 1, c.seaLight);
  }
  box(g, cx - Math.round(r / 2), cy - ry + 1, Math.max(2, Math.round(r / 2)), 1, c.foam);
}

// The old Cape Canaveral lighthouse: a tapering tower painted in black and white bands, with a
// small glass room for the lamp on top.
function lighthouse(g, c, cx, baseY) {
  const HEIGHT = 30;
  for (let i = 0; i < HEIGHT; i++) {
    const width = i < 10 ? 6 : i < 20 ? 5 : 4; // narrower toward the top
    const left = cx - Math.floor(width / 2);
    const dark = Math.floor(i / 5) % 2 === 1;  // 5-pixel bands
    box(g, left, baseY - i, width, 1, dark ? c.stripeDark : c.stripeLight);
    if (!dark) dot(g, left + width - 1, baseY - i, c.trunkLight); // the shady side
  }
  const top = baseY - HEIGHT;
  box(g, cx - 4, top, 8, 1, c.stripeDark);     // the walkway around the lamp room
  box(g, cx - 2, top - 4, 4, 4, c.stripeDark); // the lamp room...
  box(g, cx - 1, top - 3, 2, 2, c.lamp);       // ...and its light
  box(g, cx - 2, top - 5, 4, 1, c.stripeDark); // the roof
  dot(g, cx - 1, top - 6, c.stripeDark);       // the vent on top
}

// Another launch pad far down the coast: a service tower with a rocket waiting beside it, and a
// tall lightning mast (real pads have them, so lightning hits the mast instead of the rocket).
function distantPad(g, c, x, baseY, h) {
  box(g, x - 4, baseY - h - 7, 1, h + 7, c.steelShade);                    // the lightning mast
  box(g, x, baseY - h, 3, h, c.steelShade);                                // the service tower...
  for (let y = baseY - h + 1; y < baseY; y += 3) dot(g, x + 1, y, c.steel); // ...and its lattice
  box(g, x + 4, baseY - h + 3, 2, h - 3, c.steel);                         // the rocket
  dot(g, x + 4, baseY - h + 2, c.steel);                                   // its nose
}

// A brown pelican gliding far away: just two bent wings.
function pelican(g, c, x, y) {
  for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, 0], [0, 1], [1, 0], [2, 0], [3, 1]]) dot(g, x + dx, y + dy, c.bird);
}

// The pad's water tower. At liftoff, real pads pour water over the pad to soak up the roar and heat.
function waterTower(g, c, cx, baseY) {
  const tankBottom = baseY - 36;
  const tankTop = tankBottom - 12;
  for (let y = tankBottom + 1; y < baseY; y++) { // three legs, spreading out toward the ground
    const spread = Math.round((y - tankBottom) * 0.15);
    dot(g, cx - 7 - spread, y, c.steelShade);
    dot(g, cx, y, c.steelShade);
    dot(g, cx + 6 + spread, y, c.steelShade);
  }
  for (let y = tankBottom + 6; y < baseY - 3; y += 10) { // cross braces
    const spread = Math.round((y - tankBottom) * 0.15);
    box(g, cx - 7 - spread, y, 14 + spread * 2, 1, c.steelShade);
  }
  for (let y = tankTop; y <= tankBottom; y++) { // the tank: round shoulders, lit from the left
    const inset = Math.max(0, tankTop + 3 - y) * 2;
    const l = cx - 10 + inset;
    const r = cx + 9 - inset;
    for (let x = l; x <= r; x++) dot(g, x, y, x < l + 3 ? c.tankLight : x > r - 3 ? c.tankShade : c.tank);
  }
  box(g, cx - 10, tankBottom, 20, 1, c.tankShade); // the tank's bottom rim
  dot(g, cx - 1, tankTop - 1, c.tankShade);        // a vent on top
}

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

// A small rocky island far out at sea, with grass on top.
function island(g, c, cx, baseY, halfW, h) {
  for (let x = cx - halfW; x <= cx + halfW; x++) {
    const top = Math.round(baseY - h * Math.sqrt(1 - ((x - cx) / (halfW + 1)) ** 2));
    for (let y = top; y < baseY; y++) dot(g, x, y, y - top < 2 ? c.grass : x > cx ? c.rockShade : c.rock);
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

// Which sites this file draws. The others still use the simple scene in launch-art.js.
const SITES = { canaveral, kodiak };
