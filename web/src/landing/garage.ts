// The interactive 2026 car: orbit it, change the livery, switch the aero mode, pull it apart.
// Loaded on demand when the section nears the viewport, so the landing page stays light.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Airflow } from "./airflow";
import { CarModel } from "./car-model";
import { LIVERIES, PARTS, liveryFor, type Livery, type PartKey } from "./garage-data";

type Theme = "dark" | "light";
const THEMES = {
  dark: { bg: 0x0d0f12, grid: [0x232831, 0x171b21], shadow: 0.7, env: 0.55 },
  light: { bg: 0xf2f3f5, grid: [0xd3d7dd, 0xe3e6ea], shadow: 0.32, env: 0.8 },
} as const;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// strong ease-in-out for the flaps: an on-screen morph, not an entrance
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

function contactShadow(): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 64, 4, 128, 64, 128);
  g.addColorStop(0, "rgba(0,0,0,.9)");
  g.addColorStop(0.45, "rgba(0,0,0,.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 2.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(0.15, 0.003, 0);
  return m;
}

export function mountGarage(root: HTMLElement, team: string) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const stage = canvas.parentElement!;
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    q(".garage-fallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 6, 4);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x222222, 0.35));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0.2, 0.3, 0);
  camera.position.set(6.3, 2.5, 7.3);

  const car = new CarModel();
  const flow = new Airflow();
  const shadow = contactShadow();
  let grid = new THREE.GridHelper(40, 80);
  scene.add(car.root, flow.group, shadow, grid);

  // ---------------------------------------------------------------- theme
  let theme: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  function applyTheme() {
    const t = THEMES[theme];
    renderer.setClearColor(t.bg, 1);
    scene.fog = new THREE.Fog(t.bg, 9, 26);
    scene.environmentIntensity = t.env;
    (shadow.material as THREE.MeshBasicMaterial).opacity = t.shadow;
    scene.remove(grid);
    grid.geometry.dispose();
    grid = new THREE.GridHelper(40, 80, t.grid[0], t.grid[1]);
    scene.add(grid);
    flow.setTheme(theme, new THREE.Color(t.bg));
  }
  applyTheme();
  new MutationObserver(() => {
    const next: Theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    if (next !== theme) {
      theme = next;
      applyTheme();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------------------------------------------------------------- livery
  const swatches = q("#liveries");
  swatches.innerHTML = LIVERIES.map(
    (l) => `<button class="swatch" data-id="${l.id}" aria-pressed="false" title="${l.name}" aria-label="${l.name} livery"
      style="--c:${l.body};--a:${l.accent}"></button>`,
  ).join("");
  function setLivery(l: Livery) {
    car.setColors({ body: l.body, accent: l.accent });
    q("#liveryName").textContent = l.name;
    swatches.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === l.id)));
  }
  swatches.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".swatch");
    if (b) setLivery(LIVERIES.find((l) => l.id === b.dataset.id)!);
  });
  setLivery(liveryFor(team));

  // ---------------------------------------------------------------- aero mode
  let aero = 0;
  let aeroFrom = 0;
  let aeroTo = 0;
  let aeroT0 = 0;
  const AERO_MS = 700;
  function setAeroTarget(to: number) {
    aeroFrom = aero;
    aeroTo = to;
    aeroT0 = performance.now();
    q("#aero-corner").setAttribute("aria-pressed", String(to === 0));
    q("#aero-straight").setAttribute("aria-pressed", String(to === 1));
    q("#aeroNote").textContent =
      to === 0
        ? "Flaps closed: more downforce for the corners, and a wake thrown high behind the car."
        : "Flaps open: drag shed for the straights, and a flatter, cleaner wake.";
    if (reducedMotion) aeroT0 = -AERO_MS;
  }
  q("#aero-corner").onclick = () => setAeroTarget(0);
  q("#aero-straight").onclick = () => setAeroTarget(1);

  // ---------------------------------------------------------------- airflow
  let flowOn = true;
  const flowBtn = q<HTMLButtonElement>("#flowToggle");
  flowBtn.onclick = () => {
    flowOn = !flowOn;
    flow.group.visible = flowOn && explode < 0.05;
    flowBtn.setAttribute("aria-pressed", String(flowOn));
    flowBtn.textContent = flowOn ? "Shown" : "Hidden";
  };

  // ---------------------------------------------------------------- exploded view + labels
  const explodeInput = q<HTMLInputElement>("#explode");
  let explode = 0;
  const labels = q("#partLabels");
  labels.innerHTML = car.anchors
    .map((a) => `<button class="part-label" data-part="${a.part}" tabindex="-1">${PARTS.find((p) => p.key === a.part)!.name}</button>`)
    .join("");
  const labelEls = [...labels.querySelectorAll<HTMLButtonElement>(".part-label")];
  explodeInput.addEventListener("input", () => {
    explode = Number(explodeInput.value) / 100;
    car.setExplode(explode);
    // the airflow describes the assembled car; it makes no sense around loose parts
    flow.group.visible = flowOn && explode < 0.05;
  });

  // ---------------------------------------------------------------- parts: hover, select, list
  let hover: PartKey | null = null;
  let selected: PartKey | null = null;
  const partList = q("#partList");
  partList.innerHTML = PARTS.map((p) => `<li><button data-part="${p.key}" aria-pressed="false">${p.name}</button></li>`).join("");
  function showPart() {
    const k = hover ?? selected;
    car.setFocus(k);
    const p = PARTS.find((x) => x.key === k);
    q("#partName").textContent = p ? p.name : "Parts";
    q("#partNote").textContent = p ? p.note : "Hover a part on the car, or pick one here, to read what the 2026 rules changed.";
    partList.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === selected)));
  }
  const select = (k: PartKey | null) => {
    selected = selected === k ? null : k;
    showPart();
  };
  partList.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b) select(b.dataset.part as PartKey);
  });
  partList.addEventListener("pointerover", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    hover = b ? (b.dataset.part as PartKey) : null;
    showPart();
  });
  partList.addEventListener("pointerleave", () => {
    hover = null;
    showPart();
  });
  labels.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".part-label");
    if (b) select(b.dataset.part as PartKey);
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function partAt(cx: number, cy: number): PartKey | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(car.pickables, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.part) o = o.parent;
    return (o?.userData.part as PartKey) ?? null;
  }
  const tip = q("#garageTip");
  let down: [number, number] | null = null;
  canvas.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  canvas.addEventListener("pointerup", (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) select(partAt(e.clientX, e.clientY));
    down = null;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    const k = partAt(e.clientX, e.clientY);
    if (k !== hover) {
      hover = k;
      showPart();
    }
    const r = stage.getBoundingClientRect();
    tip.hidden = !k;
    if (k) {
      tip.textContent = PARTS.find((p) => p.key === k)!.name;
      tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top - 10}px)`;
    }
    canvas.style.cursor = k ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", () => {
    tip.hidden = true;
    if (hover) {
      hover = null;
      showPart();
    }
  });
  showPart();

  // ---------------------------------------------------------------- size, visibility, loop
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(r.width, 1);
    const h = Math.max(r.height, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // pull back on tall, narrow stages so the whole car fits
    camera.fov = w / h < 1.45 ? 30 * Math.min(1.45 / (w / h), 1.9) : 30;
    camera.updateProjectionMatrix();
    // a resize clears the canvas; redraw now rather than wait for the next visible frame
    renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "120px 0px" }).observe(stage);

  const v = new THREE.Vector3();
  let prev = performance.now();
  flow.update(0);
  function tick(now: number) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (!visible || document.hidden) return;
    const t = Math.min((now - aeroT0) / AERO_MS, 1);
    const next = aeroFrom + (aeroTo - aeroFrom) * easeInOut(t);
    if (next !== aero) {
      aero = next;
      car.setAero(aero);
      flow.setMix(aero);
    }
    if (flow.group.visible && !reducedMotion) flow.update(dt);
    controls.update();
    renderer.render(scene, camera);

    // part labels follow their parts once the car is apart
    const show = smooth(0.35, 0.6, explode);
    labels.style.opacity = String(show);
    labels.style.pointerEvents = show > 0.5 ? "auto" : "none";
    const r = stage.getBoundingClientRect();
    car.anchors.forEach((a, i) => {
      v.copy(a.local).addScaledVector(a.off, explode).project(camera);
      labelEls[i].style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px) translate(-50%, -100%)`;
      labelEls[i].tabIndex = show > 0.5 ? 0 : -1;
    });
  }
  car.setAero(0);
  setAeroTarget(0);
  requestAnimationFrame(tick);
}
