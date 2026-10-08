// The 3D circuit: track ribbon with real elevation, and one glowing marker per car.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Car, Replay } from "./types";

export type CameraPreset = "orbit" | "top" | "side";
export type ColorMode = "team" | "prob";

const BG = 0x0d0f12;
const FORECAST = 0xb47cff;

interface CarMesh {
  car: Car;
  group: THREE.Group;
  dot: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Sprite;
  label: THREE.Sprite;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export const LABEL_FONT = "700 26px 'Hubot Sans Variable', 'Arial Narrow', sans-serif";

function labelTexture(text: string, color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 48;
  const x = c.getContext("2d")!;
  x.fillStyle = "rgba(11,13,16,.85)";
  x.fillRect(0, 6, 128, 36);
  x.fillStyle = color;
  x.fillRect(0, 6, 6, 36);
  x.fillStyle = "#e9ebee";
  x.font = LABEL_FONT;
  x.textBaseline = "middle";
  x.fillText(text, 16, 25);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

export class TrackScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 10, 30000);
  private controls: OrbitControls;
  private ground = new THREE.GridHelper(6000, 60, 0x1c2027, 0x161a20);
  private trackGroup = new THREE.Group();
  private cars: CarMesh[] = [];
  private glowTex = glowTexture();
  private ray = new THREE.Raycaster();
  private replay: Replay | null = null;
  private radius = 1000; // half the circuit's extent, for camera framing
  exag = 4;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(BG, 1);
    this.scene.fog = new THREE.Fog(BG, 3200, 9000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.scene.add(this.ground, this.trackGroup);
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
  }

  // FastF1 X/Y are the ground plane and Z is height; three.js is y-up.
  private toV(x: number, y: number, z: number) {
    return new THREE.Vector3(x, z * this.exag, -y);
  }

  setReplay(replay: Replay) {
    this.replay = replay;
    const xs = replay.track.map((p) => p[0]);
    const ys = replay.track.map((p) => p[1]);
    this.radius = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
    // Camera, fog and marker sizes all scale with the circuit, so Monza and
    // Hungary frame the same way. k = 1 is a Suzuka-sized track.
    const k = Math.min(Math.max(this.radius / 1000, 0.6), 1.2);
    this.controls.minDistance = this.radius * 0.6;
    this.controls.maxDistance = this.radius * 8;
    this.scene.fog = new THREE.Fog(BG, this.radius * 3.2, this.radius * 7.5);
    for (const m of this.cars) this.scene.remove(m.group);
    this.cars = replay.cars.map((car) => {
      const group = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(13, 16, 12),
        new THREE.MeshBasicMaterial({ color: car.color }),
      );
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: car.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.scale.set(110 * k, 110 * k, 1);
      dot.scale.setScalar(k);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture(car.code, car.color), transparent: true, depthTest: false }),
      );
      label.scale.set(150 * k, 56 * k, 1);
      label.position.y = 70 * k;
      label.visible = false;
      group.add(glow, dot, label);
      group.userData.car = car;
      this.scene.add(group);
      return { car, group, dot, glow, label };
    });
    this.buildTrack();
  }

  setExaggeration(exag: number) {
    this.exag = exag;
    this.buildTrack();
  }

  private buildTrack() {
    if (!this.replay) return;
    this.scene.remove(this.trackGroup);
    this.trackGroup.traverse((o) => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
    const g = new THREE.Group();
    const P = this.replay.track;
    const pts = P.map((p) => this.toV(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    const minZ = Math.min(...P.map((p) => p[2]));
    const base = minZ * this.exag - 2;

    // tarmac ribbon
    const N = 1400;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPointAt(t);
      const tg = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(15);
      pos.push(p.x + side.x, p.y + 0.5, p.z + side.z, p.x - side.x, p.y + 0.5, p.z - side.z);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    ribbon.setIndex(idx);
    g.add(new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ color: 0x3a404b, side: THREE.DoubleSide })));

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(N)),
      new THREE.LineBasicMaterial({ color: 0x8b93a1, transparent: true, opacity: 0.55 }),
    );
    line.position.y = 1.2;
    g.add(line);

    // elevation curtain down to the lowest point, so height reads at a glance
    const cur: number[] = [];
    for (let i = 0; i < pts.length; i += 4) cur.push(pts[i].x, base, pts[i].z, pts[i].x, pts[i].y, pts[i].z);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(cur, 3));
    g.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: FORECAST, transparent: true, opacity: 0.13 })));
    g.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts.map((v) => new THREE.Vector3(v.x, base, v.z))),
        new THREE.LineBasicMaterial({ color: 0x2a2f38 }),
      ),
    );

    // start/finish gantry
    const sf = pts[0];
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 44), new THREE.MeshBasicMaterial({ color: 0xe9ebee }));
    gantry.position.set(sf.x, sf.y + 20, sf.z);
    gantry.lookAt(pts[3].x, sf.y + 20, pts[3].z);
    g.add(gantry);

    this.ground.position.y = base - 1;
    this.trackGroup = g;
    this.scene.add(g);
  }

  paint(mode: ColorMode, pWin: Record<string, number>) {
    const maxP = Math.max(...Object.values(pWin), 1e-9);
    for (const m of this.cars) {
      const col =
        mode === "team"
          ? new THREE.Color(m.car.color)
          : new THREE.Color(0x2b2f38).lerp(new THREE.Color(FORECAST), Math.sqrt((pWin[m.car.code] ?? 0) / maxP));
      m.dot.material.color = col;
      (m.glow.material as THREE.SpriteMaterial).color = col;
    }
  }

  /** Place cars at a fractional frame; `labelled` drivers get a name tag. */
  place(frame: number, labelled: string[]) {
    if (!this.replay) return;
    const i = Math.floor(frame);
    const t = frame - i;
    const j = Math.min(i + 1, this.replay.frames - 1);
    for (const { car, group, label } of this.cars) {
      group.visible = i < car.until;
      if (!group.visible) continue;
      const x = car.x[i] + (car.x[j] - car.x[i]) * t;
      const y = car.y[i] + (car.y[j] - car.y[i]) * t;
      const z = car.z[i] + (car.z[j] - car.z[i]) * t;
      group.position.copy(this.toV(x, y, z)).add(new THREE.Vector3(0, 14, 0));
      label.visible = labelled.includes(car.code);
    }
  }

  setCamera(preset: CameraPreset) {
    const r = this.radius;
    if (preset === "orbit") this.camera.position.set(r * 1.9, r * 1.5, r * 2.3);
    if (preset === "top") this.camera.position.set(0.01, r * 4.2, 0.01);
    if (preset === "side") this.camera.position.set(0, r * 0.42, r * 3.3);
    this.controls.target.set(0, preset === "side" ? r * 0.14 : 0, 0);
    this.controls.update();
  }

  /** The car under a pointer position, if any. */
  pick(clientX: number, clientY: number): Car | null {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects(
      this.cars.filter((m) => m.group.visible).map((m) => m.glow),
      false,
    )[0];
    return hit ? (hit.object.parent!.userData.car as Car) : null;
  }

  resize() {
    const r = this.canvas.parentElement!.getBoundingClientRect();
    const h = Math.max(r.height, 1);
    this.renderer.setSize(r.width, h, false);
    this.camera.aspect = r.width / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
