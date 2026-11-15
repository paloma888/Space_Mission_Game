// slices/finale/sound/shrink-wav.mjs: makes a WAV sound small enough for the Rulebook's 500 KB limit.
// Owner: Person 5, Erick. A dev tool: the game never runs this file.
//
// It turns stereo into mono (both speakers get the same sound) and keeps 22,050 samples a second
// instead of 44,100 or 48,000. That's about 4 times smaller, and through game speakers it sounds
// the same. The file is replaced in place, so git still has the original if you want it back.
//
// Run it from the repo root:
//   node slices/finale/sound/shrink-wav.mjs audio/sfx/finale/my-sound.wav
// Add a number of seconds to also cut it shorter, with a smooth 1-second fade-out at the end:
//   node slices/finale/sound/shrink-wav.mjs audio/sfx/finale/my-sound.wav 6

import fs from 'node:fs';

const RATE = 22050;
const file = process.argv[2];
const keepSeconds = Number(process.argv[3]) || Infinity; // optional: cut it to this many seconds
if (!file) {
  console.log('Usage: node slices/finale/sound/shrink-wav.mjs audio/sfx/finale/my-sound.wav [seconds]');
  process.exit(1);
}

// Find the format ("fmt ") and the sound itself ("data") inside the WAV file.
const b = fs.readFileSync(file);
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
  console.log('This tool only understands 16-bit WAV files. Export the sound as 16-bit WAV first.');
  process.exit(1);
}

// Read every moment as one number from -1 to 1, mixing the left and right speakers together.
const frames = Math.floor(data.size / (2 * fmt.channels));
const mono = new Float32Array(frames);
for (let i = 0; i < frames; i++) {
  let sum = 0;
  for (let ch = 0; ch < fmt.channels; ch++) sum += b.readInt16LE(data.start + (i * fmt.channels + ch) * 2);
  mono[i] = sum / fmt.channels / 32768;
}

// Keep fewer moments per second: each new one is a blend of the two old ones closest to it.
const outFrames = Math.min(Math.floor((frames * RATE) / fmt.rate), Math.floor(keepSeconds * RATE));
const fadeFrom = keepSeconds === Infinity ? outFrames : outFrames - RATE; // where the 1-second fade-out starts
const pcm = new Int16Array(outFrames);
for (let i = 0; i < outFrames; i++) {
  const pos = (i * fmt.rate) / RATE;
  const k = Math.floor(pos);
  const mix = pos - k;
  const v = mono[k] * (1 - mix) + (mono[Math.min(k + 1, frames - 1)] ?? 0) * mix;
  const fade = i > fadeFrom ? 1 - (i - fadeFrom) / (outFrames - fadeFrom) : 1;
  pcm[i] = Math.max(-1, Math.min(1, v * fade)) * 32767;
}

// Write it back as a plain mono, 16-bit WAV.
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + outFrames * 2, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(outFrames * 2, 40);
fs.writeFileSync(file, Buffer.concat([head, Buffer.from(pcm.buffer)]));
const kb = Math.round((44 + outFrames * 2) / 1024);
console.log(`${file}: ${(outFrames / RATE).toFixed(2)}s, ${Math.round(b.length / 1024)}KB -> ${kb}KB${kb > 500 ? '  (still over 500 KB: trim the sound shorter)' : ''}`);
