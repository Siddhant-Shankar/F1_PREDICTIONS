// Illustrative airflow round the car: a smoke rake on the centre plane plus particle streaks.
// Not CFD. Each streamline is marched front to back over a height map of the car, then bent by
// the rear wing and diffuser by an amount that depends on the aero mode, so the two modes read
// differently: closed flaps throw the wake up hard, open flaps let it run nearly flat.
import * as THREE from "three";

const X0 = 4.2;
const X1 = -5.4;
const N = 200;
const XS = Array.from({ length: N }, (_, i) => X0 + ((X1 - X0) * i) / (N - 1));
const TRAIL = 5; // points per streak
const TRAIL_DS = 0.0065; // path fraction between streak points

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Piecewise-linear lookup in an [x, value] table sorted by descending x. */
function table(t: [number, number][], x: number): number {
  if (x >= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (x >= t[i][0]) {
      const [xa, ya] = t[i - 1];
      const [xb, yb] = t[i];
      return lerp(ya, yb, (x - xa) / (xb - xa));
    }
  }
  return t[t.length - 1][1];
}

// centreline top of the car (nose, halo, airbox, engine cover) and half width of the body
const TOP: [number, number][] = [
  [2.9, 0.02], [2.74, 0.23], [2.2, 0.4], [1.5, 0.56], [0.95, 0.64], [0.82, 0.84], [0.3, 0.86],
  [-0.15, 0.96], [-0.5, 0.86], [-1.0, 0.69], [-1.5, 0.56], [-1.8, 0.46], [-2.1, 0.39], [-2.4, 0.3], [-2.5, 0.02],
];
const HALF: [number, number][] = [
  [2.74, 0.06], [2.2, 0.15], [1.5, 0.24], [0.8, 0.3], [0.0, 0.34], [-1.0, 0.22], [-1.8, 0.12], [-2.4, 0.07],
];

/** Height of the car's upper surface at (x, z), or -1 where there is no car. */
function topAt(x: number, z: number): number {
  const az = Math.abs(z);
  let h = -1;
  if (x < 2.9 && x > -2.5 && az < table(HALF, x)) h = table(TOP, x);
  if (x < 0.72 && x > -1.25 && az > 0.25 && az < 0.72) h = Math.max(h, lerp(0.5, 0.22, (0.72 - x) / 1.97));
  if (x < 2.9 && x > 2.26 && az < 0.86) h = Math.max(h, 0.26);
  for (const [cx, z0, z1] of [
    [1.7, 0.66, 0.94],
    [-1.7, 0.57, 0.95],
  ]) {
    const dx = x - cx;
    if (Math.abs(dx) < 0.36 && az > z0 && az < z1) h = Math.max(h, 0.36 + Math.sqrt(0.36 * 0.36 - dx * dx));
  }
  return h;
}

interface Stream {
  y0: number;
  z0: number;
  y: [Float32Array, Float32Array]; // corner, straight
  z: [Float32Array, Float32Array];
  under: boolean;
}

/** March one streamline for one aero mode (0 = corner, 1 = straight-line). */
function march(y0: number, z0: number, mode: number): { y: Float32Array; z: Float32Array } {
  const ys = new Float32Array(N);
  const zs = new Float32Array(N);
  const az0 = Math.abs(z0);
  const under = y0 < 0.1 && az0 < 0.78;
  let y = y0;
  for (let k = 0; k < N; k++) {
    const x = XS[k];
    let target = y0;
    if (!under) {
      // look slightly downstream so the flow lifts before it reaches the bodywork
      for (let d = -0.4; d <= 0.04; d += 0.04) {
        const t = topAt(x + d, z0);
        if (t > 0 && y0 < t + 0.08) target = Math.max(target, t + 0.06);
      }
    }
    y += (target - y) * (target > y ? 0.3 : 0.06);
    let dy = 0;
    // front wing: a little upwash over the flaps, more with them closed
    if (x < 2.5 && az0 < 0.86 && y0 < 0.45 && !under) dy += lerp(0.07, 0.025, mode) * smooth(2.5, 2.1, x);
    // diffuser and the low-pressure pull of the rear wing lift whatever comes off the floor
    if (x < -1.38 && az0 < 0.62 && y0 < 0.55) dy += lerp(0.36, 0.17, mode) * (1 - Math.exp((x + 1.38) / 0.7));
    // rear wing: the big one
    if (x < -1.98 && az0 < 0.52) {
      const reach = Math.exp(-(((y0 - 0.85) / 0.36) ** 2));
      dy += lerp(0.62, 0.13, mode) * reach * (1 - Math.exp((x + 1.98) / 0.55));
    }
    // wake: rolling turbulence that dies away downstream
    if (x < -2.3 && az0 < 0.66 && y0 < 1.15) {
      const amp = lerp(0.085, 0.025, mode) * smooth(-2.3, -2.8, x) * Math.exp((x + 2.3) / 2.6);
      dy += amp * Math.sin(x * 6.3 + z0 * 13 + y0 * 9);
    }
    ys[k] = Math.max(y + dy, 0.02);
    // outwash: the front wing turns air outboard round the front tyres
    let dz = 0;
    if (az0 > 0.3 && az0 < 1.1 && y0 < 0.55) dz += Math.sign(z0) * lerp(0.17, 0.1, mode) * smooth(2.4, 1.9, x);
    zs[k] = z0 + dz;
  }
  return { y: ys, z: zs };
}

interface Particle {
  stream: number;
  s: number;
  speed: number;
}

export class Airflow {
  readonly group = new THREE.Group();
  private streams: Stream[] = [];
  private rake: THREE.LineSegments;
  private rakeIdx: number[] = [];
  private streaks: THREE.LineSegments;
  private particles: Particle[] = [];
  private mix = 0;
  private dark = true;

  constructor() {
    const ys = [0.05, 0.2, 0.38, 0.56, 0.74, 0.92, 1.1];
    const zs = Array.from({ length: 9 }, (_, i) => -1.0 + (2.0 * i) / 8);
    for (const z0 of zs) {
      for (const y0 of ys) {
        const c = march(y0, z0, 0);
        const s = march(y0, z0, 1);
        this.streams.push({ y0, z0, y: [c.y, s.y], z: [c.z, s.z], under: y0 < 0.1 && Math.abs(z0) < 0.78 });
      }
    }
    // the smoke rake: one vertical comb of streamlines on the centre plane
    this.streams.forEach((s, i) => {
      if (Math.abs(s.z0) < 0.1) this.rakeIdx.push(i);
    });
    const rakeGeo = new THREE.BufferGeometry();
    rakeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.rakeIdx.length * (N - 1) * 6), 3));
    rakeGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.rakeIdx.length * (N - 1) * 6), 3));
    this.rake = new THREE.LineSegments(rakeGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));

    const per = 5;
    this.streams.forEach((_, i) => {
      for (let p = 0; p < per; p++) this.particles.push({ stream: i, s: Math.random(), speed: 0.85 + Math.random() * 0.3 });
    });
    const sg = new THREE.BufferGeometry();
    const segs = this.particles.length * (TRAIL - 1) * 2;
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs * 3), 3));
    sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(segs * 3), 3));
    this.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.rake.frustumCulled = false;
    this.streaks.frustumCulled = false;
    this.group.add(this.rake, this.streaks);
    this.setTheme("dark", new THREE.Color(0x0d0f12));
    this.setMix(0);
  }

  private at(st: Stream, s: number, out: THREE.Vector3) {
    const f = clamp01(s) * (N - 1);
    const i = Math.min(Math.floor(f), N - 2);
    const t = f - i;
    const m = this.mix;
    const y = lerp(lerp(st.y[0][i], st.y[1][i], m), lerp(st.y[0][i + 1], st.y[1][i + 1], m), t);
    const z = lerp(lerp(st.z[0][i], st.z[1][i], m), lerp(st.z[0][i + 1], st.z[1][i + 1], m), t);
    return out.set(lerp(XS[i], XS[i + 1], t), y, z);
  }

  /** 0 = corner mode, 1 = straight-line mode. */
  setMix(m: number) {
    this.mix = m;
    const pos = this.rake.geometry.attributes.position as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let v = 0;
    for (const si of this.rakeIdx) {
      const st = this.streams[si];
      for (let k = 0; k < N - 1; k++) {
        this.at(st, k / (N - 1), a);
        this.at(st, (k + 1) / (N - 1), b);
        pos.setXYZ(v++, a.x, a.y, a.z);
        pos.setXYZ(v++, b.x, b.y, b.z);
      }
    }
    pos.needsUpdate = true;
  }

  setTheme(theme: "dark" | "light", bg: THREE.Color) {
    this.dark = theme === "dark";
    const head = new THREE.Color(this.dark ? 0xd6e4f5 : 0x27303b);
    const fade = this.dark ? new THREE.Color(0x000000) : bg.clone();
    const blending = this.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (const l of [this.rake, this.streaks]) {
      const mat = l.material as THREE.LineBasicMaterial;
      mat.blending = blending;
      mat.opacity = this.dark ? 1 : 0.75;
      mat.needsUpdate = true;
    }
    // rake: brightest mid-stream, fading at both ends of the tunnel
    const rc = this.rake.geometry.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    let v = 0;
    for (let r = 0; r < this.rakeIdx.length; r++) {
      for (let k = 0; k < N - 1; k++) {
        for (const kk of [k, k + 1]) {
          const t = kk / (N - 1);
          const w = smooth(0, 0.15, t) * smooth(1, 0.7, t) * 0.22;
          c.copy(fade).lerp(head, w);
          rc.setXYZ(v++, c.r, c.g, c.b);
        }
      }
    }
    rc.needsUpdate = true;
    const sc = this.streaks.geometry.attributes.color as THREE.BufferAttribute;
    v = 0;
    for (let p = 0; p < this.particles.length; p++) {
      for (let j = 0; j < TRAIL - 1; j++) {
        for (const jj of [j, j + 1]) {
          c.copy(fade).lerp(head, (1 - jj / (TRAIL - 1)) * (this.dark ? 0.5 : 0.55));
          sc.setXYZ(v++, c.r, c.g, c.b);
        }
      }
    }
    sc.needsUpdate = true;
  }

  /** Advance the streaks by dt seconds (0 just redraws them). */
  update(dt: number) {
    const pos = this.streaks.geometry.attributes.position as THREE.BufferAttribute;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const len = X0 - X1;
    let v = 0;
    for (const p of this.particles) {
      const st = this.streams[p.stream];
      const x = lerp(X0, X1, p.s);
      let k = 1;
      if (st.under && x < 1.4 && x > -1.4) k = 1.45; // floor accelerates the air beneath it
      if (x < -2.2 && Math.abs(st.z0) < 0.6) k = lerp(0.55, 0.85, this.mix); // slow, dirty wake
      p.s += (dt * 3.6 * p.speed * k * lerp(1, 1.12, this.mix)) / len;
      if (p.s > 1) p.s -= 1;
      for (let j = 0; j < TRAIL - 1; j++) {
        this.at(st, p.s - j * TRAIL_DS, a);
        this.at(st, p.s - (j + 1) * TRAIL_DS, b);
        pos.setXYZ(v++, a.x, a.y, a.z);
        pos.setXYZ(v++, b.x, b.y, b.z);
      }
    }
    pos.needsUpdate = true;
  }
}
