// MetalZone AudioWorklet - DSP port of the VST.
// Topology matches PluginProcessor.cpp:
//   DC block -> pre-gain -> tanh -> interstage HPF -> asym tanh
//            -> low shelf -> mid peak -> high shelf -> level
// No oversampling in this demo (tanh has gentle rolloff; acceptable aliasing
// for audition purposes). The VST does 4x oversampling.

class Biquad {
  constructor() { this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
                  this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; }
  setCoeffs(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
              - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// RBJ Cookbook coefficient helpers
function highpass(f, Q, sr) {
  const w0 = 2 * Math.PI * f / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos_w0 = Math.cos(w0);
  const b0 = (1 + cos_w0) / 2;
  const b1 = -(1 + cos_w0);
  const b2 = (1 + cos_w0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cos_w0;
  const a2 = 1 - alpha;
  return [b0, b1, b2, a0, a1, a2];
}

function lowshelf(f, Q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f / sr;
  const cos_w0 = Math.cos(w0);
  const sin_w0 = Math.sin(w0);
  const alpha = sin_w0 / (2 * Q);
  const sqrtA = Math.sqrt(A);
  const b0 =    A * ((A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha);
  const b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0);
  const b2 =    A * ((A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha);
  const a0 =        (A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha;
  const a1 =   -2 * ((A - 1) + (A + 1) * cos_w0);
  const a2 =        (A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha;
  return [b0, b1, b2, a0, a1, a2];
}

function highshelf(f, Q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f / sr;
  const cos_w0 = Math.cos(w0);
  const sin_w0 = Math.sin(w0);
  const alpha = sin_w0 / (2 * Q);
  const sqrtA = Math.sqrt(A);
  const b0 =    A * ((A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0);
  const b2 =    A * ((A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha);
  const a0 =        (A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha;
  const a1 =    2 * ((A - 1) - (A + 1) * cos_w0);
  const a2 =        (A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha;
  return [b0, b1, b2, a0, a1, a2];
}

function peaking(f, Q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f / sr;
  const cos_w0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = 1 + alpha * A;
  const b1 = -2 * cos_w0;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * cos_w0;
  const a2 = 1 - alpha / A;
  return [b0, b1, b2, a0, a1, a2];
}

class MetalZoneProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'level',   defaultValue: 0.5, minValue: 0.0,   maxValue: 1.0,    automationRate: 'k-rate' },
      { name: 'dist',    defaultValue: 0.5, minValue: 0.0,   maxValue: 1.0,    automationRate: 'k-rate' },
      { name: 'low',     defaultValue: 0.0, minValue: -15.0, maxValue: 15.0,   automationRate: 'k-rate' },
      { name: 'mid',     defaultValue: 0.0, minValue: -15.0, maxValue: 15.0,   automationRate: 'k-rate' },
      { name: 'midFreq', defaultValue: 500, minValue: 200,   maxValue: 5000,   automationRate: 'k-rate' },
      { name: 'high',    defaultValue: 0.0, minValue: -15.0, maxValue: 15.0,   automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.dcBlock       = [new Biquad(), new Biquad()];
    this.interstageHPF = [new Biquad(), new Biquad()];
    this.lowShelf      = [new Biquad(), new Biquad()];
    this.midPeak       = [new Biquad(), new Biquad()];
    this.highShelf     = [new Biquad(), new Biquad()];
    this.lastParams = { low: NaN, mid: NaN, midFreq: NaN, high: NaN };
    this.staticInitialized = false;
  }

  initStatic() {
    const dc = highpass(25, 0.707, sampleRate);
    const is = highpass(720, 0.707, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      this.dcBlock[ch].setCoeffs(...dc);
      this.interstageHPF[ch].setCoeffs(...is);
    }
    this.staticInitialized = true;
  }

  updateToneStack(lowDb, midDb, midFreqHz, highDb) {
    const p = this.lastParams;
    if (p.low === lowDb && p.mid === midDb && p.midFreq === midFreqHz && p.high === highDb) return;
    const ls = lowshelf(100, 0.707, lowDb, sampleRate);
    const pk = peaking(midFreqHz, 0.7, midDb, sampleRate);
    const hs = highshelf(8000, 0.707, highDb, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      this.lowShelf[ch].setCoeffs(...ls);
      this.midPeak[ch].setCoeffs(...pk);
      this.highShelf[ch].setCoeffs(...hs);
    }
    p.low = lowDb; p.mid = midDb; p.midFreq = midFreqHz; p.high = highDb;
  }

  process(inputs, outputs, parameters) {
    if (!this.staticInitialized) this.initStatic();

    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const distAmt   = parameters.dist[0];
    const levelAmt  = parameters.level[0];
    const lowDb     = parameters.low[0];
    const midDb     = parameters.mid[0];
    const midFreqHz = parameters.midFreq[0];
    const highDb    = parameters.high[0];

    this.updateToneStack(lowDb, midDb, midFreqHz, highDb);

    const preGain = Math.pow(10, distAmt * 2.3);   // 1 .. ~200
    const bias = 0.15;
    const biasOffset = Math.tanh(bias);
    const makeup = levelAmt * 0.15 * 2.0;

    const numCh = Math.min(input.length, output.length, 2);
    const numSamples = input[0].length;

    for (let ch = 0; ch < numCh; ch++) {
      const inCh = input[ch];
      const outCh = output[ch];
      const dc   = this.dcBlock[ch];
      const iHPF = this.interstageHPF[ch];
      const ls   = this.lowShelf[ch];
      const pk   = this.midPeak[ch];
      const hs   = this.highShelf[ch];

      for (let i = 0; i < numSamples; i++) {
        let x = dc.process(inCh[i]);
        x = x * preGain;
        x = Math.tanh(x);
        x = iHPF.process(x);
        x = Math.tanh(x * 1.6 + bias) - biasOffset;
        x = ls.process(x);
        x = pk.process(x);
        x = hs.process(x);
        outCh[i] = x * makeup;
      }
    }
    return true;
  }
}

registerProcessor('metalzone-processor', MetalZoneProcessor);
