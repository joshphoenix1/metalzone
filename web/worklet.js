// MetalZone AudioWorklet - DSP port of the VST.
// Topology matches PluginProcessor.cpp:
//   DC block -> pre-gain -> tanh -> interstage HPF -> asym tanh
//            -> low shelf -> mid peak -> high shelf -> level
// No oversampling in this demo (tanh has gentle rolloff; acceptable aliasing
// for audition purposes). The VST does 4x oversampling.

import { Biquad, highpass, lowshelf, highshelf, peaking } from './dsp.js';

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
