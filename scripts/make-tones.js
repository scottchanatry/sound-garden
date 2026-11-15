// Generates the ten bell tones the garden plays, as small WAV files.
// Run with: node scripts/make-tones.js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const SECONDS = 2.2;

// C major pentatonic over two octaves: any two notes sound good together.
const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

// A soft bell: a fundamental plus a few quieter, faster-fading overtones.
const PARTIALS = [
  { ratio: 1, gain: 1.0, decay: 2.2 },
  { ratio: 2, gain: 0.35, decay: 3.5 },
  { ratio: 3.01, gain: 0.12, decay: 5.0 },
  { ratio: 4.2, gain: 0.06, decay: 7.0 },
];

function tone(frequency) {
  const count = Math.floor(SAMPLE_RATE * SECONDS);
  const samples = new Float32Array(count);
  let peak = 0;
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.006);
    const release = Math.min(1, (SECONDS - t) / 0.05);
    let value = 0;
    for (const p of PARTIALS) {
      value += p.gain * Math.exp(-p.decay * t) * Math.sin(2 * Math.PI * frequency * p.ratio * t);
    }
    samples[i] = value * attack * release;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const pcm = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    pcm.writeInt16LE(Math.round((samples[i] / peak) * 0.8 * 32767), i * 2);
  }
  return pcm;
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const out = path.join(__dirname, '..', 'assets', 'tones');
fs.mkdirSync(out, { recursive: true });
NOTES.forEach((frequency, index) => {
  fs.writeFileSync(path.join(out, `tone${index}.wav`), wav(tone(frequency)));
});
console.log(`Wrote ${NOTES.length} tones to ${out}`);
