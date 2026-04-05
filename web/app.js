// MetalZone demo app - wires pedal UI to AudioWorklet DSP.

(() => {
  'use strict';

  // ==========================================================================
  // Knob behavior: vertical drag (up=increase) with optional log skew.
  // ==========================================================================
  const KNOB_ANGLE_MIN = -140; // degrees
  const KNOB_ANGLE_MAX =  140;
  const DRAG_PIXELS_FULL = 180; // pixels to traverse full range

  class Knob {
    constructor(el, onChange) {
      this.el = el;
      this.param = el.dataset.param;
      this.min = parseFloat(el.dataset.min);
      this.max = parseFloat(el.dataset.max);
      this.defaultValue = parseFloat(el.dataset.default);
      this.skew = el.dataset.skew || 'linear'; // 'linear' | 'log'
      this.unit = el.dataset.unit || '';
      this.value = this.defaultValue;
      this.onChange = onChange;

      this._bindDrag();
      this.setValue(this.defaultValue, false);
    }

    // normalized: 0..1
    _valueToNorm(v) {
      const clamped = Math.max(this.min, Math.min(this.max, v));
      if (this.skew === 'log') {
        return Math.log(clamped / this.min) / Math.log(this.max / this.min);
      }
      return (clamped - this.min) / (this.max - this.min);
    }
    _normToValue(n) {
      const clamped = Math.max(0, Math.min(1, n));
      if (this.skew === 'log') {
        return this.min * Math.pow(this.max / this.min, clamped);
      }
      return this.min + clamped * (this.max - this.min);
    }

    setValue(v, notify = true) {
      this.value = Math.max(this.min, Math.min(this.max, v));
      const norm = this._valueToNorm(this.value);
      const angle = KNOB_ANGLE_MIN + norm * (KNOB_ANGLE_MAX - KNOB_ANGLE_MIN);
      // Preserve centering transform for inner concentric knobs
      if (this.el.classList.contains('inner')) {
        this.el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      } else {
        this.el.style.transform = `rotate(${angle}deg)`;
      }
      if (notify && this.onChange) this.onChange(this.param, this.value);
    }

    _bindDrag() {
      let startY = 0;
      let startNorm = 0;

      const onMove = (e) => {
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const delta = (startY - y) / DRAG_PIXELS_FULL;
        const newNorm = Math.max(0, Math.min(1, startNorm + delta));
        this.setValue(this._normToValue(newNorm), true);
        e.preventDefault();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
      const onDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startNorm = this._valueToNorm(this.value);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
      };

      this.el.addEventListener('mousedown', onDown);
      this.el.addEventListener('touchstart', onDown, { passive: false });

      // Double-click resets to default
      this.el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.setValue(this.defaultValue, true);
      });
    }

    formatted() {
      if (this.unit === 'Hz') return `${this.value.toFixed(0)} Hz`;
      if (this.unit === 'dB') return `${this.value >= 0 ? '+' : ''}${this.value.toFixed(1)} dB`;
      return this.value.toFixed(3);
    }
  }

  // ==========================================================================
  // Audio Engine
  // ==========================================================================
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.worklet = null;
      this.source = null;
      this.sourceType = null;     // 'osc' | 'buffer'
      this.buffer = null;
      this.loop = true;
      this.active = false;
      this.bypass = false;
      this.bypassGain = null;
      this.fxGain = null;
    }

    async ensureContext() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      await this.ctx.audioWorklet.addModule('worklet.js');

      this.worklet = new AudioWorkletNode(this.ctx, 'metalzone-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      // Dry/wet routing for footswitch bypass
      this.fxGain     = this.ctx.createGain();
      this.bypassGain = this.ctx.createGain();
      this.fxGain.gain.value     = 1.0;
      this.bypassGain.gain.value = 0.0;

      this.worklet.connect(this.fxGain).connect(this.ctx.destination);
    }

    setParam(name, value) {
      if (!this.worklet) return;
      const p = this.worklet.parameters.get(name);
      if (p) p.setValueAtTime(value, this.ctx.currentTime);
    }

    setBypass(b) {
      this.bypass = b;
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const target = b ? 0.0 : 1.0;
      this.fxGain.gain.cancelScheduledValues(now);
      this.fxGain.gain.setValueAtTime(this.fxGain.gain.value, now);
      this.fxGain.gain.linearRampToValueAtTime(target, now + 0.02);
      this.bypassGain.gain.cancelScheduledValues(now);
      this.bypassGain.gain.setValueAtTime(this.bypassGain.gain.value, now);
      this.bypassGain.gain.linearRampToValueAtTime(1.0 - target, now + 0.02);
    }

    _teardownSource() {
      if (this.source) {
        try { this.source.stop(); } catch (e) { /* ignore */ }
        this.source.disconnect();
        this.source = null;
      }
      this.active = false;
    }

    _connectSource(node) {
      node.connect(this.worklet);
      node.connect(this.bypassGain);
      this.bypassGain.connect(this.ctx.destination);
    }

    playDemoTone() {
      this._teardownSource();
      // Synthesize a simple power chord (root + fifth) with slow decay loop.
      // Sawtooth — sounds "guitar-ish" through distortion.
      const rootHz = 82.4;   // low E
      const fifthHz = 123.5; // B
      const merger = this.ctx.createGain();
      merger.gain.value = 0.18;

      const mkOsc = (f) => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        return o;
      };

      const o1 = mkOsc(rootHz);
      const o2 = mkOsc(fifthHz);
      const o3 = mkOsc(rootHz * 2);
      o1.connect(merger); o2.connect(merger); o3.connect(merger);

      // Slight chug LFO on amplitude
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 2.2;
      lfo.type = 'sine';
      lfoGain.gain.value = 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(merger.gain);

      o1.start(); o2.start(); o3.start(); lfo.start();

      this.source = {
        stop: () => { o1.stop(); o2.stop(); o3.stop(); lfo.stop(); },
        disconnect: () => { merger.disconnect(); }
      };
      this._connectSource(merger);
      this.sourceType = 'osc';
      this.active = true;
    }

    async loadFile(file) {
      await this.ensureContext();
      const arrayBuf = await file.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(arrayBuf);
    }

    playBuffer() {
      if (!this.buffer) return false;
      this._teardownSource();
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.loop = this.loop;
      src.start();
      src.onended = () => { if (!this.loop) this.active = false; };
      this.source = src;
      this._connectSource(src);
      this.sourceType = 'buffer';
      this.active = true;
      return true;
    }

    stop() {
      this._teardownSource();
    }

    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  }

  // ==========================================================================
  // Wire it all up
  // ==========================================================================
  const engine = new AudioEngine();
  const knobs = {};

  async function handleKnobChange(param, value) {
    await engine.ensureContext();
    engine.resume();
    engine.setParam(param, value);
    updateReadout();
  }

  function updateReadout() {
    const lines = Object.values(knobs).map(k =>
      `${k.param.padEnd(10)} : ${k.formatted()}`
    );
    document.getElementById('readout').textContent = lines.join('\n');
  }

  function setStatus(msg) {
    document.getElementById('status').textContent = msg;
  }

  function setLED(on) {
    document.getElementById('led').classList.toggle('active', on);
  }

  // Init knobs
  document.querySelectorAll('.knob[data-param]').forEach(el => {
    const k = new Knob(el, handleKnobChange);
    knobs[k.param] = k;
  });
  updateReadout();

  // Buttons
  document.getElementById('btn-demo').addEventListener('click', async () => {
    await engine.ensureContext();
    engine.resume();
    engine.playDemoTone();
    setLED(true);
    setStatus('Playing synthetic power-chord demo tone. Adjust knobs to hear distortion change.');
    document.getElementById('btn-stop').disabled = false;
    // Push current knob values
    Object.values(knobs).forEach(k => engine.setParam(k.param, k.value));
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    engine.stop();
    setLED(false);
    setStatus('Stopped.');
    document.getElementById('btn-stop').disabled = true;
  });

  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus(`Decoding ${file.name}…`);
    try {
      await engine.loadFile(file);
      engine.resume();
      engine.playBuffer();
      setLED(true);
      setStatus(`Playing: ${file.name}`);
      document.getElementById('btn-stop').disabled = false;
      Object.values(knobs).forEach(k => engine.setParam(k.param, k.value));
    } catch (err) {
      setStatus(`Failed to decode file: ${err.message}`);
    }
  });

  document.getElementById('loop-check').addEventListener('change', (e) => {
    engine.loop = e.target.checked;
    if (engine.source && engine.sourceType === 'buffer') {
      engine.source.loop = engine.loop;
    }
  });

  // Footswitch toggles bypass
  document.getElementById('footswitch').addEventListener('click', async () => {
    await engine.ensureContext();
    engine.setBypass(!engine.bypass);
    setLED(engine.active && !engine.bypass);
    setStatus(engine.bypass ? 'Pedal bypassed (dry signal).' : 'Pedal engaged.');
  });
})();
