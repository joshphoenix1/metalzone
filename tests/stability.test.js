// DSP stability tests — safety properties the chain must uphold regardless
// of input or parameter settings. Failing any of these would ship real bugs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Biquad, highpass, lowshelf, highshelf, peaking } from '../web/dsp.js';

const SR = 48000;

// ---- Replicated DSP chain (mirrors web/worklet.js) ------------------------
function makeChain(sr = SR) {
  const dc = new Biquad();
  const ls = new Biquad();
  const pk = new Biquad();
  const hs = new Biquad();
  dc.setCoeffs(...highpass(48, 0.707, sr));
  return { dc, ls, pk, hs, sr };
}

function setTone(ch, { low, mid, midFreq, high }) {
  ch.ls.setCoeffs(...lowshelf(100, 0.707, low, ch.sr));
  ch.pk.setCoeffs(...peaking(midFreq, 0.7, mid, ch.sr));
  ch.hs.setCoeffs(...highshelf(3200, 0.707, high, ch.sr));
}

function resetChain(ch) {
  ch.dc.reset(); ch.ls.reset(); ch.pk.reset(); ch.hs.reset();
}

function processSample(ch, x, { dist, level }) {
  const preGain = Math.pow(10, dist * 2.3);
  const bias = 0.15;
  const biasOff = Math.tanh(bias);
  const makeup = level * 0.15 * 2.0;
  let y = ch.dc.process(x);
  y = y * preGain;
  y = Math.tanh(y);
  y = Math.tanh(y * 1.6 + bias) - biasOff;
  y = ch.ls.process(y);
  y = ch.pk.process(y);
  y = ch.hs.process(y);
  return y * makeup;
}

// ---- Test 1: NaN/Inf safety under random fuzz ----------------------------
test('chain output is finite for random inputs × random params (10k samples)', () => {
  const ch = makeChain();
  const rng = mulberry32(0xDEADBEEF);
  let maxAbs = 0;
  for (let block = 0; block < 100; block++) {
    // Randomise params each block (simulates aggressive automation)
    const p = {
      dist:    rng(),
      level:   rng(),
      low:     (rng() * 2 - 1) * 15,
      mid:     (rng() * 2 - 1) * 15,
      midFreq: 200 + rng() * 4800,
      high:    (rng() * 2 - 1) * 15,
    };
    setTone(ch, p);
    // Random input with occasional extreme spikes
    for (let i = 0; i < 100; i++) {
      const x = (rng() * 2 - 1) * (rng() < 0.02 ? 10 : 1);
      const y = processSample(ch, x, p);
      assert.ok(Number.isFinite(y), `sample not finite: ${y}`);
      if (Math.abs(y) > maxAbs) maxAbs = Math.abs(y);
    }
  }
  // Sanity: random settings shouldn't produce wild amplitudes
  assert.ok(maxAbs < 50, `unreasonable peak output: ${maxAbs}`);
});

// ---- Test 2: Output bounds at max-out ------------------------------------
test('output stays <= 6.0 at max params with 1.0 sinusoid input', () => {
  const ch = makeChain();
  setTone(ch, { low: 15, mid: 15, midFreq: 500, high: 15 });
  const params = { dist: 1, level: 1 };
  let peak = 0;
  // Warmup + measure
  for (let i = 0; i < SR; i++) {
    const x = Math.sin(2 * Math.PI * 440 * i / SR);
    const y = processSample(ch, x, params);
    assert.ok(Number.isFinite(y));
    if (i > SR / 2) peak = Math.max(peak, Math.abs(y));
  }
  assert.ok(peak < 6.0, `peak output too hot: ${peak.toFixed(3)}`);
  assert.ok(peak > 0.1,  `output suspiciously quiet: ${peak.toFixed(3)}`);
});

// ---- Test 3: Silence in → silence out (denormal convergence) -------------
test('silence input converges to numerical zero within 200 ms', () => {
  const ch = makeChain();
  setTone(ch, { low: 10, mid: 10, midFreq: 800, high: 10 });
  const params = { dist: 0.7, level: 0.5 };
  // Prime with a signal first to get state non-zero
  for (let i = 0; i < 1000; i++)
    processSample(ch, Math.sin(i * 0.05), params);
  // Then silence
  let lastAbs = 0;
  const samplesToSilence = Math.floor(SR * 0.2); // 200 ms
  for (let i = 0; i < samplesToSilence; i++)
    lastAbs = Math.abs(processSample(ch, 0, params));
  assert.ok(lastAbs < 1e-15, `silence tail: ${lastAbs.toExponential(3)}`);
});

// ---- Test 4: Reset determinism -------------------------------------------
test('same input after reset produces identical output', () => {
  const ch = makeChain();
  const params = { dist: 0.6, level: 0.5, low: 4, mid: -3, midFreq: 700, high: 6 };
  setTone(ch, params);
  const input = new Float32Array(2000);
  for (let i = 0; i < input.length; i++)
    input[i] = Math.sin(2 * Math.PI * 220 * i / SR) * 0.5;

  const out1 = [];
  for (let i = 0; i < input.length; i++) out1.push(processSample(ch, input[i], params));
  resetChain(ch);
  setTone(ch, params);
  const out2 = [];
  for (let i = 0; i < input.length; i++) out2.push(processSample(ch, input[i], params));

  for (let i = 0; i < out1.length; i++)
    assert.equal(out1[i], out2[i], `diverged at ${i}: ${out1[i]} vs ${out2[i]}`);
});

// ---- Test 5: Golden regression -------------------------------------------
// Checksum of output for a fixed input + default params.
// Updating intentionally: regenerate the hash below if tone changes on purpose.
test('golden output checksum matches reference (catches accidental tone changes)', () => {
  const ch = makeChain();
  const params = { dist: 0.5, level: 0.5, low: 0, mid: 0, midFreq: 500, high: 0 };
  setTone(ch, params);

  // Fixed deterministic input: 0.2 s of dual-sawtooth at 110 and 165 Hz
  const N = Math.floor(SR * 0.2);
  let sumSq = 0;
  let checksum = 0;
  for (let i = 0; i < N; i++) {
    const saw1 = 2 * ((i * 110 / SR) % 1) - 1;
    const saw2 = 2 * ((i * 165 / SR) % 1) - 1;
    const x = (saw1 + saw2) * 0.25;
    const y = processSample(ch, x, params);
    sumSq += y * y;
    // Simple deterministic checksum that survives minor float jitter
    checksum = (checksum * 31 + Math.round(y * 1e6)) | 0;
  }
  const rms = Math.sqrt(sumSq / N);

  // Reference values measured from this implementation:
  const EXPECTED_RMS      = 0.12562;    // ±1%
  const EXPECTED_CHECKSUM = 1647166510; // update intentionally when changing tone

  assert.ok(Math.abs(rms - EXPECTED_RMS) < EXPECTED_RMS * 0.01,
            `RMS drifted: got ${rms.toFixed(4)}, expected ~${EXPECTED_RMS}`);
  assert.equal(checksum, EXPECTED_CHECKSUM,
               `Checksum changed (tone drift). New value: ${checksum}. ` +
               `If intentional, update EXPECTED_CHECKSUM.`);
});

// ---- Deterministic RNG (mulberry32) --------------------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}
