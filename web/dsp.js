// MetalZone DSP primitives — shared by worklet.js and Node tests.
// Biquad + RBJ Audio Cookbook coefficient helpers.

export class Biquad {
  constructor() {
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0;
  }
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

export function highpass(f, Q, sr) {
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

export function lowpass(f, Q, sr) {
  const w0 = 2 * Math.PI * f / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos_w0 = Math.cos(w0);
  const b0 = (1 - cos_w0) / 2;
  const b1 =  1 - cos_w0;
  const b2 = (1 - cos_w0) / 2;
  const a0 =  1 + alpha;
  const a1 = -2 * cos_w0;
  const a2 =  1 - alpha;
  return [b0, b1, b2, a0, a1, a2];
}

export function lowshelf(f, Q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f / sr;
  const cos_w0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const sqrtA = Math.sqrt(A);
  const b0 =    A * ((A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha);
  const b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0);
  const b2 =    A * ((A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha);
  const a0 =        (A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha;
  const a1 =   -2 * ((A - 1) + (A + 1) * cos_w0);
  const a2 =        (A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha;
  return [b0, b1, b2, a0, a1, a2];
}

export function highshelf(f, Q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = 2 * Math.PI * f / sr;
  const cos_w0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const sqrtA = Math.sqrt(A);
  const b0 =    A * ((A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0);
  const b2 =    A * ((A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha);
  const a0 =        (A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha;
  const a1 =    2 * ((A - 1) - (A + 1) * cos_w0);
  const a2 =        (A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha;
  return [b0, b1, b2, a0, a1, a2];
}

export function peaking(f, Q, gainDb, sr) {
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
