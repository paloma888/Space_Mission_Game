// slices/finale/launch-art.js: the code-drawn placeholder art for the launch animation. Owner: Person 5.
// Each function here draws a picture ONCE, onto a small hidden canvas, when the launch starts.
// launch-anim.js then stamps those pictures onto the screen every frame, which is much faster than
// redrawing them pixel by pixel. When the team's PNGs arrive (site_<id>.png, rocket_<id>.png,
// capsule.png), launch-anim.js uses those instead and the matching function here goes quiet.

import { BAYER, hash, hash2 } from './pixel.js';

// ---------- Shared sizes (the art spec the team got uses these same numbers)
export const W = 320;          // art pixels across (shown 4x bigger: 1280)
export const H = 180;          // art pixels down (shown as 720)
export const PAD_Y = 150;      // the pad's top row: the rocket's bottom sits here
export const ROCKET_X = 160;   // the rocket's center column
export const SKY_TOP = 1700;   // the sky picture covers this much height above the pad; above that is space

// Colors described by what they should LOOK like. pickColors() (pixel.js) swaps each one for the
// closest of the team's 16, so this keeps working if the palette changes again.
export const LAUNCH_COLORS = {
  // sky, from the ground up
  skyLow: '#c8dcf0', skyMid: '#6a98d0', skyHigh: '#1e3c78', spaceDeep: '#0c1630', space: '#020410',
  stormLight: '#8c8478', stormDark: '#706860', cloud: '#d0e0f0', cloudShade: '#8e867c',
  star: '#d0e0f8', starWarm: '#ecc0a0', starDim: '#8a8178',
  // the ground and scenery
  sea: '#24407a', seaLight: '#70a0d8', sand: '#ecc4a8', sandShade: '#dca07c', grass: '#86b086',
  grassShade: '#446c44', snow: '#d4e2f4', snowShade: '#7aa0d0', rock: '#8a8278', rockShade: '#706860',
  trunk: '#905a40', leaf: '#4a6c48', leafLight: '#8ab088',
  // the pad and the tower
  concrete: '#8e867c', concreteShade: '#6e665e', trench: '#0e1628', tower: '#c06a50', towerShade: '#82402e',
  beacon: '#e0b048',
  // the rocket and its fire
  body: '#d6e2f0', bodyShade: '#8c847a', bodyLight: '#eac2a6', stripe: '#be6a52', ring: '#10192e',
  nozzle: '#746b61', window: '#6d95ca', soot: '#726a60',
  flameCore: '#f8e0c0', flame: '#e2b44c', flameOuter: '#d47a3c', flameTip: '#b8604a',
  smoke: '#d2e0f0', smokeMid: '#8c8478', smokeDark: '#6c645c',
  // the capsule in orbit and Earth below it
  light: '#e0b048', alarm: '#c0604a', ok: '#88b084', ocean: '#6a98d0', land: '#80b080', landShade: '#446c44',
};

// What each launch site looks like until its real background is drawn (the sites from Amendment A1).
//   far: what's on the horizon    ground: what the pad stands on    props: decorations on the sides
export const SCENES = {
  canaveral: { far: 'sea', ground: 'sand', props: 'palms' },
  kodiak: { far: 'mountains', ground: 'snow', props: 'pines' },
  kourou: { far: 'jungle', ground: 'grass', props: 'bushes' },
  mahia: { far: 'hills', ground: 'grass', props: 'rocks' },
  sriharikota: { far: 'sea', ground: 'sand', props: 'palms' },
};

const HORIZON = 136;           // where the ground starts in the placeholder scenes

// ---------- Tiny drawing helpers. `g` is a canvas's drawing tool; colors are '#rrggbb' strings.

// A hidden canvas to draw on. Smoothing off, so scaled pixels stay sharp squares.
export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { canvas, g };
}
const dot = (g, x, y, color) => { g.fillStyle = color; g.fillRect(x, y, 1, 1); };
const box = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
// A filled pixel circle, drawn one row at a time.
function disk(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

// ---------- The sky

/**
 * Job: where the sky changes color, by height above the pad: pale near the ground, blue, navy, then space.
 * @param {Object} C - palette numbers by role (from pickColors).
 * @param {string} weather - launch-day weather kind. Rain and storms start grey until the clouds are behind us.
 * @param {number} low - optional palette number for the sky right above the ground (taken from the team's
 *   background picture, so our sky continues it without a seam).
 * @returns {Array} - [[height, paletteNumber], ...]. Between two stops the colors are dithered together.
 */
export function skyStops(C, weather, low) {
  const cloudy = weather === 'storm' || weather === 'rain';
  const base = low ?? (weather === 'storm' ? C.stormDark : cloudy ? C.stormLight : C.skyLow);
  if (cloudy) {
    return [[0, base], [330, base], [450, C.skyMid], [520, C.skyMid], [760, C.skyHigh], [1050, C.spaceDeep], [1340, C.space]];
  }
  const fromArt = low != null; // a background picture covers the first 150 px of height, so start later
  return [[0, base], [fromArt ? 160 : 70, base], [fromArt ? 260 : 170, C.skyMid], [430, C.skyMid],
    [730, C.skyHigh], [1030, C.spaceDeep], [1330, C.space]];
}

/**
 * Job: draws the whole sky as one tall, thin picture (4 pixels wide, SKY_TOP tall).
 *   The sky looks the same all the way across, so launch-anim.js just repeats this strip sideways
 *   and slides it down as the rocket climbs. Between two colors it uses the BAYER pattern to fade.
 * @param {Object} pal - the palette (we write pixel values directly, so we need its rgb numbers).
 * @param {Array} stops - from skyStops().
 * @returns {HTMLCanvasElement}
 */
export function buildSkyStrip(pal, stops) {
  const { canvas, g } = makeCanvas(4, SKY_TOP);
  const img = g.createImageData(4, SKY_TOP);
  for (let row = 0; row < SKY_TOP; row++) {
    const height = SKY_TOP - 1 - row; // row 0 is the TOP of the strip: the highest point
    for (let x = 0; x < 4; x++) {
      const [r, gg, b] = pal.rgb[colorAtHeight(stops, height, BAYER[(row & 3) * 4 + x])];
      const i = (row * 4 + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// Which color the sky is at this height. `b` is this pixel's dither threshold, from BAYER.
function colorAtHeight(stops, height, b) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [h0, c0] = stops[i];
    const [h1, c1] = stops[i + 1];
    if (height < h1) return height <= h0 ? c0 : ((height - h0) / (h1 - h0) > b ? c1 : c0);
  }
  return stops[stops.length - 1][1];
}

// ---------- The launch site (placeholder until the team's site_<id>.png exists)

/**
 * Job: draws the placeholder launch site: horizon, ground, side decorations and the pad.
 *   The sky part is left see-through, because the sky strip is drawn behind it.
 * @param {Object} ink - colors by role, as '#rrggbb' strings.
 * @param {string} siteId - 'canaveral', 'kodiak', 'kourou', 'mahia' or 'sriharikota'.
 * @returns {HTMLCanvasElement} - 320x180, the same size as a real background.
 */
export function buildScene(ink, siteId) {
  const scene = SCENES[siteId] ?? SCENES.canaveral;
  const { canvas, g } = makeCanvas(W, H);

  if (scene.far === 'sea' || scene.far === 'hills') drawSea(g, ink);
  if (scene.far === 'mountains') drawMountains(g, ink);
  if (scene.far === 'jungle') drawTreeline(g, ink);
  if (scene.far === 'hills') drawHills(g, ink);

  drawGround(g, ink, scene.ground);

  // Decorations stay on the left and right, so the middle is clear for the rocket and tower.
  const spots = [30, 72, 248, 290];
  for (const [i, x] of spots.entries()) {
    if (scene.props === 'palms') drawPalm(g, ink, x, HORIZON + 10 + (i % 2) * 6, i % 2 ? 1 : -1);
    if (scene.props === 'pines') drawPine(g, ink, x, HORIZON + 8 + (i % 2) * 8);
    if (scene.props === 'bushes') {                     // a round jungle bush with a lit top
      disk(g, x, HORIZON + 4, 9 + (i % 2) * 3, ink.leaf);
      disk(g, x - 2, HORIZON + 1, 5, ink.leafLight);
    }
    if (scene.props === 'rocks') {                      // a small rock with a shadow under it
      disk(g, x, HORIZON + 12, 3 + (i % 3), ink.rock);
      box(g, x - 5, HORIZON + 13, 11, 3, ink.rockShade);
    }
  }

  drawPad(g, ink);
  return canvas;
}

// A strip of sea along the horizon, with little light glints.
function drawSea(g, ink) {
  for (let y = HORIZON - 12; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const glint = y === HORIZON - 12 || hash2(x >> 1, y) < 0.08;
      dot(g, x, y, glint ? ink.seaLight : ink.sea);
    }
  }
}

// Snowy peaks along the horizon. Each column is as tall as its highest nearby peak.
function drawMountains(g, ink) {
  const peaks = [[16, 46], [60, 36], [104, 28], [216, 32], [258, 44], [304, 38]];
  for (let x = 0; x < W; x++) {
    let height = 0, peak = peaks[0];
    for (const p of peaks) {
      const h = p[1] - Math.abs(x - p[0]) * 1.1;
      if (h > height) { height = h; peak = p; }
    }
    const shady = x > peak[0]; // the right side of each peak faces away from the Sun
    for (let y = Math.round(HORIZON - height); y < HORIZON; y++) {
      const snowy = HORIZON - y > peak[1] - 9;
      dot(g, x, y, snowy ? (shady ? ink.snowShade : ink.snow) : (shady ? ink.rockShade : ink.rock));
    }
  }
}

// A bumpy line of jungle trees along the horizon.
function drawTreeline(g, ink) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(HORIZON - 10 - 5 * Math.abs(Math.sin(x * 0.13)) - 4 * hash2(x >> 3, 7));
    for (let y = top; y < HORIZON; y++) dot(g, x, y, y - top < 2 && hash2(x, y) < 0.6 ? ink.leafLight : ink.leaf);
  }
}

// Green coastal hills, one big one on the right and a small one on the left.
function drawHills(g, ink) {
  for (let x = 0; x < W; x++) {
    const big = 30 * Math.max(0, 1 - ((x - 290) / 80) ** 2);
    const small = 12 * Math.max(0, 1 - ((x - 20) / 45) ** 2);
    const top = Math.round(HORIZON - Math.max(big, small));
    for (let y = top; y < HORIZON; y++) dot(g, x, y, hash2(x, y) < 0.15 ? ink.grassShade : ink.grass);
  }
}

// The ground from the horizon down, speckled so it doesn't look flat.
function drawGround(g, ink, kind) {
  const [base, shade] = { sand: [ink.sand, ink.sandShade], snow: [ink.snow, ink.snowShade], grass: [ink.grass, ink.grassShade] }[kind];
  for (let y = HORIZON; y < H; y++) {
    for (let x = 0; x < W; x++) dot(g, x, y, y === HORIZON || hash2(x, y) < 0.12 ? shade : base);
  }
}

// A palm tree: a curving trunk and drooping fronds. dir (1 or -1) is which way it leans.
function drawPalm(g, ink, x, baseY, dir) {
  let tx = x, ty = baseY;
  for (let i = 0; i < 22; i++) {
    tx = x + Math.round(Math.sin((i / 22) * 1.3) * 4 * dir);
    ty = baseY - i;
    box(g, tx, ty, 2, 1, i % 3 ? ink.trunk : ink.towerShade);
  }
  for (const a of [-2.8, -2.2, -1.6, -1.0, -0.4, 0.2]) { // frond directions, in radians
    for (let s = 1; s < 10; s++) {
      const fx = Math.round(tx + Math.cos(a) * s);
      const fy = Math.round(ty + Math.sin(a) * s + 0.09 * s * s); // + s² makes them droop
      dot(g, fx, fy, ink.leaf);
      dot(g, fx, fy - 1, ink.leafLight);
    }
  }
}

// A snowy pine tree: three stacked triangles on a short trunk.
function drawPine(g, ink, x, baseY) {
  box(g, x - 1, baseY - 3, 2, 3, ink.trunk);
  for (let tier = 0; tier < 3; tier++) {
    const top = baseY - 24 + tier * 6;
    for (let r = 0; r < 10; r++) {
      const half = Math.round(1 + r * (0.5 + tier * 0.15));
      box(g, x - half, top + r, half * 2, 1, ink.leaf);
      if (r === 0 || hash2(x + r, tier) < 0.3) dot(g, x - half, top + r, ink.snow); // snow on the edges
    }
  }
}

// The concrete launch pad, with a dark flame trench under the rocket. Its top surface is row PAD_Y.
function drawPad(g, ink) {
  box(g, 128, PAD_Y + 8, 64, 4, ink.concreteShade);   // wide base step
  box(g, 134, PAD_Y, 52, 10, ink.concreteShade);      // the pad block
  box(g, 134, PAD_Y, 52, 2, ink.concrete);            // its flat top surface
  box(g, 152, PAD_Y + 2, 16, 8, ink.trench);          // the flame trench: fire and smoke go down here
}

/**
 * Job: a see-through fog layer for foggy launch days, thicker near the ground.
 * @returns {HTMLCanvasElement} - 320x180, drawn on top of the site and scrolled with it.
 */
export function buildFog(ink) {
  const { canvas, g } = makeCanvas(W, H);
  for (let y = 60; y < H; y++) {
    const thick = Math.min(1, (y - 60) / 110) * 0.6;
    for (let x = 0; x < W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < thick) dot(g, x, y, ink.cloud);
  }
  return canvas;
}

// ---------- The launch tower (always ours: the art spec leaves room for it)

/**
 * Job: the red lattice tower next to the rocket, with a thin lightning mast on top.
 *   The crew arm and the blinking beacon move, so launch-anim.js draws those itself every frame.
 * @param {number} height - tower height in pixels (the mast adds 10 more).
 * @returns {HTMLCanvasElement} - 9 pixels wide.
 */
export function buildTower(ink, height) {
  const { canvas, g } = makeCanvas(9, height + 10);
  box(g, 4, 0, 1, 10, ink.rockShade);                      // lightning mast
  for (let y = 10; y < height + 10; y++) {
    dot(g, 0, y, ink.tower);                               // left rail
    dot(g, 8, y, ink.tower);                               // right rail
    const k = (y - 10) % 8;                                // every 8 rows: a brace and a cross
    if (k === 0) box(g, 0, y, 9, 1, ink.towerShade);
    else { dot(g, k, y, ink.towerShade); dot(g, 8 - k, y, ink.towerShade); }
  }
  box(g, 0, 10, 9, 2, ink.tower);                          // a cap on top
  return canvas;
}

// ---------- The rocket (placeholder until the team's rocket_<id>.png exists)

// Rough sizes per rocket (rockets.json ids). upper = capsule + upper stage, lower = first stage.
const ROCKET_SHAPES = {
  sparrow: { w: 8, upper: 18, lower: 26, fins: true, boosters: false },
  condor: { w: 10, upper: 26, lower: 38, fins: true, boosters: false },
  condor_reflown: { w: 10, upper: 26, lower: 38, fins: true, boosters: false, soot: true },
  pelican: { w: 12, upper: 28, lower: 44, fins: false, boosters: true },
};

/**
 * Job: draws a placeholder rocket in pieces, so it can come apart at separation.
 * @param {string} rocketId - 'sparrow', 'condor', 'condor_reflown' or 'pelican'.
 * @returns {Object} - { upper, lower, boosters, coreW }: upper = capsule and upper stage, lower = first stage,
 *   boosters = [left, right] side boosters (Pelican only, else null), coreW = the body's width.
 */
export function buildRocket(ink, rocketId) {
  const s = ROCKET_SHAPES[rocketId] ?? ROCKET_SHAPES.condor;
  return {
    upper: drawUpperStage(ink, s),
    lower: drawLowerStage(ink, s),
    boosters: s.boosters ? [drawBooster(ink, false), drawBooster(ink, true)] : null,
    coreW: s.w,
  };
}

// One row of rocket body: a light edge on the left, shade on the right, so it looks round.
function bodyRow(g, ink, x0, w, y, color = ink.body) {
  box(g, x0, y, w, 1, color);
  dot(g, x0, y, ink.bodyLight);
  box(g, x0 + w - (w > 6 ? 2 : 1), y, w > 6 ? 2 : 1, 1, ink.bodyShade);
}

// The capsule (pointed top, with a window) on top of the upper stage.
function drawUpperStage(ink, s) {
  const { canvas, g } = makeCanvas(s.w, s.upper);
  const cx = s.w / 2;
  for (let row = 0; row < 10; row++) {                     // the capsule's cone
    const half = Math.max(1, Math.round(((row + 1) / 10) * cx));
    bodyRow(g, ink, cx - half, half * 2, row);
  }
  box(g, cx - 2, 5, 2, 2, ink.window);                     // the crew window
  box(g, 0, 10, s.w, 1, ink.ring);                         // where capsule meets rocket
  for (let row = 11; row < s.upper - 3; row++) bodyRow(g, ink, 0, s.w, row);
  const mid = Math.round((11 + s.upper - 3) / 2);
  box(g, 0, mid, s.w, 2, ink.stripe);                      // a painted stripe
  box(g, 2, s.upper - 3, s.w - 4, 3, ink.nozzle);          // the upper stage's own small engine
  return canvas;
}

// The first stage: interstage ring, body, stripe, fins and the big engine bell.
function drawLowerStage(ink, s) {
  const extra = s.fins ? 3 : 0;                            // fins stick out 3 pixels each side
  const width = s.w + extra * 2;
  const { canvas, g } = makeCanvas(width, s.lower);
  box(g, extra, 0, s.w, 2, ink.ring);
  for (let row = 2; row < s.lower - 4; row++) bodyRow(g, ink, extra, s.w, row);
  box(g, extra, 5, s.w, 2, ink.stripe);
  if (s.soot) {                                            // a reflown booster is a bit scorched
    for (let row = Math.round(s.lower / 2); row < s.lower - 4; row++) {
      for (let x = extra; x < extra + s.w; x++) if (hash2(x, row) < 0.2) dot(g, x, row, ink.soot);
    }
  }
  if (s.fins) {
    for (let i = 0; i < 10; i++) {
      const fw = Math.min(3, Math.floor(i / 3) + 1);
      const y = s.lower - 14 + i;
      box(g, extra - fw, y, fw, 1, ink.stripe);
      box(g, extra + s.w, y, fw, 1, ink.towerShade);
    }
  }
  for (let i = 0; i < 4; i++) box(g, extra + 2 - Math.floor(i / 2), s.lower - 4 + i, s.w - 4 + Math.floor(i / 2) * 2, 1, ink.nozzle);
  return canvas;
}

// A side booster (Pelican Heavy): 6 wide, pointed top, small engine bell.
function drawBooster(ink, rightSide) {
  const { canvas, g } = makeCanvas(6, 34);
  for (let row = 0; row < 5; row++) {
    const half = Math.max(1, Math.round(((row + 1) / 5) * 3));
    box(g, 3 - half, row, half * 2, 1, ink.body);
  }
  for (let row = 5; row < 30; row++) {
    box(g, 0, row, 6, 1, ink.body);
    dot(g, rightSide ? 5 : 0, row, ink.bodyShade);
  }
  box(g, 0, 8, 6, 2, ink.stripe);
  box(g, 1, 30, 4, 4, ink.nozzle);
  return canvas;
}

/**
 * Job: turns the team's single rocket picture into two pieces for separation: the top 60% flies on,
 *   the bottom 40% falls away.
 * @param {HTMLImageElement} img - the loaded rocket_<id>.png.
 * @returns {Object} - { upper, lower, boosters: null, coreW } like buildRocket.
 */
export function splitRocketImage(img, split = 0.6) {
  const cut = Math.round(img.height * split);
  const upper = makeCanvas(img.width, cut);
  upper.g.drawImage(img, 0, 0, img.width, cut, 0, 0, img.width, cut);
  const lower = makeCanvas(img.width, img.height - cut);
  lower.g.drawImage(img, 0, cut, img.width, img.height - cut, 0, 0, img.width, img.height - cut);
  return { upper: upper.canvas, lower: lower.canvas, boosters: null, coreW: img.width };
}

// ---------- The capsule alone in orbit (the space scene for emergencies)

// Where the capsule's window and alarm light are, so launch-anim.js can light them up.
export const CAPSULE_WINDOW = { x: 6, y: 4, w: 4, h: 3 };
export const CAPSULE_BEACON = { x: 7, y: 0, w: 2, h: 2 };

/**
 * Job: the crew capsule seen in orbit: a cone with a dark window, heat shield at the bottom.
 * @param {boolean} dim - true for the "power is out" version, in darker colors.
 * @returns {HTMLCanvasElement} - 16 wide, 14 tall.
 */
export function buildCapsule(ink, dim) {
  const { canvas, g } = makeCanvas(16, 14);
  box(g, 7, 0, 2, 2, dim ? ink.rockShade : ink.bodyShade);  // docking nub (and alarm light spot)
  for (let row = 2; row < 11; row++) {
    const half = Math.round(2 + (row - 2) * 0.68);
    box(g, 8 - half, row, half * 2, 1, dim ? ink.bodyShade : ink.body);
    dot(g, 8 - half, row, dim ? ink.bodyShade : ink.bodyLight);
    dot(g, 8 + half - 1, row, dim ? ink.rockShade : ink.bodyShade);
  }
  box(g, CAPSULE_WINDOW.x, CAPSULE_WINDOW.y, CAPSULE_WINDOW.w, CAPSULE_WINDOW.h, ink.ring); // window (lit by launch-anim.js)
  box(g, 0, 11, 16, 3, ink.nozzle);                          // heat shield: faces Earth on the way home
  return canvas;
}

// ---------- Clouds, smoke and Earth

/**
 * Job: one puffy cloud made of overlapping circles, with a shaded underside.
 * @param {number} seed - picks this cloud's shape (same seed, same cloud).
 * @param {boolean} stormy - grey storm cloud instead of a white one.
 * @returns {HTMLCanvasElement} - 46 wide, 18 tall.
 */
export function buildCloud(ink, seed, stormy) {
  const { canvas, g } = makeCanvas(46, 18);
  const lit = stormy ? ink.stormLight : ink.cloud;
  const shade = stormy ? ink.stormDark : ink.cloudShade;
  const blobs = Array.from({ length: 5 }, (_, k) => [7 + k * 8 + Math.round(hash(seed * 13 + k) * 3),
    10 - Math.round(hash(seed * 29 + k) * 3) - (k === 2 ? 2 : 0), 4 + Math.round(hash(seed * 7 + k) * 2)]);
  for (const [x, y, r] of blobs) disk(g, x, y + 2, r, shade);  // the shadow underneath first...
  for (const [x, y, r] of blobs) disk(g, x, y, r, lit);        // ...then the bright top over it
  return canvas;
}

/**
 * Job: makes smoke-puff pictures on demand and remembers them (a "cache"), so each size and shade
 *   is drawn only once, however many puffs use it.
 * @returns {Function} - puff(radius, tone) -> canvas. tone 0 = white smoke, 1 = grey, 2 = dark.
 */
export function makePuffCache(ink) {
  const tones = [[ink.smoke, ink.smokeMid], [ink.smokeMid, ink.smokeDark], [ink.smokeDark, ink.trench]];
  const cache = new Map();
  return (r, tone) => {
    const key = `${r}:${tone}`;
    if (!cache.has(key)) {
      const { canvas, g } = makeCanvas(r * 2 + 1, r * 2 + 1);
      disk(g, r, r, r, tones[tone][1]);                     // darker circle...
      if (r > 0) disk(g, r - 1, r - 1, r - 1, tones[tone][0]); // ...lighter one shifted up-left: a shaded puff
      cache.set(key, canvas);
    }
    return cache.get(key);
  };
}

/**
 * Job: the curved edge of Earth at the bottom of the space scene, with a thin glowing atmosphere.
 *   It's the top of a huge circle; we only ever see its upper edge.
 * @returns {HTMLCanvasElement} - 320x180, see-through above the Earth.
 */
export function buildEarthLimb(ink) {
  const { canvas, g } = makeCanvas(W, H);
  const R = 320, cx = 160, cy = 112 + R;      // the circle's top touches row 112
  for (let y = 106; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R + 3) continue;
      let color;
      if (d > R + 1.5) color = BAYER[(y & 3) * 4 + (x & 3)] < 0.5 ? ink.skyMid : null;  // faint outer glow
      else if (d > R) color = ink.skyLow;                                              // bright rim
      else {
        const land = Math.sin(x * 0.045) + Math.sin(x * 0.11 + y * 0.2) * 0.6 + Math.sin(y * 0.31) * 0.4;
        const cloudy = Math.sin(x * 0.07 + y * 0.9) > 0.85 && hash2(x >> 1, y) < 0.7;
        color = cloudy ? ink.cloud : land > 0.9 ? (y > 150 ? ink.landShade : ink.land) : (y > 158 ? ink.sea : ink.ocean);
      }
      if (color) dot(g, x, y, color);
    }
  }
  return canvas;
}
