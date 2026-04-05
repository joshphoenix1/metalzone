// Full DSP chain responsiveness test.
// Verifies each knob meaningfully changes the output — catches DSP bugs
// where a knob is "wired" in the UI but doesn't actually affect sound.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Biquad, highpass, lowshelf, highshelf, peaking } from '../web/dsp.js';

const SR = 48000;

// Reproduces worklet.js process() chain for one channel.
function makeChain() {
  const dc = new Biquad();
  const ls = new Biquad();
  const pk = new Biquad();
  const hs = new Biquad();
  dc.setCoeffs(...highpass(48, 0.707, SR));
  return { dc, ls, pk, hs };
}

function setTone(ch, { low, mid, midFreq, high }) {
  ch.ls.setCoeffs(...lowshelf(100, 0.707, low, SR));
  ch.pk.setCoeffs(...peaking(midFreq, 0.7, mid, SR));
  ch.hs.setCoeffs(...highshelf(3200, 0.707, high, SR));
}

function processSample(ch, x, { dist, level }) {
  const preGain = Math.pow(10, dist * 2.3);
  const bias = 0.15;
  const biasOffset = Math.tanh(bias);
  const makeup = level * 0.15 * 2.0;
  let y = ch.dc.process(x);
  y = y * preGain;
  y = Math.tanh(y);
  y = Math.tanh(y * 1.6 + bias) - biasOffset;
  y = ch.ls.process(y);
  y = ch.pk.process(y);
  y = ch.hs.process(y);
  return y * makeup;
}

// Generate a sawtooth power chord (matches demo tone)
function genInput(samples) {
  const buf = new Float32Array(samples);
  const freqs = [82.4, 123.5, 164.8];
  for (let i = 0; i < samples; i++) {
    let s = 0;
    for (const f of freqs) {
      const phase = (i * f / SR) % 1;
      s += 2 * phase - 1;
    }
    buf[i] = s * 0.18;
  }
  return buf;
}

function rms(buf, start = 0, len = buf.length) {
  let sum = 0;
  for (let i = start; i < start + len; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / len);
}

// Run full chain with given params, return RMS after warmup.
function runChain(params) {
  const ch = makeChain();
  setTone(ch, params);
  const input = genInput(SR); // 1 second
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = processSample(ch, input[i], params);
  }
  // Skip first half as warmup, measure second half
  return rms(output, SR / 2, SR / 2);
}

const BASE = { dist: 0.5, level: 0.5, low: 0, mid: 0, midFreq: 500, high: 0 };

test('DIST: moving 0 → 0.8 changes output significantly', () => {
  const low  = runChain({ ...BASE, dist: 0.0 });
  const high = runChain({ ...BASE, dist: 0.8 });
  const ratioDb = 20 * Math.log10(high / (low + 1e-12));
  assert.ok(Math.abs(ratioDb) > 3, `DIST effect: ${ratioDb.toFixed(2)} dB`);
});

test('LEVEL: moving 0.2 → 0.9 increases output', () => {
  const low  = runChain({ ...BASE, level: 0.2 });
  const high = runChain({ ...BASE, level: 0.9 });
  const ratioDb = 20 * Math.log10(high / (low + 1e-12));
  assert.ok(ratioDb > 6, `LEVEL effect: ${ratioDb.toFixed(2)} dB (expected > +6)`);
});

test('LOW: +15 dB vs 0 dB changes RMS audibly', () => {
  const flat    = runChain({ ...BASE, low:   0 });
  const boosted = runChain({ ...BASE, low: +15 });
  const deltaDb = 20 * Math.log10(boosted / flat);
  assert.ok(Math.abs(deltaDb) > 0.5, `LOW effect: ${deltaDb.toFixed(2)} dB`);
});

test('HIGH: +15 dB vs 0 dB changes RMS audibly', () => {
  const flat    = runChain({ ...BASE, high:   0 });
  const boosted = runChain({ ...BASE, high: +15 });
  const deltaDb = 20 * Math.log10(boosted / flat);
  assert.ok(deltaDb > 1.0, `HIGH effect: ${deltaDb.toFixed(2)} dB (expected > +1)`);
});

test('MID: +15 dB vs 0 dB changes RMS audibly', () => {
  const flat    = runChain({ ...BASE, mid:   0 });
  const boosted = runChain({ ...BASE, mid: +15 });
  const deltaDb = 20 * Math.log10(boosted / flat);
  assert.ok(deltaDb > 1.0, `MID effect: ${deltaDb.toFixed(2)} dB (expected > +1)`);
});

test('MID FREQ: 300 vs 3000 Hz produces different spectral balance (with mid=+12)', () => {
  const lowF  = runChain({ ...BASE, mid: 12, midFreq: 300 });
  const highF = runChain({ ...BASE, mid: 12, midFreq: 3000 });
  const ratioDb = 20 * Math.log10(highF / lowF);
  assert.ok(Math.abs(ratioDb) > 0.3, `MID FREQ shift effect: ${ratioDb.toFixed(2)} dB`);
});
