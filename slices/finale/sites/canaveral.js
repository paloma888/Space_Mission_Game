// slices/finale/sites/canaveral.js: Cape Canaveral, Florida, drawn in code. Owner: Person 5, Erick.
// See sites/index.js for how the 3 layers (far, mid, near) and parallax work.

import {
  W, H, makeCanvas, drawPad, dot, box, disk, hash2, RATES, mix, speckle, patch, scatterTufts, padGravel,
} from './draw.js';

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
export function canaveral(ink) {
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

// ---------- 🖌️ Things only Canaveral draws

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
