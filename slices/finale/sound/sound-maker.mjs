// slices/finale/sound/sound-maker.mjs: makes every Slice 5 sound effect and song, from code.
// Owner: Person 5, Erick. A dev tool: the game never runs this file. It only plays the files it makes.
//
// 🎵 How it works: like an old game console's sound chip. Every sound is built from a few simple
// waves (square, triangle, a pure "sine", an organ, a music-box bell) and noise (for rumbles and
// clicks), shaped by volume curves. Then it's saved:
//   sound effects -> audio/sfx/finale/<name>.wav   (played with ui.sfx('finale/<name>'))
//   music         -> audio/music/finale/<name>.mp3 (played with ui.music('finale/<name>'), which needs MP3)
//
// Run it from the repo root:
//   node slices/finale/sound/sound-maker.mjs                                   (sound effects only)
//   LAMEJS=path/to/lamejs/lame.all.js node slices/finale/sound/sound-maker.mjs (also the music)
// MP3 needs the lamejs encoder (npm package lamejs, file lame.all.js). It isn't part of the game
// or the repo: it's only needed on the computer that makes the files.
//
// All music here is original. Same numbers in, same sounds out (the noise uses a fixed seed).

import fs from 'node:fs';
import vm from 'node:vm';

const SR = 22050;                                    // samples per second (plenty for retro sounds)
const SFX_DIR = new URL('../../../audio/sfx/finale/', import.meta.url);     // all of Slice 5's sound effects
const MUSIC_DIR = new URL('../../../audio/music/finale/', import.meta.url); // all of Slice 5's songs

// ---------- 🔧 The building blocks

// An empty sound `sec` seconds long. Notes get added into it.
const track = (sec) => new Float32Array(Math.ceil(sec * SR));
// A piano-key number (60 = middle C) -> its pitch in Hz.
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Noise from a fixed seed, so the hiss and rumbles come out the same every time.
let seed = 12345;
const noise = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed / 4294967296) * 2 - 1; };

// The waves. `p` = how far through one wave cycle we are (0 to 1 and beyond).
const TAU = Math.PI * 2;
const WAVES = {
  sine: (p) => Math.sin(TAU * p),
  square: (p, duty = 0.5) => (p % 1 < duty ? 1 : -1),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
  organ: (p) => (Math.sin(TAU * p) + 0.5 * Math.sin(2 * TAU * p) + 0.3 * Math.sin(3 * TAU * p) + 0.15 * Math.sin(4 * TAU * p)) / 1.95,
  bell: (p) => (Math.sin(TAU * p) + 0.35 * Math.sin(2.76 * TAU * p)) / 1.35, // a music box's slightly "off" overtone
};

/**
 * Job: adds one note into a sound.
 * @param {Float32Array} out - the sound to add into.
 * @param {Object} o - the note:
 *   at, dur   - when it starts and how long it lasts, in seconds
 *   freq      - pitch in Hz, or a function (0 to 1 through the note) -> Hz, for slides
 *   wave      - one of WAVES, or 'noise'
 *   vol       - loudness, 0 to 1
 *   attack, release - seconds to fade in and fade out
 *   decay     - makes it die away like a plucked string or a bell (bigger = faster)
 *   duty      - for square waves: thin (0.125) sounds buzzy, 0.5 sounds hollow
 *   vibrato   - { rate (wobbles per second), depth (in semitones) }
 *   cutoff    - for noise: lower = deeper rumble. A number in Hz, or a function like freq
 */
function note(out, o) {
  const start = Math.round(o.at * SR);
  const n = Math.round(o.dur * SR);
  let phase = 0;
  let low = 0; // the noise's "muffler" (a one-pole low-pass filter)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / SR;
    const k = i / n;
    let f = typeof o.freq === 'function' ? o.freq(k) : (o.freq ?? 0);
    if (o.vibrato) f *= 2 ** ((Math.sin(TAU * o.vibrato.rate * t) * o.vibrato.depth) / 12);
    phase += f / SR;
    let env = Math.min(1, t / (o.attack ?? 0.004)) * Math.min(1, (o.dur - t) / (o.release ?? 0.02));
    if (o.decay) env *= Math.exp(-o.decay * t);
    let v;
    if (o.wave === 'noise') {
      const fc = typeof o.cutoff === 'function' ? o.cutoff(k) : (o.cutoff ?? 8000);
      low += (1 - Math.exp((-TAU * fc) / SR)) * (noise() - low);
      v = low;
    } else {
      v = WAVES[o.wave](phase, o.duty);
    }
    out[start + i] += v * Math.max(0, env) * (o.vol ?? 0.5);
  }
}

// Plays a list of notes [startBeat, lengthInBeats, pianoKey] at a tempo (beats per minute).
function part(out, bpm, notes, opts) {
  const beat = 60 / bpm;
  for (const [b, len, key] of notes) note(out, { ...opts, at: b * beat, dur: len * beat, freq: midi(key) });
}

// An echo: copies the sound back in, quieter, a moment later (like in a big empty hall).
function echo(out, delaySec, amount) {
  const d = Math.round(delaySec * SR);
  for (let i = d; i < out.length; i++) out[i] += out[i - d] * amount;
}

// Makes the loudest moment exactly `peak`, so every file has a sensible volume.
function normalize(out, peak) {
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}

// Makes a song about as loud as `target` on average (not just at its loudest moment). Quiet songs
// sounded like "no music" next to the sound effects. A soft limiter (tanh) rounds off any peaks
// that would get too loud, so nothing distorts.
function loudness(out, target) {
  const rms = Math.sqrt(out.reduce((sum, v) => sum + v * v, 0) / out.length) || 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh((out[i] * target) / rms);
  return out; // already between -1 and 1 (tanh never goes past them)
}

// Turns the sound into 16-bit numbers (what WAV and MP3 files store).
function toInt16(out) {
  const s = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) s[i] = Math.max(-1, Math.min(1, out[i])) * 32767;
  return s;
}

// Saves a sound effect as audio/sfx/finale/<name>.wav (mono, 16-bit, 22,050 samples a second).
function saveWav(name, out, peak = 0.8) {
  const pcm = toInt16(normalize(out, peak));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length * 2, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length * 2, 40);
  const file = new URL(`${name}.wav`, SFX_DIR);
  fs.writeFileSync(file, Buffer.concat([head, Buffer.from(pcm.buffer)]));
  console.log(`  sfx   ${name}.wav  ${(out.length / SR).toFixed(1)}s  ${Math.round((44 + pcm.length * 2) / 1024)}KB`);
}

// Saves a song as audio/music/finale/<name>.mp3, using the lamejs encoder (see the top of this file).
function saveMp3(lame, name, out, target = 0.22) {
  const pcm = toInt16(loudness(out, target));
  const enc = new lame.Mp3Encoder(1, SR, 64);        // mono, 64 kbps: small files that still sound fine
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) parts.push(Buffer.from(enc.encodeBuffer(pcm.subarray(i, i + 1152))));
  parts.push(Buffer.from(enc.flush()));
  const data = Buffer.concat(parts);
  fs.writeFileSync(new URL(`${name}.mp3`, MUSIC_DIR), data);
  console.log(`  music ${name}.mp3  ${(out.length / SR).toFixed(1)}s  ${Math.round(data.length / 1024)}KB`);
}

// ---------- 🔊 Sound effects

// How loud each sound is saved (0 to 1). Most use 0.8. The alarms were too loud, so they're softer.
const LOUDNESS = { alarm: 0.35, powerdown: 0.35 };

// The launch rumble (rocketrumble.wav) and the saucer's alien-creepy.wav are Erick's own files, so this
// script never makes or overwrites them. `ignite` below is a backup roar made in code (see LAUNCH_SOUND
// in finale.js to switch to it).
const SFX = {
  // Countdown: a short, clean retro beep.
  countdown() {
    const out = track(0.15);
    note(out, { at: 0, dur: 0.12, freq: 880, wave: 'square', duty: 0.25, vol: 0.5, release: 0.04 });
    return out;
  },
  // Backup engine roar: a deep rumble that roars up, holds, then fades as the rocket climbs away.
  ignite() {
    const out = track(5);
    note(out, { at: 0, dur: 5, wave: 'noise', cutoff: (k) => 300 + 1400 * Math.min(1, k * 4), vol: 0.9, attack: 0.4, release: 2.2 });
    note(out, { at: 0, dur: 5, wave: 'sine', freq: 48, vol: 0.5, attack: 0.3, release: 2 });
    note(out, { at: 0, dur: 1.2, wave: 'noise', cutoff: 3000, vol: 0.4, attack: 0.02, release: 1 });
    return out;
  },
  // GO: a happy two-note chime, up a fifth.
  go() {
    const out = track(0.35);
    note(out, { at: 0, dur: 0.1, freq: midi(84), wave: 'square', duty: 0.25, vol: 0.4 });
    note(out, { at: 0.09, dur: 0.24, freq: midi(91), wave: 'square', duty: 0.25, vol: 0.4, decay: 6 });
    note(out, { at: 0.09, dur: 0.24, freq: midi(79), wave: 'triangle', vol: 0.3, decay: 6 });
    return out;
  },
  // Separation: "ka-CHUNK", a quick metal click, then a heavy thud.
  separation() {
    const out = track(0.5);
    note(out, { at: 0, dur: 0.04, wave: 'noise', cutoff: 6000, vol: 0.6 });
    note(out, { at: 0.08, dur: 0.3, wave: 'noise', cutoff: 500, vol: 1, decay: 10 });
    note(out, { at: 0.08, dur: 0.3, wave: 'square', freq: (k) => 120 - 70 * k, vol: 0.4, decay: 12 });
    return out;
  },
  // Thunder: a sharp crack, then a long rolling rumble.
  thunder() {
    const out = track(2.6);
    note(out, { at: 0, dur: 0.15, wave: 'noise', cutoff: 7000, vol: 1, decay: 20 });
    note(out, { at: 0.05, dur: 2.5, wave: 'noise', cutoff: (k) => 400 - 250 * k, vol: 1, attack: 0.1, decay: 1.4 });
    return out;
  },
  // Fly-away: a silly slide whistle going up.
  whoosh() {
    const out = track(1);
    note(out, { at: 0, dur: 0.9, wave: 'sine', freq: (k) => 400 + 1500 * k * k, vol: 0.6, attack: 0.05, release: 0.15, vibrato: { rate: 7, depth: 0.3 } });
    note(out, { at: 0, dur: 0.9, wave: 'noise', cutoff: (k) => 800 + 3000 * k, vol: 0.15, attack: 0.2, release: 0.2 });
    return out;
  },
  // The twinkle where the rocket vanishes: a bright "ding" with a sparkle on top.
  twinkle() {
    const out = track(1);
    note(out, { at: 0, dur: 0.9, wave: 'bell', freq: midi(96), vol: 0.5, decay: 4 });
    note(out, { at: 0, dur: 0.9, wave: 'sine', freq: midi(103), vol: 0.25, decay: 5 });
    [100, 103, 108].forEach((key, i) => note(out, { at: 0.05 + i * 0.05, dur: 0.15, wave: 'square', duty: 0.125, freq: midi(key), vol: 0.12, decay: 15 }));
    return out;
  },
  // Life support alarm: a two-tone retro alarm, four times.
  alarm() {
    const out = track(1.7);
    for (let i = 0; i < 8; i++) note(out, { at: i * 0.2, dur: 0.18, freq: i % 2 ? 660 : 880, wave: 'square', duty: 0.5, vol: 0.4 });
    return out;
  },
  // Power running low: a wobbly tone sliding down, like a toy running out of batteries.
  powerdown() {
    const out = track(1.4);
    note(out, { at: 0, dur: 1.3, wave: 'square', duty: 0.3, freq: (k) => 600 * (1 - k) + 70, vol: 0.4, release: 0.3, vibrato: { rate: 9, depth: 1.5 } });
    return out;
  },
  // Fixed! "bloop-bloop-DING": the crew saved the mission.
  fixed() {
    const out = track(0.9);
    note(out, { at: 0, dur: 0.09, freq: midi(72), wave: 'square', duty: 0.25, vol: 0.35 });
    note(out, { at: 0.11, dur: 0.09, freq: midi(76), wave: 'square', duty: 0.25, vol: 0.35 });
    note(out, { at: 0.22, dur: 0.6, freq: midi(84), wave: 'bell', vol: 0.6, decay: 5 });
    return out;
  },
  // Reaching orbit: a short victory fanfare, up the chord and a big held note.
  fanfare() {
    const out = track(1.6);
    [72, 76, 79].forEach((key, i) => note(out, { at: i * 0.13, dur: 0.12, freq: midi(key), wave: 'square', duty: 0.25, vol: 0.35 }));
    for (const key of [84, 88, 91]) note(out, { at: 0.39, dur: 1.1, freq: midi(key), wave: 'square', duty: 0.25, vol: 0.2, release: 0.4, vibrato: { rate: 6, depth: 0.15 } });
    note(out, { at: 0.39, dur: 1.1, freq: midi(48), wave: 'triangle', vol: 0.4, release: 0.4 });
    return out;
  },
  // Medal: "ta-DA!"
  medal() {
    const out = track(1);
    for (const key of [79, 83, 86]) note(out, { at: 0, dur: 0.12, freq: midi(key), wave: 'square', duty: 0.25, vol: 0.25 });
    for (const key of [84, 88, 91]) note(out, { at: 0.15, dur: 0.75, freq: midi(key), wave: 'square', duty: 0.25, vol: 0.25, release: 0.3 });
    return out;
  },
  // A firework popping, then crackling.
  pop() {
    const out = track(0.6);
    note(out, { at: 0, dur: 0.06, wave: 'noise', cutoff: 2500, vol: 1, decay: 30 });
    for (let i = 0; i < 9; i++) note(out, { at: 0.08 + i * 0.05 + Math.abs(noise()) * 0.03, dur: 0.012, wave: 'noise', cutoff: 9000, vol: 0.35 });
    return out;
  },
  // The sad trombone: "womp womp womp wommmmp", four notes sliding down, the last one wobbling.
  womp() {
    const out = track(2.4);
    const keys = [58, 57, 56, 55];
    keys.forEach((key, i) => {
      const last = i === keys.length - 1;
      note(out, {
        at: i * 0.42, dur: last ? 1.6 : 0.38, wave: 'square', duty: 0.35,
        freq: (k) => midi(key + 0.4 * Math.max(0, 1 - k * 6)),          // each note slides into place: "wah"
        vol: 0.45, attack: 0.04, release: last ? 0.5 : 0.08,
        vibrato: last ? { rate: 6, depth: 0.6 } : undefined,
      });
    });
    return out;
  },
};

// ---------- 🎼 Music (all original)

// The beats of a chord [root note, chord notes...] spread over a list, one chord per bar.
const BAR = 4; // beats in a bar

// 🌍 The space theme (globe): slow organ chords, a ticking clock, and a steady pattern of notes
// from the first bar, then a soft high melody. Moody and spacious, with an echo like a big hall.
function spaceTheme() {
  const bpm = 72;
  const chords = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62],
                  [45, 57, 60, 64], [41, 53, 57, 60], [50, 62, 65, 69], [40, 52, 56, 59]]; // Am F C G Am F Dm E
  const out = track((chords.length * BAR * 60) / bpm);
  chords.forEach(([bass, ...pad], bar) => {
    part(out, bpm, [[bar * BAR, BAR, bass]], { wave: 'organ', vol: 0.25, attack: 0.3, release: 0.5 });
    part(out, bpm, pad.map((key) => [bar * BAR, BAR, key]), { wave: 'organ', vol: 0.16, attack: 0.5, release: 0.9 });
    // The steady pattern of bell notes, from the very first bar (later bars ring a little louder, so it builds).
    const [a, b, c] = pad.map((key) => key + 12);
    part(out, bpm, [a, b, c, b, a, b, c, b].map((key, i) => [bar * BAR + i * 0.5, 0.5, key]), { wave: 'bell', vol: 0.12 + bar * 0.01, decay: 3 });
  });
  // A soft, high melody over the second half.
  part(out, bpm, [[16, 4, 76], [20, 4, 77], [24, 2, 81], [26, 2, 77], [28, 2, 76], [30, 2, 80]],
    { wave: 'square', duty: 0.25, vol: 0.1, attack: 0.3, release: 0.6, vibrato: { rate: 5, depth: 0.15 } });
  // The clock: tick... tock... on every beat.
  for (let b = 0; b < chords.length * BAR; b++) {
    note(out, { at: (b * 60) / bpm, dur: 0.03, wave: 'noise', cutoff: b % 2 ? 2500 : 6000, vol: 0.12 });
  }
  echo(out, 0.42, 0.3);
  return out;
}

// 🎹 The sad song (report when the mission didn't work out): a slow music box in a minor key.
function sadTheme() {
  const bpm = 66;
  const chords = [[38, 62, 65, 69], [34, 58, 62, 65], [43, 55, 58, 62], [45, 57, 61, 64],
                  [38, 62, 65, 69], [34, 58, 62, 65], [43, 55, 58, 62], [38, 62, 65, 69]]; // Dm Bb Gm A Dm Bb Gm Dm
  const out = track((chords.length * BAR * 60) / bpm);
  chords.forEach(([bass, a, b, c], bar) => {
    part(out, bpm, [[bar * BAR, BAR, bass]], { wave: 'sine', vol: 0.2, attack: 0.08, release: 0.6 });
    part(out, bpm, [a, b, c, b, a, b, c, b].map((key, i) => [bar * BAR + i * 0.5, 0.5, key - 12]), { wave: 'bell', vol: 0.09, decay: 3 });
  });
  part(out, bpm, [
    [0, 1, 69], [1, 1, 74], [2, 1, 77], [3, 1, 76],      // the melody: a question...
    [4, 2, 74], [6, 1, 72], [7, 1, 70],
    [8, 1, 70], [9, 1, 74], [10, 2, 67],
    [12, 2, 69], [14, 1, 73], [15, 1, 76],
    [16, 1.5, 77], [17.5, 0.5, 76], [18, 1, 74], [19, 1, 69], // ...and a gentle answer
    [20, 1, 70], [21, 1, 74], [22, 2, 77],
    [24, 1, 76], [25, 1, 74], [26, 1, 73], [27, 1, 69],
    [28, 4, 74],
  ], { wave: 'bell', vol: 0.32, decay: 1.6, release: 0.3 });
  echo(out, 0.45, 0.25);
  return out;
}

// 🎉 The happy song (report after a win): a bouncy chiptune loop.
function happyTheme() {
  const bpm = 100;
  const chords = [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69],
                  [48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]]; // C G Am F, twice
  const out = track((chords.length * BAR * 60) / bpm);
  chords.forEach(([bass, ...chord], bar) => {
    part(out, bpm, [0, 1, 2, 3].map((i) => [bar * BAR + i, 0.9, i === 2 ? bass + 7 : bass]), { wave: 'triangle', vol: 0.3, release: 0.05 });
    for (const beat of [1, 3]) part(out, bpm, chord.map((key) => [bar * BAR + beat, 0.4, key]), { wave: 'square', duty: 0.125, vol: 0.05, decay: 6 });
  });
  part(out, bpm, [
    [0, 1, 76], [1, 1, 79], [2, 1, 84], [3, 1, 79],
    [4, 1, 74], [5, 1, 79], [6, 2, 83],
    [8, 1, 84], [9, 0.5, 83], [9.5, 0.5, 81], [10, 2, 76],
    [12, 1, 77], [13, 1, 81], [14, 2, 79],
    [16, 0.5, 76], [16.5, 0.5, 77], [17, 1, 79], [18, 1, 84], [19, 1, 88],
    [20, 1, 86], [21, 1, 83], [22, 2, 79],
    [24, 1, 81], [25, 1, 79], [26, 1, 76], [27, 1, 74],
    [28, 1, 72], [29, 1, 74], [30, 2, 76],
  ], { wave: 'square', duty: 0.25, vol: 0.17, release: 0.05 });
  for (let i = 0; i < chords.length * BAR * 2; i++) {      // a light hi-hat on every half beat
    note(out, { at: (i * 30) / bpm, dur: 0.025, wave: 'noise', cutoff: 9000, vol: i % 2 ? 0.05 : 0.09 });
  }
  return out;
}

// 🚀 The launch music: a tense pulse with a ticking hi-hat and a high, nervous bell pattern. The pulse
// has a brighter copy an octave up, so laptop speakers (which can't play deep notes) still carry it.
// A bit softer than the other songs, so the countdown and the engine rumble stay in front.
function launchTheme() {
  const bpm = 116;
  const roots = [40, 40, 36, 38, 40, 40, 36, 35];             // E E C D E E C B
  const out = track((roots.length * BAR * 60) / bpm);
  roots.forEach((root, bar) => {
    part(out, bpm, Array.from({ length: 8 }, (_, i) => [bar * BAR + i * 0.5, 0.45, root]), { wave: 'square', duty: 0.5, vol: 0.16, decay: 5 });
    part(out, bpm, Array.from({ length: 8 }, (_, i) => [bar * BAR + i * 0.5, 0.45, root + 12]), { wave: 'square', duty: 0.125, vol: 0.08, decay: 5 });
    part(out, bpm, [24, 31, 36, 31, 24, 31, 36, 31].map((up, i) => [bar * BAR + i * 0.5, 0.5, root + up]), { wave: 'bell', vol: 0.07, decay: 6 });
    part(out, bpm, [[bar * BAR, BAR, root + 12], [bar * BAR, BAR, root + 19]], { wave: 'organ', vol: 0.06, attack: 0.5, release: 0.5 });
  });
  for (let i = 0; i < roots.length * BAR * 4; i++) {
    note(out, { at: (i * 15) / bpm, dur: 0.02, wave: 'noise', cutoff: 8000, vol: i % 4 === 0 ? 0.08 : 0.035 });
  }
  return out;
}

// ---------- 🏁 Make everything

console.log('Making Slice 5 sounds...');
for (const [name, make] of Object.entries(SFX)) saveWav(name, make(), LOUDNESS[name] ?? 0.8);

if (process.env.LAMEJS) {
  // lame.all.js is an old-style browser script, so run it in a small sandbox to get the encoder.
  const box = {};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(process.env.LAMEJS, 'utf8'), box);
  const lame = box.lamejs;
  // How loud each song is on average. The globe's theme is the loudest; the launch music stays
  // softer, so the countdown and the rumble are heard over it.
  saveMp3(lame, 'ending_orbit', spaceTheme(), 0.26);
  saveMp3(lame, 'report_sad', sadTheme(), 0.24);
  saveMp3(lame, 'report_loop', happyTheme(), 0.22);
  saveMp3(lame, 'launch_theme', launchTheme(), 0.19);
} else {
  console.log('  (music skipped: set LAMEJS to the path of lamejs/lame.all.js to make the MP3s)');
}
console.log('Done.');
