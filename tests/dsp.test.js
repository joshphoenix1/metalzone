// DSP tests for MetalZone web demo. Runs with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Biquad, highpass, lowshelf, highshelf, peaking } from '../web/dsp.js';

const SR = 48000;

function measureGainDb(biquad, freq, { warmup = 500, measure = 4800 } = {}) {
  for (let i = 0; i < warmup; i++)
    biquad.process(Math.sin(2 * Math.PI * freq * i / SR));

  let inRMS = 0, outRMS = 0;
  for (let i = warmup; i < warmup + measure; i++) {
    const x = Math.sin(2 * Math.PI * freq * i / SR);
    const y = biquad.process(x);
    inRMS += x * x;
    outRMS += y * y;
  }
  inRMS  = Math.sqrt(inRMS  / measure);
  outRMS = Math.sqrt(outRMS / measure);
  return 20 * Math.log10(outRMS / inRMS);
}

// --------------------------------------------------------------------------
// Biquad core
// --------------------------------------------------------------------------
test('Biquad passthrough: (b0=1, rest=0) outputs input unchanged', () => {
  const b = new Biquad();
  b.setCoeffs(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 100; i++) {
    const x = Math.sin(i * 0.1);
    assert.equal(b.process(x), x);
  }
});

test('Biquad.reset() clears state so next run is deterministic', () => {
  const b = new Biquad();
  b.setCoeffs(...lowshelf(200, 0.707, 6, SR));
  const first = [];
  for (let i = 0; i < 10; i++) first.push(b.process(Math.sin(i * 0.3)));
  b.reset();
  const second = [];
  for (let i = 0; i < 10; i++) second.push(b.process(Math.sin(i * 0.3)));
  assert.deepEqual(first, second);
});

// --------------------------------------------------------------------------
// 0 dB shelves/peaks should be near-identity (topologies MUST converge to
// unity when gain is 0 — this is a baked-in property of RBJ formulas)
// --------------------------------------------------------------------------
test('lowshelf at 0 dB is identity (≤ 1e-6 error)', () => {
  const b = new Biquad();
  b.setCoeffs(...lowshelf(200, 0.707, 0, SR));
  for (let i = 0; i < 1000; i++) {
    const x = Math.sin(2 * Math.PI * 1000 * i / SR);
    const y = b.process(x);
    assert.ok(Math.abs(y - x) < 1e-6, `sample ${i}: ${y} vs ${x}`);
  }
});

test('highshelf at 0 dB is identity (≤ 1e-6 error)', () => {
  const b = new Biquad();
  b.setCoeffs(...highshelf(4000, 0.707, 0, SR));
  for (let i = 0; i < 1000; i++) {
    const x = Math.sin(2 * Math.PI * 500 * i / SR);
    const y = b.process(x);
    assert.ok(Math.abs(y - x) < 1e-6);
  }
});

test('peaking at 0 dB is identity (≤ 1e-6 error)', () => {
  const b = new Biquad();
  b.setCoeffs(...peaking(1000, 1.0, 0, SR));
  for (let i = 0; i < 1000; i++) {
    const x = Math.sin(2 * Math.PI * 500 * i / SR);
    const y = b.process(x);
    assert.ok(Math.abs(y - x) < 1e-6);
  }
});

// --------------------------------------------------------------------------
// Frequency-response spot checks
// --------------------------------------------------------------------------
test('highpass(25 Hz) attenuates DC to near zero after 2 s', () => {
  const b = new Biquad();
  b.setCoeffs(...highpass(25, 0.707, SR));
  let last = 0;
  for (let i = 0; i < SR * 2; i++) last = b.process(1.0);
  assert.ok(Math.abs(last) < 0.01, `DC residual after 2s: ${last}`);
});

test('highpass(25 Hz) passes 1 kHz with |gain| < 0.5 dB', () => {
  const b = new Biquad();
  b.setCoeffs(...highpass(25, 0.707, SR));
  const gainDb = measureGainDb(b, 1000);
  assert.ok(Math.abs(gainDb) < 0.5, `1 kHz gain: ${gainDb.toFixed(3)} dB`);
});

test('highpass(720 Hz) attenuates 100 Hz by > 15 dB', () => {
  const b = new Biquad();
  b.setCoeffs(...highpass(720, 0.707, SR));
  const gainDb = measureGainDb(b, 100);
  assert.ok(gainDb < -15, `100 Hz gain through 720 Hz HPF: ${gainDb.toFixed(2)} dB`);
});

test('peaking(1 kHz, +6 dB) boosts 1 kHz by ~6 dB (±0.5)', () => {
  const b = new Biquad();
  b.setCoeffs(...peaking(1000, 1.0, 6.0, SR));
  const gainDb = measureGainDb(b, 1000);
  assert.ok(gainDb > 5.5 && gainDb < 6.5, `peak gain: ${gainDb.toFixed(3)} dB`);
});

test('peaking(1 kHz, -6 dB) cuts 1 kHz by ~6 dB (±0.5)', () => {
  const b = new Biquad();
  b.setCoeffs(...peaking(1000, 1.0, -6.0, SR));
  const gainDb = measureGainDb(b, 1000);
  assert.ok(gainDb < -5.5 && gainDb > -6.5, `peak cut: ${gainDb.toFixed(3)} dB`);
});

test('lowshelf(100 Hz, +10 dB) boosts 50 Hz (≈ +9 to +10 dB)', () => {
  const b = new Biquad();
  b.setCoeffs(...lowshelf(100, 0.707, 10.0, SR));
  const gainDb = measureGainDb(b, 50);
  assert.ok(gainDb > 8.5 && gainDb < 10.5, `50 Hz boost: ${gainDb.toFixed(3)} dB`);
});

test('highshelf(8 kHz, +10 dB) boosts 12 kHz (≈ +9 to +10 dB)', () => {
  const b = new Biquad();
  b.setCoeffs(...highshelf(8000, 0.707, 10.0, SR));
  const gainDb = measureGainDb(b, 12000);
  assert.ok(gainDb > 8.5 && gainDb < 10.5, `12 kHz boost: ${gainDb.toFixed(3)} dB`);
});
