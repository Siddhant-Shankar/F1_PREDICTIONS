// Side elevation of a 2026-regulation car, drawn as a technical line drawing.
// Coordinates are in metres (x: rear wing to nose, y: up from the ground) and mapped onto the SVG.
// Proportions follow the FIA's 2026 headline numbers: 3.4 m wheelbase, 18-inch wheels.

type Pt = [number, number];

const X = (x: number) => 64 + (x + 2.55) * 100;
const Y = (y: number) => 168 - y * 100;
const p = ([x, y]: Pt) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
const poly = (pts: Pt[], close = false) => `M${pts.map(p).join("L")}${close ? "Z" : ""}`;

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: Pt[]): string {
  const P = pts.map(([x, y]) => [X(x), Y(y)]);
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(i - 1, 0)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(i + 2, P.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map((v) => v.toFixed(1)).join(" ")} ${c2.map((v) => v.toFixed(1)).join(" ")} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function wheel(cx: number, label: string) {
  const [x, y] = [X(cx), Y(0.36)];
  return `<g class="wheel" aria-label="${label}">
    <circle class="tyre" cx="${x}" cy="${y}" r="36"/>
    <circle class="band" cx="${x}" cy="${y}" r="30.5"/>
    <circle class="rim" cx="${x}" cy="${y}" r="22.9"/>
    <circle class="hub" cx="${x}" cy="${y}" r="4"/>
  </g>`;
}

/** A callout: dot on the car, elbow leader, label. */
function note(at: Pt, to: Pt, lines: string[], anchor: "start" | "end" = "start") {
  const [ax, ay] = [X(at[0]), Y(at[1])];
  const [tx, ty] = [X(to[0]), Y(to[1])];
  const run = anchor === "start" ? 34 : -34;
  return `<g class="anno">
    <circle cx="${ax}" cy="${ay}" r="2.2"/>
    <path d="M${ax} ${ay}L${tx} ${ty}h${run}"/>
    ${lines
      .map((l, i) => `<text x="${tx + run + (anchor === "start" ? 6 : -6)}" y="${ty + 4 + i * 14}" text-anchor="${anchor}"${i ? ' class="sub"' : ""}>${l}</text>`)
      .join("")}
  </g>`;
}

/** `compact` crops to the car alone (no callouts) so it stays legible on a phone. */
export function carDrawing(compact = false): string {
  // upper line of the body, nose tip back to the rear crash structure
  const top = smooth([
    [2.78, 0.18], [2.6, 0.26], [2.2, 0.37], [1.8, 0.47], [1.5, 0.55], [1.15, 0.61], [0.95, 0.64],
  ]);
  const cover = smooth([
    [0.06, 0.63], [0.02, 0.79], [-0.12, 0.95], [-0.32, 0.95], [-0.62, 0.85], [-1.0, 0.71], [-1.4, 0.6],
    [-1.8, 0.49], [-2.06, 0.42], [-2.2, 0.39],
  ]);
  // tub underside, from the floor's leading edge forward to the nose tip
  const under = smooth([[1.48, 0.22], [2.0, 0.18], [2.5, 0.15], [2.78, 0.16]]);
  const tail = (d: string) => d.replace(/^M[^C]+/, "");
  const body =
    `${top}L${p([0.06, 0.63])}${tail(cover)}L${p([-2.38, 0.38])}L${p([-2.38, 0.29])}L${p([-2.2, 0.3])}` +
    `L${p([-1.38, 0.05])}L${p([1.42, 0.05])}L${p([1.48, 0.22])}${tail(under)}Z`;
  const sidepod = smooth([[0.72, 0.5], [0.45, 0.5], [0.0, 0.44], [-0.6, 0.33], [-1.25, 0.21], [-1.38, 0.12]]);
  const inlet = poly([[0.72, 0.5], [0.72, 0.29], [0.66, 0.27]]);
  const halo = `M${p([0.98, 0.63])}Q${p([0.92, 0.83])} ${p([0.72, 0.83])}L${p([0.16, 0.79])}Q${p([0.02, 0.77])} ${p([0.0, 0.64])}`;
  const frontEndplate = poly([[2.26, 0.03], [2.26, 0.31], [2.62, 0.31], [2.9, 0.16], [2.9, 0.03]], true);
  const rearEndplate = poly([[-1.92, 0.42], [-1.9, 1.02], [-2.48, 1.02], [-2.5, 0.58], [-2.2, 0.42]], true);
  const elements = [
    smooth([[2.86, 0.09], [2.7, 0.085], [2.52, 0.11]]),
    smooth([[2.56, 0.12], [2.46, 0.14], [2.37, 0.19]]),
    smooth([[2.42, 0.19], [2.35, 0.22], [2.3, 0.28]]),
    smooth([[-1.98, 0.78], [-2.12, 0.79], [-2.27, 0.83]]),
    smooth([[-2.2, 0.87], [-2.29, 0.93], [-2.37, 1.04]]),
  ];
  const pylon = poly([[-2.0, 0.38], [-2.08, 0.6], [-2.12, 0.8]]);
  const mirror = `M${p([0.66, 0.73])}h-7v-5h7z M${p([0.62, 0.66])}L${p([0.63, 0.7])}`;
  const floorEdge = poly([[1.3, 0.075], [-1.3, 0.075]]);
  const ground = `M${X(-2.75)} ${Y(0)}H${X(3.1)}`;
  const wb = Y(-0.24);

  return `<svg class="car" viewBox="${compact ? "36 50 590 166" : "0 0 790 222"}" role="img" aria-labelledby="car-title car-desc">
    <title id="car-title">Side elevation of a 2026 Formula 1 car</title>
    <desc id="car-desc">Line drawing with callouts: active front and rear wings, a power unit with a 350 kW electric motor and no MGU-H, a partly flat floor, 18-inch wheels and a 3,400 mm wheelbase.</desc>
    <path class="ground" d="${ground}"/>
    <path class="body" d="${body}"/>
    <path class="line pod" d="${sidepod}"/>
    <path class="line" d="${inlet}"/>
    <path class="line thin" d="${floorEdge}"/>
    <circle class="helmet" cx="${X(0.36)}" cy="${Y(0.71)}" r="11.5"/>
    <path class="visor" d="M${X(0.42)} ${Y(0.74)}a11.5 11.5 0 0 1 4 -7"/>
    <path class="halo" d="${halo}"/>
    <path class="line" d="${mirror}"/>
    <path class="line" d="${pylon}"/>
    ${elements.map((d) => `<path class="hidden" d="${d}"/>`).join("")}
    <path class="plate" d="${frontEndplate}"/>
    <path class="plate" d="${rearEndplate}"/>
    ${wheel(-1.7, "Rear wheel")}
    ${wheel(1.7, "Front wheel")}
    <g class="dim">
      <path d="M${X(-1.7)} ${Y(0.02)}V${wb + 6}M${X(1.7)} ${Y(0.02)}V${wb + 6}"/>
      <path class="arrow" d="M${X(-1.7)} ${wb}H${X(1.7)}M${X(-1.7) + 7} ${wb - 4}L${X(-1.7)} ${wb}L${X(-1.7) + 7} ${wb + 4}M${X(1.7) - 7} ${wb - 4}L${X(1.7)} ${wb}L${X(1.7) - 7} ${wb + 4}"/>
      <rect x="${X(0) - 70}" y="${wb - 9}" width="140" height="18"/>
      <text x="${X(0)}" y="${wb + 4}" text-anchor="middle">3,400 mm wheelbase</text>
    </g>
    ${compact ? "" : `${note([2.62, 0.31], [2.55, 0.98], ["Active front wing", "flaps open on the straights"])}
    ${note([1.95, 0.62], [1.6, 1.36], ["18-inch wheels", "tyres 25 / 30 mm narrower"])}
    ${note([-0.5, 0.88], [-0.15, 1.36], ["1.6 L V6, 350 kW electric", "MGU-H gone"])}
    ${note([-2.2, 1.02], [-2.0, 1.36], ["Active rear wing", "replaces DRS"])}`}
  </svg>`;
}
