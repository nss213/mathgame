// Exact rational numbers so the game never shows 0.3333…

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Frac {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error('Frac needs integers');
    if (d === 0) throw new Error('Zero denominator');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g || 0; // avoid -0
    this.d = d / g;
    Object.freeze(this);
  }

  add(o) { o = F(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return this.add(F(o).neg()); }
  mul(o) { o = F(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { return this.mul(F(o).inv()); }
  neg() { return new Frac(-this.n, this.d); }
  inv() { return new Frac(this.d, this.n); }
  abs() { return new Frac(Math.abs(this.n), this.d); }

  isZero() { return this.n === 0; }
  isOne() { return this.n === 1 && this.d === 1; }
  isInt() { return this.d === 1; }
  sign() { return Math.sign(this.n); }
  eq(o) { o = F(o); return this.n === o.n && this.d === o.d; }
  value() { return this.n / this.d; }

  key() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
  // Display form, using a real minus sign.
  toString() {
    const a = Math.abs(this.n);
    return (this.n < 0 ? '−' : '') + (this.d === 1 ? `${a}` : `${a}/${this.d}`);
  }
}

export function F(n, d = 1) {
  return n instanceof Frac ? n : new Frac(n, d);
}
