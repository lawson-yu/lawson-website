export const SPRINGS = {
  POSE: { k: 30, c: 11 },
  TURN: { k: 110, c: 15 },
  SWAY: { k: 45, c: 9 },
  FLOAT: { k: 10, c: 6 },
  GLOW: { k: 18, c: 8, eps: 1e-5 },
} as const;

export class Spring {
  x: number;
  v = 0;
  t: number;
  k: number;
  c: number;
  eps: number;

  constructor(value: number, k: number, c: number, eps = 1e-4) {
    this.x = value;
    this.t = value;
    this.k = k;
    this.c = c;
    this.eps = eps;
  }

  snap(value = this.t) {
    this.x = value;
    this.t = value;
    this.v = 0;
  }

  step(dt: number): boolean {
    dt = Math.max(0, Math.min(0.25, dt));
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.v += (this.k * (this.t - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.t - this.x) < this.eps && Math.abs(this.v) < this.eps * 10) {
      this.snap();
      return false;
    }
    return true;
  }
}
