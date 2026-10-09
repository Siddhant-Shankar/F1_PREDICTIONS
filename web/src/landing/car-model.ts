// A 2026-regulation F1 car built from code: lofted bodywork, extruded wing profiles, lathed tyres.
// Metres, nose towards +x, y up. Front axle at x = +1.7 and rear at -1.7 (3.4 m wheelbase), 1.9 m wide.
import * as THREE from "three";
import type { PartKey } from "./garage-data";

// ------------------------------------------------------------------ geometry helpers

interface Station {
  x: number;
  w: number; // half width
  t: number; // height above the centre line
  b: number; // depth below it
  y: number; // centre line height
  z?: number; // lateral centre (sidepods)
  n?: number; // superellipse exponent: 2 = ellipse, higher = boxier
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Sweep a superellipse cross-section through stations, smoothing between them. UV u runs around, v along. */
function loft(stations: Station[], seg = 40, sub = 6): THREE.BufferGeometry {
  const keys = ["x", "w", "t", "b", "y", "z", "n"] as const;
  const val = (s: Station, k: (typeof keys)[number]) => (k === "z" ? (s.z ?? 0) : k === "n" ? (s.n ?? 2.6) : s[k]);
  const rows: Record<(typeof keys)[number], number>[] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const p0 = stations[Math.max(i - 1, 0)];
    const p1 = stations[i];
    const p2 = stations[i + 1];
    const p3 = stations[Math.min(i + 2, stations.length - 1)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const r = {} as Record<(typeof keys)[number], number>;
      for (const k of keys) r[k] = catmull(val(p0, k), val(p1, k), val(p2, k), val(p3, k), t);
      r.w = Math.max(r.w, 0.002);
      rows.push(r);
    }
  }
  const last = stations[stations.length - 1];
  rows.push(Object.fromEntries(keys.map((k) => [k, val(last, k)])) as Record<(typeof keys)[number], number>);

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ring = seg + 1;
  rows.forEach((r, i) => {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const e = 2 / r.n;
      const pz = r.w * Math.sign(c) * Math.abs(c) ** e;
      const py = (s >= 0 ? r.t : r.b) * Math.sign(s) * Math.abs(s) ** e;
      pos.push(r.x, r.y + py, r.z + pz);
      uv.push(j / seg, i / (rows.length - 1));
    }
  });
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * ring + j;
      const b = a + ring;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // end caps as fans around each end ring's centre
  for (const [ri, flip] of [
    [0, false],
    [rows.length - 1, true],
  ] as const) {
    const r = rows[ri];
    const c = pos.length / 3;
    pos.push(r.x, r.y, r.z);
    uv.push(0.75, ri ? 1 : 0);
    const start = c + 1;
    for (let j = 0; j <= seg; j++) {
      const k = ri * ring + j;
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      uv.push(0.75, ri ? 1 : 0);
    }
    for (let j = 0; j < seg; j++) {
      if (flip) idx.push(c, start + j + 1, start + j);
      else idx.push(c, start + j, start + j + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the shading seam where the ring wraps round
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < rows.length; i++) {
    const a = i * ring;
    const b = a + seg;
    const v = new THREE.Vector3().fromBufferAttribute(n, a).add(new THREE.Vector3().fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

/** Inverted, cambered aerofoil: leading edge at the origin, trailing edge at (-chord, 0), extruded across `span`. */
function wingGeometry(chord: number, span: number, thick = 0.1, camber = 0.06): THREE.BufferGeometry {
  const N = 24;
  const top: THREE.Vector2[] = [];
  const bot: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) {
    const s = (1 - Math.cos((i / N) * Math.PI)) / 2;
    const yt = 5 * thick * chord * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4);
    const yc = -camber * chord * 4 * s * (1 - s);
    top.push(new THREE.Vector2(-s * chord, yc + yt));
    bot.push(new THREE.Vector2(-s * chord, yc - yt));
  }
  const shape = new THREE.Shape([...top, ...bot.reverse()]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -span / 2);
  g.computeVertexNormals();
  return g;
}

/** Flat plate from an x/y outline, `thick` deep, centred on z = 0. */
function plate(points: [number, number][], thick: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))), {
    depth: thick,
    bevelEnabled: false,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Thin rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.scale.set(1.9, 1, 0.6); // aero-section wishbones, not round tubes
  return m;
}

function tyreGeometry(width: number, outer = 0.36, inner = 0.229): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const rc = 0.05;
  const h = width / 2;
  pts.push(new THREE.Vector2(inner, -h * 0.92));
  pts.push(new THREE.Vector2(outer - rc, -h));
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(outer - rc + Math.cos(a) * rc, -h + rc + Math.sin(a) * rc));
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(outer - rc + Math.cos(a) * rc, h - rc + Math.sin(a) * rc));
  }
  pts.push(new THREE.Vector2(inner, h * 0.92));
  const g = new THREE.LatheGeometry(pts, 56);
  g.rotateX(Math.PI / 2);
  return g;
}

// ------------------------------------------------------------------ materials

type Role = "body" | "primary" | "accent" | "carbon" | "void" | "tyre" | "rim" | "metal" | "stripe";

export interface Colors {
  body: string;
  accent: string;
}

interface Registered {
  mat: THREE.MeshStandardMaterial;
  role: Role;
  part: PartKey | "suspension";
}

/** Two-tone livery wrapped round every lofted panel: body colour, an accent stripe along the spine,
 *  carbon underneath. u = 0.25 is the top of each section, u = 0.75 the bottom. */
function paintLivery(ctx: CanvasRenderingContext2D, c: Colors) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = c.body;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.accent;
  ctx.fillRect(W * 0.225, 0, W * 0.05, H);
  ctx.fillStyle = "#111316";
  ctx.fillRect(W * 0.545, 0, W * 0.41, H);
  // a hairline where paint meets carbon
  ctx.fillStyle = c.accent;
  ctx.fillRect(W * 0.535, 0, W * 0.01, H);
  ctx.fillRect(W * 0.955, 0, W * 0.01, H);
}

// ------------------------------------------------------------------ the car

export interface Explodable {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  off: THREE.Vector3;
  part: PartKey | "suspension";
}

export interface Anchor {
  part: PartKey;
  local: THREE.Vector3;
  off: THREE.Vector3;
}

export class CarModel {
  readonly root = new THREE.Group();
  readonly explodables: Explodable[] = [];
  readonly anchors: Anchor[] = [];
  readonly pickables: THREE.Object3D[] = [];
  private mats: Registered[] = [];
  private livery = document.createElement("canvas");
  private liveryTex: THREE.CanvasTexture;
  private colors: Colors = { body: "#ff8000", accent: "#15181c" };
  private flaps: { obj: THREE.Object3D; corner: number; straight: number }[] = [];
  private powerUnit = new THREE.Group();
  private suspension: THREE.Object3D[] = [];

  constructor() {
    this.livery.width = 512;
    this.livery.height = 8;
    this.liveryTex = new THREE.CanvasTexture(this.livery);
    this.liveryTex.colorSpace = THREE.SRGBColorSpace;
    this.liveryTex.anisotropy = 4;
    this.build();
    this.setColors(this.colors);
  }

  private mat(role: Role, part: PartKey | "suspension"): THREE.MeshStandardMaterial {
    let m: THREE.MeshStandardMaterial;
    switch (role) {
      case "body":
        m = new THREE.MeshPhysicalMaterial({ map: this.liveryTex, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
        break;
      case "primary":
      case "accent":
        m = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
        break;
      case "carbon":
        m = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.48, metalness: 0.25 });
        break;
      case "void":
        m = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.95, metalness: 0 });
        break;
      case "tyre":
        m = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.88, metalness: 0 });
        break;
      case "rim":
        m = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.3, metalness: 0.85 });
        break;
      case "metal":
        m = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.32, metalness: 0.95 });
        break;
      case "stripe":
        m = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.6 });
        break;
    }
    m.side = THREE.DoubleSide;
    this.mats.push({ mat: m, role, part });
    return m;
  }

  private add(part: PartKey | "suspension", off: [number, number, number], ...objs: THREE.Object3D[]): THREE.Group {
    const g = new THREE.Group();
    g.add(...objs);
    g.userData.part = part;
    this.root.add(g);
    this.explodables.push({ obj: g, base: g.position.clone(), off: new THREE.Vector3(...off), part });
    if (part !== "suspension") this.pickables.push(g);
    return g;
  }

  private anchor(part: PartKey, local: [number, number, number], off: [number, number, number]) {
    this.anchors.push({ part, local: new THREE.Vector3(...local), off: new THREE.Vector3(...off) });
  }

  private build() {
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const o = new THREE.Mesh(g, m);
      o.castShadow = true;
      return o;
    };

    // ---- nose
    {
      const body = this.mat("body", "nose");
      const nose = mesh(
        loft([
          { x: 2.74, w: 0.05, t: 0.04, b: 0.03, y: 0.19, n: 2.2 },
          { x: 2.55, w: 0.1, t: 0.08, b: 0.06, y: 0.22 },
          { x: 2.2, w: 0.15, t: 0.12, b: 0.09, y: 0.28 },
          { x: 1.8, w: 0.2, t: 0.16, b: 0.12, y: 0.34 },
          { x: 1.45, w: 0.24, t: 0.18, b: 0.16, y: 0.38 },
        ]),
        body,
      );
      const carbon = this.mat("carbon", "nose");
      const pylonL = mesh(plate([[2.5, 0.1], [2.62, 0.1], [2.58, 0.2], [2.44, 0.22]], 0.02), carbon);
      pylonL.position.z = 0.07;
      const pylonR = pylonL.clone();
      pylonR.position.z = -0.07;
      this.add("nose", [0.32, 0.14, 0], nose, pylonL, pylonR);
      this.anchor("nose", [2.2, 0.42, 0], [0.32, 0.14, 0]);
    }

    // ---- survival cell, cockpit, halo, driver
    {
      const body = this.mat("body", "chassis");
      const carbon = this.mat("carbon", "chassis");
      const voidM = this.mat("void", "chassis");
      voidM.polygonOffset = true;
      voidM.polygonOffsetFactor = -2;
      const accent = this.mat("accent", "chassis");
      const mirrorPaint = this.mat("primary", "chassis");
      const tub = mesh(
        loft([
          { x: 1.5, w: 0.24, t: 0.18, b: 0.16, y: 0.38 },
          { x: 1.15, w: 0.27, t: 0.21, b: 0.2, y: 0.41 },
          { x: 0.8, w: 0.3, t: 0.22, b: 0.24, y: 0.42 },
          { x: 0.3, w: 0.33, t: 0.2, b: 0.3, y: 0.42 },
          { x: -0.15, w: 0.34, t: 0.22, b: 0.32, y: 0.44 },
        ]),
        body,
      );
      const cockpit = mesh(
        loft(
          [
            { x: 0.86, w: 0.02, t: 0.02, b: 0.02, y: 0.635 },
            { x: 0.74, w: 0.2, t: 0.02, b: 0.02, y: 0.635 },
            { x: 0.3, w: 0.23, t: 0.02, b: 0.02, y: 0.623 },
            { x: 0.02, w: 0.2, t: 0.02, b: 0.02, y: 0.64 },
            { x: -0.04, w: 0.02, t: 0.02, b: 0.02, y: 0.645 },
          ],
          32,
          4,
        ),
        voidM,
      );
      const helmet = mesh(new THREE.SphereGeometry(0.115, 28, 20), accent);
      helmet.position.set(0.36, 0.7, 0);
      helmet.scale.set(1.12, 1, 0.95);
      const visor = mesh(new THREE.SphereGeometry(0.117, 28, 8, Math.PI - 0.9, 1.8, 1.25, 0.42), voidM);
      visor.position.copy(helmet.position);
      visor.scale.copy(helmet.scale);
      const halo = new THREE.CatmullRomCurve3(
        [
          [0.0, 0.62, 0.3],
          [0.12, 0.76, 0.29],
          [0.45, 0.83, 0.23],
          [0.78, 0.82, 0.0],
          [0.45, 0.83, -0.23],
          [0.12, 0.76, -0.29],
          [0.0, 0.62, -0.3],
        ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      );
      const haloMesh = mesh(new THREE.TubeGeometry(halo, 64, 0.024, 10), carbon);
      const pillar = mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([new THREE.Vector3(0.78, 0.82, 0), new THREE.Vector3(0.9, 0.74, 0), new THREE.Vector3(0.98, 0.63, 0)]),
          16,
          0.024,
          8,
        ),
        carbon,
      );
      const mirrors: THREE.Object3D[] = [];
      for (const s of [1, -1]) {
        const mir = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.13), mirrorPaint);
        mir.position.set(0.62, 0.71, s * 0.47);
        const stalk = rod(new THREE.Vector3(0.62, 0.62, s * 0.3), new THREE.Vector3(0.62, 0.69, s * 0.43), 0.008, carbon);
        mirrors.push(mir, stalk);
      }
      this.add("chassis", [0, 0.42, 0], tub, cockpit, helmet, visor, haloMesh, pillar, ...mirrors);
      this.anchor("chassis", [0.5, 0.86, 0], [0, 0.42, 0]);
    }

    // ---- sidepods
    {
      const body = this.mat("body", "sidepods");
      const voidM = this.mat("void", "sidepods");
      for (const s of [1, -1]) {
        const pod = mesh(
          loft([
            { x: 0.72, w: 0.15, t: 0.12, b: 0.1, y: 0.37, z: s * 0.47, n: 3 },
            { x: 0.5, w: 0.2, t: 0.15, b: 0.16, y: 0.34, z: s * 0.5, n: 3 },
            { x: 0.0, w: 0.21, t: 0.13, b: 0.2, y: 0.3, z: s * 0.5, n: 3 },
            { x: -0.6, w: 0.17, t: 0.08, b: 0.16, y: 0.24, z: s * 0.45, n: 2.8 },
            { x: -1.25, w: 0.07, t: 0.04, b: 0.1, y: 0.18, z: s * 0.32, n: 2.4 },
          ]),
          body,
        );
        const inlet = mesh(plate([[0, -0.08], [0.0, 0.1], [0.02, 0.1], [0.02, -0.08]], 0.24), voidM);
        inlet.position.set(0.71, 0.375, s * 0.48);
        // each pod slides out to its own side
        this.add("sidepods", [0, 0.12, s * 0.62], pod, inlet);
      }
      this.anchor("sidepods", [0.2, 0.5, 0.72], [0, 0.12, 0.62]);
    }

    // ---- floor and diffuser
    {
      const carbon = this.mat("carbon", "floor");
      const outline: [number, number][] = [
        [1.42, 0.22],
        [1.2, 0.3],
        [0.75, 0.62],
        [0.6, 0.78],
        [-1.2, 0.78],
        [-1.38, 0.56],
        [-1.38, -0.56],
        [-1.2, -0.78],
        [0.6, -0.78],
        [0.75, -0.62],
        [1.2, -0.3],
        [1.42, -0.22],
      ];
      const floor = mesh(plate(outline, 0.022), carbon);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.045;
      // diffuser ramp with strakes
      const rampGeo = new THREE.PlaneGeometry(0.85, 1.0);
      rampGeo.rotateX(-Math.PI / 2);
      const ramp = mesh(rampGeo, carbon);
      ramp.rotation.z = -0.32;
      ramp.position.set(-1.78, 0.17, 0);
      const strakes: THREE.Object3D[] = [];
      for (const z of [-0.42, -0.18, 0.18, 0.42]) {
        const st = mesh(plate([[-1.38, 0.05], [-2.2, 0.32], [-2.2, 0.05]], 0.012), carbon);
        st.position.z = z;
        strakes.push(st);
      }
      for (const s of [1, -1]) {
        const fence = mesh(plate([[0.72, 0.05], [0.6, 0.2], [0.2, 0.22], [0.2, 0.05]], 0.012), carbon);
        fence.position.z = s * 0.72;
        strakes.push(fence);
      }
      this.add("floor", [0, -0.42, 0], floor, ramp, ...strakes);
      this.anchor("floor", [-0.4, 0.06, 0.8], [0, -0.42, 0]);
    }

    // ---- power unit (inside the engine cover; shown when the car comes apart)
    {
      const metal = this.mat("metal", "power");
      const carbon = this.mat("carbon", "power");
      const accent = this.mat("accent", "power");
      const block = mesh(new THREE.BoxGeometry(0.62, 0.2, 0.26), metal);
      block.position.set(-0.75, 0.32, 0);
      const pu = this.powerUnit;
      pu.add(block);
      for (const s of [1, -1]) {
        for (let i = 0; i < 3; i++) {
          const cyl = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 16), metal);
          cyl.position.set(-0.55 - i * 0.18, 0.47, s * 0.09);
          cyl.rotation.x = s * 0.55;
          pu.add(cyl);
        }
      }
      const turbo = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 20), metal);
      turbo.rotation.z = Math.PI / 2;
      turbo.position.set(-0.36, 0.36, 0);
      const mguk = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20), accent);
      mguk.position.set(-0.98, 0.25, 0.17);
      mguk.rotation.x = Math.PI / 2;
      const battery = mesh(new THREE.BoxGeometry(0.42, 0.08, 0.38), accent);
      battery.position.set(-0.05, 0.16, 0);
      const gearbox = mesh(
        loft([
          { x: -1.05, w: 0.14, t: 0.1, b: 0.1, y: 0.3 },
          { x: -1.6, w: 0.1, t: 0.08, b: 0.08, y: 0.28 },
          { x: -2.05, w: 0.06, t: 0.06, b: 0.05, y: 0.3 },
        ]),
        carbon,
      );
      pu.add(turbo, mguk, battery, gearbox);
      pu.visible = false;

      // engine cover and airbox: lift off together
      const body = this.mat("body", "power");
      const voidM = this.mat("void", "power");
      const cover = mesh(
        loft([
          { x: 0.0, w: 0.33, t: 0.24, b: 0.3, y: 0.44 },
          { x: -0.55, w: 0.31, t: 0.21, b: 0.28, y: 0.43 },
          { x: -1.15, w: 0.21, t: 0.14, b: 0.2, y: 0.39 },
          { x: -1.75, w: 0.12, t: 0.1, b: 0.12, y: 0.36 },
          { x: -2.08, w: 0.05, t: 0.05, b: 0.05, y: 0.34 },
        ]),
        body,
      );
      const airbox = mesh(
        loft([
          { x: 0.03, w: 0.1, t: 0.06, b: 0.06, y: 0.82, n: 2.2 },
          { x: -0.12, w: 0.13, t: 0.12, b: 0.1, y: 0.83 },
          { x: -0.5, w: 0.11, t: 0.12, b: 0.14, y: 0.73 },
          { x: -1.0, w: 0.06, t: 0.07, b: 0.1, y: 0.62 },
          { x: -1.5, w: 0.02, t: 0.02, b: 0.04, y: 0.54 },
        ]),
        body,
      );
      const intake = mesh(new THREE.CircleGeometry(1, 32), voidM);
      intake.scale.set(0.09, 0.065, 1);
      intake.rotation.y = Math.PI / 2;
      intake.position.set(0.035, 0.83, 0);
      const coverGroup = this.add("power", [-0.1, 0.78, 0], cover, airbox, intake);
      coverGroup.userData.cover = true;
      this.add("power", [-0.1, 0.18, 0], pu);
      this.anchor("power", [-0.7, 0.62, 0], [-0.1, 0.18, 0]);
    }

    // ---- front wing: main plane, two active flaps, endplates
    {
      const carbon = this.mat("carbon", "frontWing");
      const primary = this.mat("primary", "frontWing");
      const accent = this.mat("accent", "frontWing");
      const span = 1.7;
      const main = mesh(wingGeometry(0.34, span, 0.09, 0.05), carbon);
      main.position.set(2.86, 0.085, 0);
      main.rotation.z = -0.06;
      const parts: THREE.Object3D[] = [main];
      const flapDefs = [
        { x: 2.56, y: 0.12, chord: 0.2, corner: 0.36, straight: 0.1, mat: primary },
        { x: 2.42, y: 0.19, chord: 0.15, corner: 0.62, straight: 0.2, mat: accent },
      ];
      for (const f of flapDefs) {
        const pivot = new THREE.Group();
        pivot.position.set(f.x, f.y, 0);
        pivot.add(mesh(wingGeometry(f.chord, span - 0.06, 0.1, 0.07), f.mat));
        parts.push(pivot);
        this.flaps.push({ obj: pivot, corner: -f.corner, straight: -f.straight });
      }
      for (const s of [1, -1]) {
        const ep = mesh(plate([[2.9, 0.03], [2.9, 0.16], [2.62, 0.31], [2.26, 0.31], [2.26, 0.03]], 0.014), carbon);
        ep.position.z = (s * span) / 2;
        parts.push(ep);
      }
      this.add("frontWing", [0.62, -0.02, 0], ...parts);
      this.anchor("frontWing", [2.6, 0.3, 0.85], [0.62, -0.02, 0]);
    }

    // ---- rear wing: main plane, active flap, endplates, swan-neck pylon
    {
      const carbon = this.mat("carbon", "rearWing");
      const primary = this.mat("primary", "rearWing");
      const span = 0.98;
      const main = mesh(wingGeometry(0.3, span, 0.11, 0.07), carbon);
      main.position.set(-1.98, 0.78, 0);
      main.rotation.z = -0.16;
      const flap = new THREE.Group();
      flap.position.set(-2.2, 0.87, 0);
      flap.add(mesh(wingGeometry(0.24, span - 0.02, 0.1, 0.06), primary));
      this.flaps.push({ obj: flap, corner: -0.78, straight: -0.12 });
      const parts: THREE.Object3D[] = [main, flap];
      for (const s of [1, -1]) {
        const ep = mesh(plate([[-1.92, 0.42], [-1.9, 1.02], [-2.48, 1.02], [-2.5, 0.58], [-2.2, 0.42]], 0.016), primary);
        ep.position.z = (s * (span + 0.02)) / 2;
        parts.push(ep);
      }
      const pylon = mesh(plate([[-2.0, 0.34], [-2.12, 0.34], [-2.2, 0.82], [-2.12, 0.86]], 0.02), carbon);
      const crash = mesh(
        loft([
          { x: -1.95, w: 0.07, t: 0.07, b: 0.06, y: 0.33 },
          { x: -2.35, w: 0.05, t: 0.05, b: 0.04, y: 0.33 },
        ]),
        carbon,
      );
      const light = mesh(new THREE.BoxGeometry(0.02, 0.05, 0.1), this.mat("void", "rearWing"));
      light.position.set(-2.36, 0.33, 0);
      parts.push(pylon, crash, light);
      this.add("rearWing", [-0.6, 0.3, 0], ...parts);
      this.anchor("rearWing", [-2.2, 1.06, 0.5], [-0.6, 0.3, 0]);
    }

    // ---- wheels and suspension
    {
      const corners = [
        { x: 1.7, z: 0.8, w: 0.28, front: true },
        { x: 1.7, z: -0.8, w: 0.28, front: true },
        { x: -1.7, z: 0.76, w: 0.375, front: false },
        { x: -1.7, z: -0.76, w: 0.375, front: false },
      ];
      const tyre = this.mat("tyre", "wheels");
      const rim = this.mat("rim", "wheels");
      const stripe = this.mat("stripe", "wheels");
      const cover = this.mat("carbon", "wheels");
      const susp = this.mat("carbon", "suspension");
      const tyreGeo = { f: tyreGeometry(0.28), r: tyreGeometry(0.375) };
      for (const c of corners) {
        const s = Math.sign(c.z);
        const g: THREE.Object3D[] = [];
        g.push(mesh(c.front ? tyreGeo.f : tyreGeo.r, tyre));
        const hub = mesh(new THREE.CylinderGeometry(0.229, 0.229, c.w * 0.9, 40, 1, true), rim);
        hub.rotation.x = Math.PI / 2;
        g.push(hub);
        for (const side of [1, -1]) {
          const disc = mesh(new THREE.CircleGeometry(0.229, 40), cover);
          disc.position.z = side * c.w * 0.45;
          g.push(disc);
          const band = mesh(new THREE.TorusGeometry(0.305, 0.006, 6, 72), stripe);
          band.position.z = side * (c.w / 2 - 0.004);
          g.push(band);
        }
        const wheel = new THREE.Group();
        wheel.add(...g);
        wheel.position.set(c.x, 0.36, c.z);
        this.add("wheels", [c.front ? 0.35 : -0.35, 0, s * 0.7], wheel);

        // wishbones from the tub (or gearbox) to the upright
        const inX = c.front ? 1.6 : -1.65;
        const inZ = c.front ? 0.2 : 0.14;
        const out = new THREE.Vector3(c.x, 0, c.z - s * c.w * 0.4);
        const arms = [
          rod(new THREE.Vector3(inX + 0.18, 0.48, s * inZ), out.clone().setY(0.5), 0.011, susp),
          rod(new THREE.Vector3(inX - 0.2, 0.46, s * inZ), out.clone().setY(0.5), 0.011, susp),
          rod(new THREE.Vector3(inX + 0.22, 0.24, s * inZ), out.clone().setY(0.22), 0.011, susp),
          rod(new THREE.Vector3(inX - 0.24, 0.24, s * inZ), out.clone().setY(0.22), 0.011, susp),
          rod(new THREE.Vector3(inX, 0.58, s * (inZ - 0.04)), out.clone().setY(0.24), 0.009, susp),
        ];
        const sg = this.add("suspension", [0, 0, 0], ...arms);
        this.suspension.push(sg);
      }
      this.anchor("wheels", [1.7, 0.78, 0.95], [0.35, 0, 0.7]);
    }
  }

  setColors(c: Colors) {
    this.colors = c;
    const ctx = this.livery.getContext("2d")!;
    paintLivery(ctx, c);
    this.liveryTex.needsUpdate = true;
    for (const r of this.mats) {
      if (r.role === "primary") r.mat.color.set(c.body);
      if (r.role === "accent") r.mat.color.set(c.accent);
    }
  }

  /** 0 = corner mode (flaps closed, high downforce), 1 = straight-line mode (flaps open). */
  setAero(m: number) {
    for (const f of this.flaps) f.obj.rotation.z = f.corner + (f.straight - f.corner) * m;
  }

  setExplode(e: number) {
    for (const x of this.explodables) {
      x.obj.position.copy(x.base).addScaledVector(x.off, e);
    }
    this.powerUnit.visible = e > 0.04;
    for (const s of this.suspension) s.visible = e < 0.06;
  }

  /** Fade every part but `focus` (null restores all). */
  setFocus(focus: PartKey | null) {
    for (const r of this.mats) {
      const dim = focus !== null && r.part !== focus;
      r.mat.transparent = dim;
      r.mat.opacity = dim ? 0.13 : 1;
      r.mat.depthWrite = !dim;
      r.mat.needsUpdate = true;
    }
  }
}
