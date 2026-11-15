// slices/finale/sound/speaker-boost.mjs: makes deep, bass-heavy sounds audible on laptop and phone
// speakers. Owner: Person 5, Erick. A dev tool: the game never runs this file.
//
// 🔊 The problem: small speakers can't play deep bass (below about 150 Hz). A boom or a rocket
// rumble that is almost all deep bass comes out nearly silent on a laptop, even at full volume.
// The fix (the same trick phones use): add the bass's "overtones", higher copies of the same
// sound. Small speakers can play those, and our brain hears them as the missing bass.
//   --click    adds a short, punchy "crack" at the start (for booms and hits)
//   --crackle  adds a crackling roar that follows the sound's loudness (for engines and rumbles)
//   --strong   pushes the overtones twice as hard (for very deep sounds, like a boom)
//   --rate=16000  saves fewer samples a second (smaller file), for long sounds with no high notes
// The result is mono, 16-bit, 22,050 samples a second (unless --rate says otherwise), like our other sounds.
//
// Run it from the repo root:
//   node slices/finale/sound/speaker-boost.mjs <input.wav> <output.wav> [--click] [--crackle] [--strong] [--rate=16000]

import fs from 'node:fs';

const [input, output, ...flags] = process.argv.slice(2);
const RATE = Number(flags.find((f) => f.startsWith('--rate='))?.slice(7)) || 22050;
if (!input || !output) {
  console.log('Usage: node slices/finale/sound/speaker-boost.mjs <input.wav> <output.wav> [--click] [--crackle]');
  process.exit(1);
}

// ---------- Read the WAV as mono numbers from -1 to 1, at 22,050 samples a second.
const b = fs.readFileSync(input);
let fmt = null;
let data = null;
for (let o = 12; o < b.length - 8;) {
  const id = b.toString('ascii', o, o + 4);
  const size = b.readUInt32LE(o + 4);
  if (id === 'fmt ') fmt = { channels: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
  if (id === 'data') data = { start: o + 8, size };
  o += 8 + size + (size & 1);
}
if (!fmt || !data || fmt.bits !== 16) {
  console.log('This tool only understands 16-bit WAV files.');
  process.exit(1);
}
const frames = Math.floor(data.size / (2 * fmt.channels));
const src = new Float32Array(frames);
for (let i = 0; i < frames; i++) {
  let sum = 0;
  for (let ch = 0; ch < fmt.channels; ch++) sum += b.readInt16LE(data.start + (i * fmt.channels + ch) * 2);
  src[i] = sum / fmt.channels / 32768;
}
const n = Math.floor((frames * RATE) / fmt.rate);
const x = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const pos = (i * fmt.rate) / RATE;
  const k = Math.floor(pos);
  x[i] = src[k] * (1 - (pos - k)) + (src[Math.min(k + 1, frames - 1)] ?? 0) * (pos - k);
}

// ---------- 🔧 Small sound tools
// A high-pass filter: keeps the higher part of a sound and removes the deep part below `hz`.
function highPass(sig, hz) {
  const out = new Float32Array(sig.length);
  const a = Math.exp((-2 * Math.PI * hz) / RATE);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < sig.length; i++) {
    prevOut = a * (prevOut + sig[i] - prevIn);
    prevIn = sig[i];
    out[i] = prevOut;
  }
  return out;
}
// How loud the sound is at each moment: rises fast, falls slowly (an "envelope follower").
function loudnessCurve(sig) {
  const out = new Float32Array(sig.length);
  let level = 0;
  for (let i = 0; i < sig.length; i++) {
    const v = Math.abs(sig[i]);
    level += (v > level ? 0.05 : 0.0008) * (v - level);
    out[i] = level;
  }
  return out;
}
// Noise from a fixed seed, so running the tool twice gives the same file.
let seed = 777;
const noise = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed / 4294967296) * 2 - 1; };

// ---------- 🔊 The boost
// 1. Overtones: squash the sound hard (tanh), which adds higher copies of every deep note, then
//    keep only those added higher parts (above 250 Hz) and mix them back in.
const strength = flags.includes('--strong') ? 2 : 1;
const squashed = x.map((v) => Math.tanh(v * 6 * strength));
const overtones = highPass(highPass(squashed, 250 * strength), 250 * strength); // twice, for a cleaner cut
const out = x.map((v, i) => v + overtones[i] * 0.9 * strength);

// 2. --crackle: a crackling roar that gets louder and quieter with the sound itself.
if (flags.includes('--crackle')) {
  const level = loudnessCurve(x);
  const hiss = highPass(Float32Array.from({ length: n }, () => noise()), 1500);
  for (let i = 0; i < n; i++) out[i] += hiss[i] * level[i] * 1.4 * (0.6 + 0.4 * Math.abs(noise()));
}

// 3. --click: a short, punchy crack where the sound starts.
if (flags.includes('--click')) {
  const start = x.findIndex((v) => Math.abs(v) > 0.2);
  const crack = highPass(Float32Array.from({ length: 900 }, () => noise()), 1200);
  for (let i = 0; i < crack.length && start + i < n; i++) out[start + i] += crack[i] * 0.9 * strength * Math.exp(-i / (160 * strength));
}

// ---------- Make the loudest moment 0.9, and save as a mono 16-bit WAV.
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const pcm = new Int16Array(n);
for (let i = 0; i < n; i++) pcm[i] = Math.max(-1, Math.min(1, (out[i] * 0.9) / (peak || 1))) * 32767;
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + n * 2, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(n * 2, 40);
fs.writeFileSync(output, Buffer.concat([head, Buffer.from(pcm.buffer)]));
console.log(`${output}: ${(n / RATE).toFixed(2)}s, ${Math.round((44 + n * 2) / 1024)}KB, boosted for small speakers`);
