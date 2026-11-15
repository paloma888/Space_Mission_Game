// slices/finale/launch-anim.js: the launch animation. Owner: Person 5.
// A 320x180 canvas shown at 4x, like the globe. It NEVER rolls dice: playLaunch() in finale.js reads
// the launch result and calls the "beats" below in order (stage, lightning, fail, zoomOut...), so the
// pictures always match the numbers.
//
// 🎬 How one frame is made (about 60 times a second, see tick() at the bottom):
//   1. update(): move the rocket (speed and height), the camera, the smoke and falling pieces
//   2. draw everything onto a hidden canvas `frame`, back to front:
//        sky -> stars -> clouds -> launch site -> tower -> rocket and flames -> smoke -> weather
//   3. copy `frame` onto the canvas you see, nudged a pixel or two when the screen shakes
//
// Art: the team's PNGs are used when they exist; until then launch-art.js draws placeholders.
//   art/sprites/rocket_<id>.png (fitted to our size by fitSprite), art/sprites/capsule.png. The launch
//   sites are always our own code-drawn scenes (sites/).

import { hash, clampN, readPalette, pickColors, BAYER } from './pixel.js';
import {
  W, H, PAD_Y, ROCKET_X, SKY_TOP, LAUNCH_COLORS, CAPSULE_WINDOW, CAPSULE_BEACON,
  makeCanvas, skyStops, buildSkyStrip, buildScene, buildFog, buildTower, buildRocket, splitRocketImage,
  buildCapsule, buildCloud, makePuffCache, buildEarthLimb, buildSaucer, SAUCER_LIGHTS, fitSprite,
} from './launch-art.js';
import { buildSite } from './sites/index.js';

const FOLLOW_Y = 118;   // once it climbs, the camera keeps the rocket's base on this row
const HOLD_DOWN = 0.8;  // seconds the engines roar before the rocket lets go of the pad (like real clamps)
const COAST = 0.5;      // seconds of quiet between the first stage letting go and the upper engine lighting
const TOWER_H = 98;     // launch tower height, in art pixels
const MAX_PUFFS = 320;  // most smoke puffs on screen at once, so slower computers keep up
// 🚀 How hard the rocket speeds up in each beat, in pixels per second². Tuned for 3-second beats:
// it clears the tower by LIFTOFF, passes the clouds by MAX-Q and reaches black space by ORBIT.
const ACCEL = { liftoff: 12, maxq: 24, separation: 40, orbit: 55 };

/**
 * Job: turns climbed pixels into an APPROXIMATE altitude for the on-screen counter.
 *   Tuned so a normal climb reads about 12 km at max-Q, about 50 km at separation and 200 km at
 *   orbit. Checked Sun Nov 15: 200 km is in low Earth orbit ("the first 100 to 200 miles (161 to
 *   322 km) of space", NASA: What Is an Orbit? Grades 5-8). Where max-Q and separation happen
 *   depends on the rocket, and NASA gives no single number, so those two stay approximate (≈).
 * @param {number} px - art pixels climbed.
 * @returns {number} - kilometers, rounded, never more than 200.
 */
function altitudeKm(px) {
  return Math.min(200, Math.round(0.0419 * px + 0.0000632 * px * px));
}

/**
 * Job: puts the launch animation on the page and returns the "beats" playLaunch() calls.
 * @param {HTMLElement} parent - the screen from ui.screen().
 * @param {Object} state - the shared backpack. Reads site, rocket and launchWeather. Never changes it.
 * @param {Object} opts - { sleep, altitudeEl }:
 *   sleep - the Skip-aware pause from finale.js, so Skip also skips the animation's own waits
 *   altitudeEl - an element to show "ALTITUDE ≈ 12 KM" in
 * @returns {Object} - the beats: countdown, stage, lightning, fail, toSpace, alarm, settle, headHome, abduct,
 *   zoomOut, and destroy() to stop the animation.
 * ⭐
 */
export function mountLaunchAnim(parent, state, opts = {}) {
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; // the computer asks for less motion
  let alive = true;

  // ---------- Canvases. `canvas` is the one you see. Each frame is drawn on the hidden `frame` first
  // and then copied over, so a screen shake moves the whole picture as one piece (buttons stay still).
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.className = 'fin-canvas fin-launch-canvas';
  canvas.setAttribute('aria-label', 'Your rocket launching');
  parent.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const { canvas: frame, g } = makeCanvas(W, H);

  // A cover for fades: to dark after a failure, a quick white flash before the globe.
  const veil = document.createElement('div');
  veil.className = 'fin-veil';
  parent.append(veil);

  // ---------- Colors: every color is picked by description from the team's palette (pixel.js).
  const pal = readPalette();
  const C = pickColors(pal, LAUNCH_COLORS);                                                  // role -> number
  const ink = Object.fromEntries(Object.entries(C).map(([role, i]) => [role, pal.hex[i]]));  // role -> '#rrggbb'
  const weather = state.launchWeather?.kind ?? 'clear';
  const stormy = weather === 'storm' || weather === 'rain';

  // ---------- Art, drawn once now (placeholders until the team's pictures exist)
  const art = {
    sky: g.createPattern(buildSkyStrip(pal, skyStops(C, weather)), 'repeat-x'),
    // The launch site as layers [{ img, rate }], far to near (sites/index.js). A site that isn't
    // drawn there yet gets the simple scene as one layer that moves with the ground.
    site: buildSite(ink, state.site ?? 'canaveral') ?? [{ img: buildScene(ink, state.site), rate: 1 }],
    fog: weather === 'fog' ? buildFog(ink) : null,
    tower: buildTower(ink, TOWER_H),
    rocket: buildRocket(ink, state.rocket),
    capsule: buildCapsule(ink, false),
    capsuleDim: buildCapsule(ink, true),
    capsuleImg: null,
    limb: null,               // Earth's edge for the space scene, drawn the first time we need it
    puff: makePuffCache(ink),
    clouds: [],
  };
  // Clouds hang at fixed heights and the rocket flies past them. Rainy days get more, and grey.
  for (let k = 0; k < (stormy ? 12 : 7); k++) {
    art.clouds.push({
      img: buildCloud(ink, k, stormy),
      x: Math.round(hash(k * 17 + 3) * 360) - 40,
      h: (stormy ? 140 : 180) + k * (stormy ? 26 : 55) + Math.round(hash(k * 31 + 5) * 30),
    });
  }
  // The tower stands just to the right of the rocket.
  const padHalfW = () => (art.rocket.boosters ? art.rocket.coreW / 2 + art.rocket.boosters[0].width : art.rocket.lower.width / 2);
  const towerX = () => Math.round(ROCKET_X + padHalfW() + 5);

  // The team's pictures replace the placeholders as soon as they load (if they exist yet).
  // The launch site is always our own scene (sites/), with its parallax layers. We don't borrow the
  // launch-week backgrounds (art/backgrounds/launchweek/): they're made for Paloma's screens, not
  // for a climbing camera.
  // The rocket: the team's picture can be any size, so fitSprite trims it and makes it as tall as our
  // placeholder for that rocket (the Sparrow small, the Pelican big).
  loadImage(`art/sprites/rocket_${state.rocket ?? 'condor'}.png`).then((img) => {
    if (!img || !alive || w.separated) return;
    const fitted = fitSprite(img, art.rocket.upper.height + art.rocket.lower.height);
    if (fitted) art.rocket = splitRocketImage(fitted);   // null: keep our placeholder rocket
  });
  loadImage('art/sprites/capsule.png').then((img) => { if (img && alive) art.capsuleImg = img; });

  // ---------- What's happening right now. The beats change it; update() moves it along.
  const w = {
    scene: 'rocket',    // 'rocket' (pad and climb) or 'space' (the capsule alone in orbit)
    phase: 'pad',       // the current beat: 'pad', 'liftoff', 'maxq', 'separation' or 'orbit'
    phaseT: 0,          // seconds since this beat started
    t: 0,               // seconds since the animation started
    alt: 0,             // height of the rocket's base above the pad, in art pixels
    v: 0,               // climbing speed, pixels per second
    climbed: 0,         // total distance climbed (feeds the altitude counter)
    camShift: 0,        // eases the camera after separation, so the view doesn't jump
    engine: false,      // engines lit?
    trouble: false,     // this beat is going to FAIL, so the flames start sputtering partway through
    failing: false,
    failT: 0,
    separated: false,
    sepT: 0,
    arm: 1,             // crew access arm: 1 = touching the rocket, 0 = swung back to the tower
    armMoving: false,
    flashLeft: 0,       // lightning: seconds left of the strike effect
    strikeSeed: 0,
    zoom: null,         // the Kirby fly-away, once it starts
    abduct: null,       // 🛸 the secret ending's saucer beat, once it starts
    lights: 'calm',     // capsule lights in space: 'calm', 'power', 'life_support', 'dark' or 'ok'
    lightsT: 0,         // seconds since the lights last changed
    battery: null,      // 🔋 power left (1 = full, 0 = empty) in a power emergency. null = no battery bar
    homeT: -1,         // seconds since the capsule turned for home (-1 = it hasn't)
    spaceT: -1,         // seconds since we started moving into space (-1 = not yet): the dissolve and Earth rising
  };
  const puffs = [];       // smoke puffs: { x, h, vx, vh, r0, r1, life, age, tone }
  const debris = [];      // pieces that fell off at separation
  const owed = {};        // smoke puffs "owed" per source (see spawn())
  let spawnCount = 0;     // counts every puff ever made; feeds hash() so each puff is different
  let frameCount = 0;
  let lastLabel = '';

  // ---------- 🎬 The beats. playLaunch() (finale.js) calls these in order, from the dice result.

  // Countdown tick: near the end, the crew access arm swings back to the tower.
  function countdown(n) {
    if (n <= 3) w.armMoving = true;
  }

  // A launch stage begins: 'liftoff' lights the engines. passed = false means this stage will fail.
  function stage(id, passed) {
    w.phase = id;
    w.phaseT = 0;
    w.trouble = !passed;
    if (id === 'liftoff') { w.engine = true; w.armMoving = true; }
  }

  // ⚡ A lightning strike: a flash and a bolt, twice half a second apart (once with reduced motion).
  function lightning() {
    w.flashLeft = calm ? 0.25 : 1;
    w.strikeSeed = frameCount;
  }

  // The launch failed (option a): flames sputter out, the climb slows to a stop, then a calm fade
  // with the message. We fade BEFORE anything falls: the crew is always safe (Amendment A2).
  async function fail(message) {
    w.failing = true;
    w.failT = 0;
    await sleep(1800);
    cover('dark', message);
    await sleep(2600);
  }

  // Cut to the capsule alone in orbit, above the curve of the Earth.
  // It's not a sudden cut: drawDissolve() breaks the climbing view up into the space view, and Earth's
  // edge rises into view from below while the capsule glides up into place.
  function toSpace() {
    w.scene = 'space';
    w.spaceT = 0;
    art.limb ??= buildEarthLimb(ink);
    setLights('calm');
  }

  // 🚨 An emergency in orbit starts. Power: the window light dims like a dying flashlight and a
  // battery bar drains (see updateBattery). Life support: a red alarm blinks.
  function alarm(type) {
    if (type === 'lightning') return;
    setLights(type === 'life_support' ? 'life_support' : 'power');
    if (type !== 'life_support') w.battery = 1;
  }

  // The emergency is over. Fixed: lights back to normal (plus a green light for life support,
  // or the battery refilling for power). Not fixed: the battery runs out and the lights go off
  // (power), or the red alarm keeps blinking (life support).
  function settle(type, saved) {
    if (type === 'lightning') return;
    if (saved) setLights(type === 'life_support' ? 'ok' : 'calm');
    else setLights(type === 'life_support' ? 'life_support' : 'dark');
  }

  // Came home early: the capsule drops toward Earth glowing orange (re-entry heat), then a calm fade.
  async function headHome(message) {
    w.homeT = 0;
    await sleep(3200);
    cover('dark', message);
    await sleep(2400);
  }

  // ✨ Success: the Kirby-style fly-away. It shrinks into the distance, a star twinkles where it vanished,
  // then a white flash (finale.js fades that white into the 3D globe).
  async function zoomOut() {
    w.zoom = startZoom();
    await sleep(2300);
    cover('white');
    await sleep(450);
  }

  // 🛸 The secret ending (only with the mysterious component, launching on the last day).
  // A flying saucer swoops in, holds the rocket in a green tractor beam, then zips off with it,
  // and a green flash leads into the globe. Timeline (seconds): 0-1.4 swoop in, 1.5-3.4 beam
  // (the rocket floats up a little), 3.4+ both shoot off the top. See drawAbduct().
  async function abduct() {
    art.saucer ??= buildSaucer(ink);
    w.abduct = { t: 0, ...snapshotRocket() };
    await sleep(4300);
    cover('green');
    await sleep(450);
  }

  // Stops the animation and removes the canvas (the cover stays until the next screen replaces it).
  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    canvas.remove();
  }

  function setLights(mode) {
    w.lights = mode;
    w.lightsT = 0;
  }

  // Fades the cover in: 'dark' (with a message) or a quick 'white' flash.
  function cover(kind, text = '') {
    veil.className = `fin-veil fin-veil-${kind}`;
    veil.textContent = text;
    void veil.offsetWidth; // let the browser see the "before" state, so the fade animates
    veil.classList.add('on');
  }

  // ---------- 1. Update: move everything a little (dt = seconds since the last frame)

  function update(dt) {
    frameCount += 1;
    w.t += dt;
    w.phaseT += dt;
    w.lightsT += dt;
    updateBattery(dt);
    if (w.failing) w.failT += dt;
    if (w.homeT >= 0) w.homeT += dt;
    if (w.spaceT >= 0) w.spaceT += dt;
    if (w.flashLeft > 0) w.flashLeft -= dt;
    if (w.zoom) w.zoom.t += dt;
    if (w.abduct) w.abduct.t += dt;
    if (w.armMoving) w.arm = Math.max(0, w.arm - dt * 1.2);

    // 🚀 The climb: speed grows by this beat's acceleration while the engines push.
    let push = pushing() ? (ACCEL[w.phase] ?? ACCEL.orbit) : 0;
    if (w.zoom) push = ACCEL.orbit;                  // keep flying during the fly-away
    if (w.abduct) { push = 0; w.v = 0; }             // the saucer has it now: drawAbduct() moves it
    if (w.failing) w.v *= Math.exp(-2.2 * dt);       // engines out: the climb slows to a stop
    w.v += push * dt;
    w.alt += w.v * dt;
    w.climbed += w.v * dt;
    w.camShift *= Math.exp(-3 * dt);                 // the camera eases back after separation

    if (w.phase === 'separation' && !w.trouble && !w.separated && w.phaseT >= 0.4) separate();
    updateSmoke(dt);
    for (const d of debris) {                        // fallen pieces drop away below us
      d.v -= 70 * dt;
      d.h += d.v * dt;
      d.x += d.vx * dt;
    }
  }

  // Are the engines pushing right now? Not before liftoff, not while held down, not between stages, not when failing.
  function pushing() {
    if (!w.engine || w.failing || w.phase === 'pad') return false;
    if (w.phase === 'liftoff' && w.phaseT < HOLD_DOWN) return false;
    if (w.separated && w.t - w.sepT < COAST) return false;
    return true;
  }

  // Is there fire under the rocket this frame? Sputtering = flickering on and off.
  function flameOn() {
    if (!w.engine || w.abduct) return false;          // in the tractor beam, the engines go quiet
    if (w.separated && w.t - w.sepT < COAST) return false;
    if (w.failing) return w.failT < 1 && hash(frameCount >> 1) > 0.5;
    if (w.trouble && w.phaseT > 1.6) return hash(frameCount >> 1) > 0.35;
    return true;
  }

  // How big the flames are: growing at ignition, biggest at max-Q, smaller for the upper stage.
  function flameSize() {
    if (w.phase === 'liftoff') return Math.min(1, w.phaseT / 0.5);
    if (w.phase === 'maxq') return 1.15;
    return w.separated ? 0.7 : 1;
  }

  // Separation: the first stage (and Pelican's side boosters) let go and fall away.
  function separate() {
    const r = art.rocket;
    w.separated = true;
    w.sepT = w.t;
    debris.push({ img: r.lower, x: ROCKET_X, h: w.alt, v: w.v, vx: 0 });
    if (r.boosters) {
      const off = r.coreW / 2 + 3;
      debris.push({ img: r.boosters[0], x: ROCKET_X - off, h: w.alt + 1, v: w.v, vx: -14 });
      debris.push({ img: r.boosters[1], x: ROCKET_X + off, h: w.alt + 1, v: w.v, vx: 14 });
    }
    for (let i = 0; i < 16; i++) {                   // a puff where the stages split
      addPuff(ROCKET_X + (rnd() - 0.5) * 8, w.alt + r.lower.height, (rnd() - 0.5) * 60, (rnd() - 0.5) * 20, 1, 4 + Math.round(rnd() * 2), 1.2, 0);
    }
    // The rocket is now just the upper stage, so its base is where the first stage's top was.
    // camShift cancels the jump; it then shrinks, so the camera glides up instead.
    w.alt += r.lower.height;
    w.camShift -= r.lower.height;
  }

  // ---------- 💨 Smoke

  // A fresh repeatable "random" number for each puff.
  const rnd = () => hash((spawnCount += 1) * 7919 + 13);

  function addPuff(x, h, vx, vh, r0, r1, life, tone) {
    if (puffs.length >= MAX_PUFFS) puffs.shift();    // too many: forget the oldest
    puffs.push({ x, h, vx, vh, r0, r1, life, age: 0, tone });
  }

  // Makes `rate` puffs per second from one source. A frame is short, so a source might owe
  // 0.4 of a puff: we keep that fraction and pay it back in a later frame.
  function spawn(source, rate, dt, make) {
    owed[source] = (owed[source] ?? 0) + rate * dt;
    while (owed[source] >= 1) {
      owed[source] -= 1;
      make();
    }
  }

  function updateSmoke(dt) {
    const wind = weather === 'wind' ? 14 : 0;        // windy days blow the smoke sideways
    for (const p of puffs) {
      p.age += dt;
      p.x += (p.vx + wind) * dt;
      p.h += p.vh * dt;
      p.vx *= Math.exp(-1.2 * dt);                   // air slows puffs down
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].age >= puffs[i].life) puffs.splice(i, 1);
    if (w.scene !== 'rocket') return;

    const base = w.alt;
    if (!w.engine) {                                 // before ignition: steam venting from the side
      spawn('steam', 6, dt, () => addPuff(ROCKET_X + padHalfW() + 1, rocketHeight() * 0.45, 10 + rnd() * 12, 3 + rnd() * 5, 1, 4, 1.8, 0));
    }
    if (flameOn() && !w.zoom) {
      if (base < 45) {                               // near the pad: big clouds billowing out sideways
        spawn('ground', 70, dt, () => {
          const dir = rnd() < 0.5 ? -1 : 1;
          addPuff(ROCKET_X + dir * (2 + rnd() * 6), rnd() * 3, dir * (22 + rnd() * 48), 3 + rnd() * 10, 2, 8 + Math.round(rnd() * 5), 2.4 + rnd(), 0);
        });
      }
      // In the air: a trail left behind the rocket. It stops once the sky turns dark: there's
      // almost no air up there for smoke to hang in.
      if (base >= 12 && base < 900) {
        spawn('trail', 30, dt, () => addPuff(ROCKET_X + (rnd() - 0.5) * 3, base - 3, (rnd() - 0.5) * 8, -5, 2, 5 + Math.round(rnd() * 2), 2.2, 0));
      }
    }
    if (w.failing && w.failT < 2.4) {                // a failed engine trails dark smoke
      spawn('fail', 18, dt, () => addPuff(ROCKET_X + (rnd() - 0.5) * 4, base - 2, (rnd() - 0.5) * 10, 3 + rnd() * 4, 2, 7, 2.6, 2));
    }
  }

  // ---------- 2. Draw

  // 📷 The camera follows the rocket up. camY = how far it has risen; everything else is drawn relative to it.
  function cameraY() {
    if (w.zoom) return w.zoom.camY;                  // frozen during the fly-away
    if (w.abduct) return w.abduct.camY;              // and while the saucer has the rocket
    return Math.max(0, Math.round(w.alt - (PAD_Y - FOLLOW_Y) + w.camShift));
  }
  // A height above the pad -> a row on screen. Higher up = smaller row number.
  const toScreen = (h, camY) => Math.round(PAD_Y - (h - camY));
  const rocketHeight = () => art.rocket.upper.height + (w.separated ? 0 : art.rocket.lower.height);

  function drawWorld() {
    const camY = cameraY();

    // Sky: fill with space black, then lay the sky strip over it, slid so each row shows its height.
    g.fillStyle = ink.space;
    g.fillRect(0, 0, W, H);
    const shift = camY + PAD_Y + 1 - SKY_TOP;      // the screen row where the strip's top row lands
    g.save();
    g.translate(0, shift);
    g.fillStyle = art.sky;
    g.fillRect(0, -shift, W, H);
    g.restore();

    // Far away: stars (once it's dark enough) and clouds.
    drawStars(clampN((camY - 650) / 600, 0, 1), camY * 0.04);
    for (const c of art.clouds) {
      const y = toScreen(c.h, camY) - c.img.height;
      if (y > -c.img.height && y < H) g.drawImage(c.img, c.x, y);
    }

    // The launch site slides down out of view as we climb. Each layer slides at its own rate:
    // far ones slower than near ones (parallax), so the horizon lingers while the ground drops away.
    for (const layer of art.site) {
      const y = Math.round(camY * layer.rate);
      if (y < H) g.drawImage(layer.img, 0, y);
    }
    if (art.fog && camY < H) g.drawImage(art.fog, 0, camY);
    drawTower(camY);

    // The rocket, the pieces that fell off it, and its smoke.
    for (const d of debris) {
      const y = toScreen(d.h, camY) - d.img.height;
      if (y < H) g.drawImage(d.img, Math.round(d.x - d.img.width / 2), y);
    }
    if (!w.zoom && !w.abduct) drawRocket(camY);    // during those two, drawZoom/drawAbduct draw it
    drawVapor(camY);
    drawSmoke(camY);

    // Weather and lightning on top.
    drawWeather(camY);
    drawLightning(camY);
  }

  // The tower, the crew arm (until it swings back) and a blinking beacon on top.
  function drawTower(camY) {
    const ground = toScreen(0, camY);
    if (ground - art.tower.height > H) return;     // scrolled away below the screen
    const tx = towerX();
    g.drawImage(art.tower, tx, ground - art.tower.height);
    const reach = tx - (ROCKET_X + Math.ceil(art.rocket.upper.width / 2));
    const len = Math.round(reach * w.arm);
    if (len > 0) {
      const armY = ground - (art.rocket.lower.height + art.rocket.upper.height - 12); // level with the capsule
      g.fillStyle = ink.concrete;
      g.fillRect(tx - len, armY, len, 2);
      g.fillStyle = ink.concreteShade;
      g.fillRect(tx - len, armY + 2, len, 1);
    }
    if (Math.floor(w.t) % 2 === 0) {
      g.fillStyle = ink.beacon;
      g.fillRect(tx + 3, ground - art.tower.height - 1, 3, 2);
    }
  }

  // The rocket in one piece (plus flames), or just the upper stage after separation.
  function drawRocket(camY) {
    const r = art.rocket;
    const baseY = toScreen(w.alt, camY);           // the screen row of the rocket's bottom
    const wobble = w.failing && w.failT < 2 ? Math.round(Math.sin(w.t * 9)) : 0;
    const x = ROCKET_X + wobble;
    const fire = flameOn();
    if (!w.separated) {
      if (fire) drawFlame(x, baseY, Math.max(3, r.coreW - 2), flameSize());
      if (r.boosters) {
        for (const [i, b] of r.boosters.entries()) {
          const bx = i ? x + r.coreW / 2 : x - r.coreW / 2 - b.width;
          if (fire) drawFlame(bx + b.width / 2, baseY - 1, 4, flameSize() * 0.8);
          g.drawImage(b, Math.round(bx), baseY - b.height - 1);
        }
      }
      g.drawImage(r.lower, Math.round(x - r.lower.width / 2), baseY - r.lower.height);
      g.drawImage(r.upper, Math.round(x - r.upper.width / 2), baseY - r.lower.height - r.upper.height);
    } else {
      if (fire) drawFlame(x, baseY, Math.max(2, r.upper.width - 4), flameSize());
      g.drawImage(r.upper, Math.round(x - r.upper.width / 2), baseY - r.upper.height);
    }
  }

  // 🔥 A flickering flame hanging from a nozzle: pale and hot at the top, then yellow, orange and red.
  function drawFlame(cx, topY, width, size) {
    const len = Math.round((8 + 12 * size) * (0.85 + 0.3 * hash(frameCount * 3 + Math.round(cx))));
    for (let i = 0; i < len; i++) {
      const f = i / len;                             // 0 at the nozzle, 1 at the tip
      const half = Math.max(0.5, (width / 2 + 1) * (1 - f * f));
      g.fillStyle = f < 0.2 ? ink.flameCore : f < 0.45 ? ink.flame : f < 0.75 ? ink.flameOuter : ink.flameTip;
      g.fillRect(Math.round(cx - half), topY + i, Math.max(1, Math.round(half * 2)), 1);
    }
    g.fillStyle = ink.flameCore;                     // a bright line down the middle
    g.fillRect(Math.round(cx) - 1, topY, 2, Math.round(len * 0.4));
  }

  // Max-Q: a flickering ring of cloud around the rocket where the air pushes hardest.
  function drawVapor(camY) {
    if (w.phase !== 'maxq' || w.failing || w.separated || w.zoom || w.phaseT < 0.8 || w.phaseT > 2.6) return;
    const cy = toScreen(w.alt + art.rocket.lower.height, camY);
    const rx = padHalfW() + 5;
    g.fillStyle = ink.cloud;
    for (let i = 0; i < 40; i++) {
      if (hash(frameCount * 41 + i) < 0.35) continue; // a broken, shimmering ring
      const a = (i / 40) * Math.PI * 2;
      g.fillRect(Math.round(ROCKET_X + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * 2.5), 1, 1);
    }
  }

  function drawSmoke(camY) {
    for (const p of puffs) {
      const k = p.age / p.life;
      const r = Math.round(p.r0 + (p.r1 - p.r0) * Math.min(1, k / 0.7));
      const tone = p.tone === 2 ? 2 : k > 0.65 ? 1 : 0; // white smoke turns grey as it thins out
      const y = toScreen(p.h, camY);
      if (y > -20 && y < H + 20) g.drawImage(art.puff(r, tone), Math.round(p.x) - r, y - r);
    }
  }

  // Stars. amount (0 to 1) = how many show; scroll slides them slowly as we climb.
  function drawStars(amount, scroll) {
    if (amount <= 0) return;
    for (let k = 0; k < 110; k++) {
      if (hash(k * 5 + 3) > amount) continue;
      const b = hash(k * 5 + 4);
      g.fillStyle = b > 0.8 ? ink.starWarm : b > 0.4 ? ink.star : ink.starDim;
      g.fillRect(Math.floor(hash(k * 5 + 1) * W), Math.floor((hash(k * 5 + 2) * H + scroll) % H), 1, 1);
    }
  }

  // Rain, snow or wind near the ground. It stays behind once the rocket climbs above the weather.
  function drawWeather(camY) {
    const amount = clampN(1 - camY / 260, 0, 1);
    if (amount <= 0) return;
    if (weather === 'rain' || weather === 'storm') {
      g.fillStyle = ink.seaLight;
      for (let k = 0; k < 90; k++) {
        if (hash(k * 3 + 3) > amount) continue;
        const y = ((hash(k * 3 + 2) * (H + 20) + w.t * 230) % (H + 20)) - 10;
        g.fillRect(Math.floor((hash(k * 3 + 1) * W + W - y * 0.25) % W), Math.floor(y), 1, 3);
      }
    }
    if (weather === 'cold') {
      g.fillStyle = ink.snow;
      for (let k = 0; k < 60; k++) {
        if (hash(k * 3 + 3) > amount) continue;
        const y = (hash(k * 3 + 2) * H + w.t * 16) % H;
        g.fillRect(Math.floor(hash(k * 3 + 1) * W + Math.sin(w.t * 1.5 + k) * 3), Math.floor(y), 1, 1);
      }
    }
    if (weather === 'wind') {
      g.fillStyle = ink.cloud;
      for (let k = 0; k < 24; k++) {
        if (hash(k * 3 + 3) > amount) continue;
        const x = ((hash(k * 3 + 1) * (W + 40) + w.t * 170) % (W + 40)) - 20;
        g.fillRect(Math.floor(x), 96 + Math.floor(hash(k * 3 + 2) * 70), 6, 1);
      }
    }
  }

  // ⚡ Two strikes half a second apart: a full-screen flash, then a zig-zag bolt down to the rocket's nose.
  // At most 2 flashes a second keeps it safe for players who are sensitive to flashing light.
  function drawLightning(camY) {
    if (w.flashLeft <= 0) return;
    const k = ((calm ? 0.25 : 1) - w.flashLeft) % 0.5;
    if (k < 0.05) {
      g.fillStyle = ink.cloud;
      g.fillRect(0, 0, W, H);
      return;
    }
    if (k > 0.2) return;
    const noseY = toScreen(w.alt + rocketHeight(), camY);
    let x = ROCKET_X - 30 + Math.round(hash(w.strikeSeed) * 60);
    let y = 0;
    for (let i = 0; y < noseY; i++) {
      const ny = Math.min(noseY, y + 7);
      const nx = ny >= noseY ? ROCKET_X : x + Math.round((hash(w.strikeSeed * 31 + i) - 0.5) * 12);
      line(x, y, nx, ny, ink.cloud);
      line(x + 1, y, nx + 1, ny, ink.flame);         // a yellow glow beside the white bolt
      x = nx;
      y = ny;
    }
  }

  // A one-pixel line from (x0, y0) to (x1, y1).
  function line(x0, y0, x1, y1, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    g.fillStyle = color;
    for (let s = 0; s <= steps; s++) g.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 1, 1);
  }

  // ---------- 🛰️ The space scene: the capsule alone in orbit (only when something goes wrong up there)

  function drawSpace() {
    g.fillStyle = ink.space;
    g.fillRect(0, 0, W, H);
    drawStars(1, 0);
    g.drawImage(art.limb, 0, Math.round(riseOffset() * 60)); // Earth's edge, rising into view at first
    if (w.zoom) return;                              // the fly-away draws the capsule itself
    const { x, y } = capsulePos();
    drawCapsule(x, y);
    if (w.homeT >= 0.6) drawReentry(x, y);
  }

  // 🌍 Arriving in space. SPACE_FADE = how long the climbing view takes to dissolve into the space view;
  // EARTH_RISE = how long Earth's edge and the capsule take to glide up into place.
  const SPACE_FADE = 1.6;
  const EARTH_RISE = 2.6;

  // How far Earth and the capsule still have to rise: 1 = just started, 0 = in place. It eases out
  // (fast at first, then gently settling). With reduced motion, they're simply in place.
  function riseOffset() {
    if (calm || w.spaceT < 0) return 0;
    return (1 - clampN(w.spaceT / EARTH_RISE, 0, 1)) ** 3;
  }

  // The climbing view breaks up, dot by dot, into the space view. A see-through fade would mix in
  // colors outside the team's 16, so this uses the same 4x4 dot pattern as our dithering instead:
  // each dot switches over at its own moment.
  function drawDissolve() {
    drawWorld();
    const before = g.getImageData(0, 0, W, H).data;
    drawSpace();
    const after = g.getImageData(0, 0, W, H);
    const p = w.spaceT / SPACE_FADE;                 // 0 = all climb, 1 = all space
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (BAYER[(y & 3) * 4 + (x & 3)] < p) continue; // this dot already shows space
        const i = (y * W + x) * 4;
        after.data[i] = before[i];
        after.data[i + 1] = before[i + 1];
        after.data[i + 2] = before[i + 2];
      }
    }
    g.putImageData(after, 0, 0);
  }

  // Floating in the middle (bobbing gently), or curving down toward Earth when heading home.
  // When it first arrives, it glides up from lower down (riseOffset).
  function capsulePos() {
    if (w.homeT >= 0) {
      const p = clampN(w.homeT / 3, 0, 1) ** 2;     // starts slow, then speeds up
      return { x: Math.round(160 - 46 * p), y: Math.round(64 + 66 * p) };
    }
    return { x: 160, y: 64 + Math.round(riseOffset() * 40) + (calm ? 0 : Math.round(Math.sin(w.t * 1.2))) };
  }

  // 🔋 Moves the battery level during a power emergency (the numbers are seconds of animation):
  //   power: drains to the last red bar in 2.5 s and stops there (the alarm lasts 3 s), so the
  //          answer stays a surprise
  //   fixed: refills in about 1 s, stays full for a moment, then the bar goes away
  //   not fixed ('dark'): the last bar runs out in half a second
  function updateBattery(dt) {
    if (w.battery === null) return;
    if (w.lights === 'power') w.battery = Math.max(0.25, w.battery - dt * 0.3);
    else if (w.lights === 'dark') w.battery = Math.max(0, w.battery - dt * 0.5);
    else {                                           // fixed (or a different alarm came next)
      w.battery = Math.min(1, w.battery + dt * 0.6);
      if (w.battery === 1 && w.lightsT > 2.5) w.battery = null;
    }
  }

  // How bright the window is: 0 = bright, 1 = dim, 2 = dimmer, 3 = off. In a power emergency it
  // follows the battery, like a flashlight running out, with a slow stutter (at most 3 a second,
  // and none when the computer asks for less motion).
  function windowGlow() {
    if (w.battery === null) return w.lights === 'dark' ? 3 : 0;
    let step = w.battery > 0.75 ? 0 : w.battery > 0.5 ? 1 : w.battery > 0.1 ? 2 : 3;
    if (w.lights === 'power' && !calm && hash(Math.floor(w.lightsT * 3) * 7 + 1) > 0.65) step += 1;
    return Math.min(step, 3);
  }

  // The capsule with its lights: the window (lit, dimming or dark), the top light (red alarm or
  // green) and the battery bar in a power emergency.
  function drawCapsule(cx, cy) {
    const dark = w.lights === 'dark';
    const img = art.capsuleImg ?? (dark ? art.capsuleDim : art.capsule);
    const x0 = Math.round(cx - img.width / 2);
    const y0 = Math.round(cy - img.height / 2);
    g.drawImage(img, x0, y0);
    const blinkOn = Math.floor(w.t * 2) % 2 === 0;   // twice a second: an alarm, not a strobe
    if (w.lights === 'life_support' && blinkOn) drawAlert(x0 + img.width + 3, y0 - 2);
    if (w.battery !== null && w.homeT < 1.5) drawBattery(x0 + img.width + 3, y0 + 1);
    if (art.capsuleImg) return;                      // the team's capsule picture has its own window
    g.fillStyle = [ink.light, ink.flameOuter, ink.trunk, ink.ring][windowGlow()]; // bright gold to off
    g.fillRect(x0 + CAPSULE_WINDOW.x, y0 + CAPSULE_WINDOW.y, CAPSULE_WINDOW.w, CAPSULE_WINDOW.h);
    let top = null;
    if (w.lights === 'life_support' && blinkOn) top = ink.alarm;
    if (w.lights === 'ok' && w.lightsT < 1.5) top = ink.ok;
    if (top) {
      g.fillStyle = top;
      g.fillRect(x0 + CAPSULE_BEACON.x, y0 + CAPSULE_BEACON.y, CAPSULE_BEACON.w, CAPSULE_BEACON.h);
    }
  }

  // A little red "!" next to the capsule during a life support alarm.
  function drawAlert(x, y) {
    g.fillStyle = ink.alarm;
    g.fillRect(x, y, 2, 5);
    g.fillRect(x, y + 6, 2, 2);
  }

  // 🔋 A standing battery like a phone's, 5 wide and 12 tall, with 4 bars inside. The bars are
  // green when it's mostly full, gold at 2 and red at the last one. Empty: the frame turns red.
  function drawBattery(x, y) {
    const bars = Math.ceil(w.battery * 4 - 0.001);   // the tiny bit keeps a full 1 bar at exactly 0.25
    g.fillStyle = bars === 0 ? ink.alarm : ink.body;
    g.fillRect(x + 1, y, 3, 1);                      // the bump on top
    g.fillRect(x, y + 1, 5, 1);                      // frame: top, bottom, left, right
    g.fillRect(x, y + 11, 5, 1);
    g.fillRect(x, y + 1, 1, 11);
    g.fillRect(x + 4, y + 1, 1, 11);
    g.fillStyle = bars >= 3 ? ink.ok : bars === 2 ? ink.light : ink.alarm;
    for (let i = 0; i < bars; i++) g.fillRect(x + 1, y + 9 - i * 2, 3, 1); // bottom bar first
  }

  // 🔥 Re-entry: air rushing past the heat shield glows hot, in a bow under the capsule, with a trail behind.
  function drawReentry(cx, cy) {
    const p = clampN((w.homeT - 0.6) / 2, 0, 1);   // gets stronger as it falls
    const colors = [ink.flameCore, ink.flame, ink.flameOuter, ink.flameTip];
    for (let i = 0; i < 4; i++) {
      const r = 9 + i * 2 + (hash(frameCount * 7 + i) > 0.5 ? 1 : 0);
      g.fillStyle = colors[i];
      for (let a = 0.25; a < Math.PI - 0.25; a += 0.12) {
        if (hash(frameCount * 13 + i * 50 + Math.round(a * 10)) > 0.4 + p * 0.5) continue;
        g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + 6 + Math.sin(a) * r * 0.5), 1, 1);
      }
    }
    for (let i = 0; i < 18 * p; i++) {               // the trail streams up behind it
      const d = 8 + i * 2;
      g.fillStyle = colors[Math.min(3, i >> 2)];
      g.fillRect(Math.round(cx + d * 0.55 + (hash(frameCount * 3 + i) - 0.5) * 3), Math.round(cy - d * 0.8), 1, 1);
    }
  }

  // ---------- ✨ The Kirby fly-away

  // Takes a snapshot of whatever is flying (the rocket or the capsule), so it can shrink as one picture.
  function startZoom() {
    const to = { x: 232, y: 38 };                    // the spot in the sky it flies off toward
    if (w.scene === 'space') {
      const { x, y } = capsulePos();
      const img = art.capsuleImg ?? art.capsule;
      return { t: 0, img, from: { x, y: y + Math.round(img.height / 2) }, to, fire: false };
    }
    const { img, camY, x, y, flameW } = snapshotRocket();
    return { t: 0, img, camY, from: { x, y }, to, fire: true, flameW };
  }

  /**
   * Job: paints the whole rocket as it looks right now (boosters and all) into one small picture,
   *   so the fly-away and the saucer can move it around as a single piece.
   * @returns {Object} - { img, camY, x, y, flameW }: the picture, the frozen camera, where the
   *   rocket's base is on screen, and how wide its flame is.
   */
  function snapshotRocket() {
    const r = art.rocket;
    const camY = cameraY();
    const withBoosters = r.boosters && !w.separated;
    const width = Math.max(r.upper.width, w.separated ? 0 : r.lower.width, withBoosters ? r.coreW + 2 * r.boosters[0].width : 0);
    const { canvas: snap, g: s } = makeCanvas(width, rocketHeight());
    const mid = width / 2;
    if (!w.separated) {
      s.drawImage(r.lower, Math.round(mid - r.lower.width / 2), r.upper.height);
      if (withBoosters) {
        s.drawImage(r.boosters[0], Math.round(mid - r.coreW / 2 - r.boosters[0].width), snap.height - r.boosters[0].height - 1);
        s.drawImage(r.boosters[1], Math.round(mid + r.coreW / 2), snap.height - r.boosters[1].height - 1);
      }
    }
    s.drawImage(r.upper, Math.round(mid - r.upper.width / 2), 0);
    const flameW = w.separated ? Math.max(2, r.upper.width - 4) : Math.max(3, r.coreW - 2);
    return { img: snap, camY, x: ROCKET_X, y: toScreen(w.alt, camY), flameW };
  }

  // ---------- 🛸 The saucer beat (abduct() above starts it)

  // Draws one frame of the saucer beat: the saucer swooping in, its beam, and the rocket floating
  // up into it. a.t = seconds since it started. Positions are on screen (the camera is frozen).
  function drawAbduct() {
    const a = w.abduct;
    const t = a.t;
    const sw = art.saucer.width;
    const hoverX = a.x;
    const hoverY = a.y - a.img.height - 18;          // the saucer hovers just above the rocket's nose

    // Where the saucer is: swooping in from the top right (fast, then slowing down), then hovering
    // with a gentle bob.
    let ux = hoverX + Math.round(Math.sin(t * 3) * 1.5);
    let uy = hoverY + Math.round(Math.sin(t * 4) * 1.5);
    if (t < 1.4) {
      const p = t / 1.4;
      const e = 1 - (1 - p) ** 3;
      ux = Math.round(hoverX + (1 - e) * 170);
      uy = Math.round(hoverY - (1 - e) * 90 + Math.sin(p * Math.PI) * 18); // dips down mid-swoop
    }

    // The rocket floats up 10 pixels in the beam, wobbling a little, then both zip off the top.
    const zip = t > 3.4 ? Math.round((t - 3.4) ** 2 * 500) : 0;
    const pull = Math.round(clampN((t - 1.8) / 1.6, 0, 1) * 10);
    const wobble = t > 1.8 ? Math.round(Math.sin(t * 6)) : 0;
    const rocketBase = a.y - pull - zip;
    uy -= zip;

    if (t > 1.5 && t < 3.6) drawBeam(ux, uy + 9, rocketBase + 3, a.img.width, t);
    g.drawImage(a.img, Math.round(a.x - a.img.width / 2) + wobble, rocketBase - a.img.height);
    g.drawImage(art.saucer, ux - sw / 2, uy);
    // The rim lights blink in turn: gold, green, red.
    const colors = [ink.light, ink.ok, ink.alarm];
    SAUCER_LIGHTS.forEach((lx, i) => {
      g.fillStyle = colors[((frameCount >> 3) + i) % 3];
      g.fillRect(ux - sw / 2 + lx, uy + 5, 2, 1);
    });
  }

  // The green tractor beam: a cone from under the saucer down past the rocket, made of dithered
  // dots with brighter bands sliding up it. It flickers on over its first 0.2 seconds.
  function drawBeam(cx, top, bottom, rocketW, t) {
    const fadeIn = clampN((t - 1.5) / 0.2, 0, 1);
    for (let y = top; y < bottom; y++) {
      const frac = (y - top) / Math.max(1, bottom - top);   // 0 at the saucer, 1 at the bottom
      const half = Math.round(3 + frac * (rocketW / 2 + 6));
      const band = (y + Math.floor(t * 30)) % 8 < 2;        // a brighter stripe, moving up
      const density = (band ? 0.85 : 0.45) * fadeIn;
      for (let x = cx - half; x <= cx + half; x++) {
        if (BAYER[(y & 3) * 4 + (x & 3)] < density) { g.fillStyle = ink.ok; g.fillRect(x, y, 1, 1); }
      }
    }
  }

  function drawZoom() {
    const z = w.zoom;
    const p = clampN(z.t / 1.6, 0, 1);
    const e = p * p;                                 // starts slow, then speeds away
    const x = Math.round(z.from.x + (z.to.x - z.from.x) * e);
    const y = Math.round(z.from.y + (z.to.y - z.from.y) * e);
    if (p < 1) {
      const s = 1 - 0.95 * e;                        // shrinks to almost nothing
      const iw = Math.max(1, Math.round(z.img.width * s));
      const ih = Math.max(1, Math.round(z.img.height * s));
      if (z.fire && s > 0.3) drawFlame(x, y, Math.max(2, Math.round(z.flameW * s)), s);
      g.drawImage(z.img, Math.round(x - iw / 2), y - ih, iw, ih);
      return;
    }
    // ...then a little star twinkles where it vanished.
    const size = Math.round(Math.sin(clampN((z.t - 1.6) / 0.7, 0, 1) * Math.PI) * 5);
    if (size <= 0) return;
    g.fillStyle = ink.star;
    g.fillRect(x - size, y, size * 2 + 1, 1);
    g.fillRect(x, y - size, 1, size * 2 + 1);
    g.fillStyle = ink.starWarm;
    for (let i = 1; i <= size >> 1; i++) {
      g.fillRect(x - i, y - i, 1, 1); g.fillRect(x + i, y - i, 1, 1);
      g.fillRect(x - i, y + i, 1, 1); g.fillRect(x + i, y + i, 1, 1);
    }
    g.fillStyle = ink.flameCore;
    g.fillRect(x - 1, y - 1, 3, 3);
  }

  // ---------- 3. Show it: copy the hidden frame onto the canvas, shaking if needed

  // How hard the screen shakes, in pixels: gentle at liftoff, strongest at max-Q, still after separation.
  function shakeAmount() {
    if (calm || !w.engine || w.scene !== 'rocket' || w.zoom || w.abduct) return 0;
    if (w.failing) return w.failT < 0.6 ? 1 : 0;
    if (w.phase === 'liftoff') return Math.min(1.5, w.phaseT * 2);
    if (w.phase === 'maxq') return 1.5 + 2 * Math.sin(Math.PI * Math.min(1, w.phaseT / 3));
    if (w.phase === 'separation') return w.separated ? 0 : 1;
    return 0;
  }

  function render() {
    if (w.scene === 'space' && w.spaceT < SPACE_FADE) drawDissolve(); // just arriving in space
    else if (w.scene === 'space') drawSpace();
    else drawWorld();
    if (w.zoom) drawZoom();
    if (w.abduct) drawAbduct();
    const amp = shakeAmount();
    const jolt = frameCount >> 1;                    // a new nudge every other frame
    const sx = amp ? Math.round((hash(jolt * 2 + 1) - 0.5) * 2 * amp) : 0;
    const sy = amp ? Math.round((hash(jolt * 2 + 2) - 0.5) * 2 * amp) : 0;
    ctx.drawImage(frame, 0, 0);                      // the steady picture underneath fills any gap at the edges
    if (sx || sy) ctx.drawImage(frame, sx, sy);
  }

  // The altitude counter: an approximate number while climbing, words once we're in orbit.
  function showAltitude() {
    if (!opts.altitudeEl) return;
    let label = `ALTITUDE ≈ ${altitudeKm(w.climbed)} KM`;
    if (w.scene === 'space') label = w.homeT >= 0 ? 'HEADING HOME' : 'IN ORBIT';
    if (w.abduct) label = 'ALTITUDE ≈ ??? KM'; // nobody knows anymore
    if (label !== lastLabel) {
      // The ≈ gets its own <span>, so finale.css can make it bigger (Press Start 2P has no ≈ of its own).
      const [before, after] = label.split('≈');
      if (after === undefined) {
        opts.altitudeEl.textContent = label;
      } else {
        const approx = document.createElement('span');
        approx.className = 'fin-approx';
        approx.textContent = '≈';
        opts.altitudeEl.replaceChildren(before, approx, after);
      }
      lastLabel = label;
    }
  }

  // ---------- 🎬 The main loop: the browser calls tick() before each screen refresh (about 60 a second).
  let raf = 0;
  let last = performance.now();
  function tick(ms) {
    if (!alive) return;
    const dt = clampN((ms - last) / 1000, 0, 0.05); // capped, so a hiccup doesn't make things teleport
    last = ms;
    update(dt);
    render();
    showAltitude();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return { countdown, stage, lightning, fail, toSpace, alarm, settle, headHome, zoomOut, abduct, destroy };
}

// ---------- Helpers for the team's pictures

// Loads one of the team's pictures. Returns null if it doesn't exist yet (we keep the placeholder).
async function loadImage(path) {
  const img = new Image();
  img.src = new URL(`../../${path}`, import.meta.url).href;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

