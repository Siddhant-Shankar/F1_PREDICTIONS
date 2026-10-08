import "@fontsource-variable/hubot-sans/wdth.css";
import "@fontsource-variable/mona-sans/wdth.css";
import "@fontsource/monaspace-neon/400.css";
import "@fontsource/monaspace-neon/600.css";
import "./style.css";
import { LABEL_FONT, TrackScene, type CameraPreset } from "./scene";
import type { RaceForecast, Replay, SeasonForecasts } from "./types";

const DATA = `${import.meta.env.BASE_URL}data`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const shortName = (e: string) => e.replace(" Grand Prix", "").replace(" in Malaysia", " (Sepang)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pad = (n: number) => String(n).padStart(2, "0");

const state = {
  season: null as SeasonForecasts | null,
  race: null as RaceForecast | null,
  replay: null as Replay | null,
  frame: 0,
  playing: false,
  speed: 30,
  colorMode: "team" as "team" | "prob",
  tab: "fc" as "fc" | "live",
  lastLap: -1,
};
const replayCache = new Map<number, Promise<Replay>>();
const teamColor: Record<string, string> = {};
const colorOf = (d: string) => teamColor[d] ?? "#7a808a";

const scene = new TrackScene($<HTMLCanvasElement>("#scene"));

// ------------------------------------------------------------------ data
async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function loadReplay(round: number): Promise<Replay> {
  if (!replayCache.has(round)) {
    replayCache.set(round, getJSON<Replay>(`races/${state.season!.season}-${pad(round)}.json`));
  }
  return replayCache.get(round)!;
}

// ------------------------------------------------------------------ header + rail
/** Small SVG of the circuit layout, fitted into the card while keeping its shape. */
function outlineSVG(outline: [number, number][] | null): string {
  if (!outline) return `<svg class="outline" viewBox="0 0 120 44" aria-hidden="true"></svg>`;
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(116 / (x1 - x0), 40 / (y1 - y0));
  const ox = (120 - (x1 - x0) * scale) / 2;
  const oy = (44 - (y1 - y0) * scale) / 2;
  const d = outline
    .map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - x0) * scale).toFixed(1)} ${(oy + (y1 - y) * scale).toFixed(1)}`)
    .join("");
  return `<svg class="outline" viewBox="0 0 120 44" aria-hidden="true"><path d="${d}Z"/></svg>`;
}

function renderHeader(races: RaceForecast[]) {
  const hits = races.filter((r) => r.winner_hit).length;
  const podium = races.reduce((a, r) => a + r.podium_hits, 0);
  const rho = races.reduce((a, r) => a + r.spearman, 0) / races.length;
  $("#seasonStats").innerHTML = `
    <div class="stat"><span class="label">Races</span><b>${races.length}</b></div>
    <div class="stat"><span class="label">Favourite won</span><b><em>${hits}</em>/${races.length}</b></div>
    <div class="stat"><span class="label">Podium picks</span><b>${podium}/${races.length * 3}</b></div>
    <div class="stat"><span class="label">Rank corr.</span><b>${rho.toFixed(3)}</b></div>`;

  $("#rail").innerHTML = races
    .map((r) => {
      const fav = r.rows[0];
      const win = r.rows.find((x) => x.finish === 1)!;
      return `<button class="chip" data-round="${r.round}" aria-pressed="false">
        <span class="rd"><span>R${pad(r.round)}</span>${r.replay ? '<span class="has3d label">3D</span>' : ""}</span>
        ${outlineSVG(r.outline)}
        <span class="nm" title="${r.event}">${shortName(r.event)}</span>
        <span class="pw"><span class="f">◆ ${fav.driver}</span><span>● ${win.driver}</span>
          <span class="hit ${r.winner_hit ? "y" : "n"}">${r.winner_hit ? "HIT" : "MISS"}</span></span>
      </button>`;
    })
    .join("");
}

$("#rail").addEventListener("click", (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>(".chip");
  if (chip) void selectRace(Number(chip.dataset.round));
});

// ------------------------------------------------------------------ summary
function renderSummary() {
  const r = state.race!;
  const fav = r.rows[0];
  const win = r.rows.find((x) => x.finish === 1)!;
  $("#summary").innerHTML = `
    <div><div class="label">Round ${r.round} · ${state.season!.season}</div><h2>${r.event}</h2></div>
    <div class="kv">
      <div><span class="label">Model favourite</span><strong class="f">${fav.driver} ${pct(fav.p_win)}</strong><small>to win, from grid P${fav.grid}</small></div>
      <div><span class="label">Winner</span><strong>${win.driver}</strong><small>model gave ${pct(win.p_win, 1)} ·
        <span style="color:${r.winner_hit ? "var(--good)" : "var(--miss)"}">${r.winner_hit ? "favourite won" : "upset"}</span></small></div>
      <div><span class="label">Podium picked</span><strong>${r.podium_hits}/3</strong></div>
      <div><span class="label">Rank correlation</span><strong>${r.spearman.toFixed(3)}</strong><small>1.000 = exact finishing order</small></div>
    </div>
    <div class="lapbox">${
      r.replay
        ? `<span class="label">Replay</span><strong id="lapBig">GRID</strong><small class="dim">real car positions from the timing feed</small>`
        : `<span class="label">Replay</span><small class="dim">No car positions in the timing feed for this race.</small>`
    }</div>`;
}

// ------------------------------------------------------------------ timing tower
function currentLap(): number {
  if (!state.replay) return 0;
  let n = 0;
  for (const s of state.replay.lap_starts) if (state.frame >= s) n++;
  return Math.min(n, state.replay.total_laps);
}

/** Order at the end of the last completed lap; the grid before lap 1 ends. */
function runningOrder(): string[] {
  const rp = state.replay!;
  const lap = currentLap();
  const done = state.frame >= rp.frames - 2 ? rp.total_laps : lap - 1;
  return done >= 1 && rp.order[done]
    ? rp.order[done]
    : [...rp.cars].sort((a, b) => a.grid - b.grid).map((c) => c.code);
}

function delta(d: number) {
  const cls = d > 0 ? "up" : d < 0 ? "dn" : "eq";
  return `<span class="delta ${cls}">${d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "="}</span>`;
}

function renderTower() {
  const r = state.race!;
  const live = state.tab === "live" && !!state.replay;
  $<HTMLButtonElement>("#tab-live").disabled = !r.replay;
  $("#tab-fc").setAttribute("aria-selected", String(!live));
  $("#tab-live").setAttribute("aria-selected", String(live));
  const pred: Record<string, number> = {};
  r.rows.forEach((x, i) => (pred[x.driver] = i + 1));
  const byDriver = Object.fromEntries(r.rows.map((x) => [x.driver, x]));
  const maxW = Math.max(...r.rows.map((x) => x.p_win));
  const bar = (w: number) =>
    `<span class="bar"><s><u style="width:${(w / maxW) * 100}%"></u></s><span>${pct(w, w < 0.1 ? 1 : 0)}</span></span>`;
  const drv = (d: string, dim = false) =>
    `<td class="drv${dim ? " dim" : ""}"><i style="background:${colorOf(d)}"></i>${d}</td>`;

  if (!live) {
    $("#tower").innerHTML =
      `<thead><tr><th>Pred</th><th>Driver</th><th>P(win)</th><th>Podium</th><th>Grid</th><th>Result</th></tr></thead><tbody>` +
      r.rows
        .map(
          (x, i) => `<tr class="${x.finish === 1 ? "hl" : ""}"><td class="dim">${i + 1}</td>${drv(x.driver)}
          <td>${bar(x.p_win)}</td><td>${pct(x.p_podium)}</td><td class="dim">${x.grid}</td>
          <td>${x.finish} ${delta(i + 1 - x.finish)}</td></tr>`,
        )
        .join("") +
      "</tbody>";
    return;
  }
  const order = runningOrder();
  const out = state.replay!.cars.filter((c) => !order.includes(c.code));
  $("#tower").innerHTML =
    `<thead><tr><th>Pos</th><th>Driver</th><th>P(win)</th><th>Pred</th><th>vs pred</th></tr></thead><tbody>` +
    order
      .map(
        (d, i) => `<tr><td>${i + 1}</td>${drv(d)}<td>${byDriver[d] ? bar(byDriver[d].p_win) : ""}</td>
        <td class="dim">${pred[d] ?? "–"}</td><td>${pred[d] ? delta(pred[d] - (i + 1)) : ""}</td></tr>`,
      )
      .join("") +
    out
      .map((c) => `<tr><td class="dim">OUT</td>${drv(c.code, true)}<td></td><td class="dim">${pred[c.code] ?? "–"}</td><td></td></tr>`)
      .join("") +
    "</tbody>";
}

$("#tab-fc").onclick = () => {
  state.tab = "fc";
  renderTower();
};
$("#tab-live").onclick = () => {
  state.tab = "live";
  renderTower();
};

// ------------------------------------------------------------------ 3D + replay
function pWin(): Record<string, number> {
  return Object.fromEntries(state.race!.rows.map((x) => [x.driver, x.p_win]));
}

function renderLegend() {
  const top = state.race!.rows.slice(0, 3).map((x) => `${x.driver} ${pct(x.p_win)}`).join(" · ");
  $("#legend").innerHTML =
    state.colorMode === "team"
      ? `<span><i style="background:#8b93a1"></i>racing line</span><span><i style="background:var(--forecast);opacity:.5"></i>elevation, ×${scene.exag}</span><span>cars in team colours</span>`
      : `<span><i class="ramp"></i>model's P(win), low → high</span><span>${top}</span>`;
}

function placeCars() {
  if (!state.replay) return;
  scene.place(state.frame, runningOrder().slice(0, 3));
}

function updateLapUI(force = false) {
  const rp = state.replay;
  if (!rp) {
    $("#lapread").innerHTML = "LAP <b>–</b>";
    return;
  }
  $<HTMLInputElement>("#scrub").value = String(Math.round((state.frame / (rp.frames - 1)) * 1000));
  const lap = currentLap();
  if (lap === state.lastLap && !force) return;
  state.lastLap = lap;
  $("#lapread").innerHTML = `LAP <b>${lap}</b>/${rp.total_laps}`;
  const big = document.getElementById("lapBig");
  if (big) big.textContent = lap === 0 ? "GRID" : `LAP ${lap}`;
  if (state.tab === "live") renderTower();
}

function setPlaying(on: boolean) {
  state.playing = on && !!state.replay;
  $("#play").setAttribute("aria-label", state.playing ? "Pause replay" : "Play replay");
  $("#playIcon").innerHTML = state.playing ? '<path d="M2 1h4v12H2zM8 1h4v12H8z"/>' : '<path d="M2 1l11 6-11 6z"/>';
  if (state.playing && state.tab !== "live") {
    state.tab = "live";
    renderTower();
  }
}

function overlay(html: string | null) {
  const el = $("#overlay");
  el.hidden = html === null;
  if (html !== null) el.innerHTML = `<div>${html}</div>`;
}

async function selectRace(round: number) {
  const race = state.season!.races.find((r) => r.round === round);
  if (!race) return;
  state.race = race;
  state.replay = null;
  state.lastLap = -1;
  setPlaying(false);
  document.querySelectorAll<HTMLElement>(".chip").forEach((c) => {
    const on = Number(c.dataset.round) === round;
    c.setAttribute("aria-pressed", String(on));
    if (on) c.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  // shareable link to this race, e.g. .../F1_PREDICTIONS/#r03
  if (location.hash !== `#r${pad(round)}`) history.replaceState(null, "", `#r${pad(round)}`);
  $<HTMLButtonElement>("#play").disabled = true;
  $<HTMLInputElement>("#scrub").disabled = true;
  renderSummary();
  renderTower();
  renderLegend();
  updateLapUI(true);

  if (!race.replay) {
    const withReplay = state.season!.races.filter((r) => r.replay).map((r) => r.round);
    overlay(
      `<div class="label">3D replay</div><p>The timing feed has no car positions for this race, so there is no replay. The forecast is on the right.</p>` +
        (withReplay.length ? `<button class="btn" id="goReplay">Open R${pad(withReplay[withReplay.length - 1])} replay</button>` : ""),
    );
    document.getElementById("goReplay")?.addEventListener("click", () => void selectRace(withReplay[withReplay.length - 1]));
    return;
  }

  overlay(`<div class="spinner"></div><div class="label">Loading ${shortName(race.event)}</div>`);
  try {
    const rp = await loadReplay(round);
    if (state.race !== race) return; // the user clicked elsewhere while loading
    rp.cars.forEach((c) => (teamColor[c.code] = c.color));
    state.replay = rp;
    scene.setReplay(rp);
    scene.paint(state.colorMode, pWin());
    scene.setCamera(currentCamera);
    // open a few laps in, so the first frame shows a spread-out field
    state.frame = rp.lap_starts[Math.min(7, rp.lap_starts.length - 1)] ?? 0;
    $("#ticks").innerHTML = rp.lap_starts
      .filter((_, i) => i % 10 === 9)
      .map((s) => `<i style="left:${(s / (rp.frames - 1)) * 100}%"></i>`)
      .join("");
    $<HTMLButtonElement>("#play").disabled = false;
    $<HTMLInputElement>("#scrub").disabled = false;
    overlay(null);
    placeCars();
    renderTower();
    updateLapUI(true);
    if (!reducedMotion) setPlaying(true);
  } catch (err) {
    overlay(`<div class="label">Replay unavailable</div><p>Could not load the position data (${(err as Error).message}).</p>`);
  }
}

// ------------------------------------------------------------------ controls
let currentCamera: CameraPreset = "orbit";
(["orbit", "top", "side"] as CameraPreset[]).forEach((name) => {
  $(`#cam-${name}`).onclick = () => {
    currentCamera = name;
    (["orbit", "top", "side"] as const).forEach((n) => $(`#cam-${n}`).setAttribute("aria-pressed", String(n === name)));
    scene.setCamera(name);
  };
});
const setColor = (mode: "team" | "prob") => {
  state.colorMode = mode;
  $("#col-team").setAttribute("aria-pressed", String(mode === "team"));
  $("#col-prob").setAttribute("aria-pressed", String(mode === "prob"));
  scene.paint(mode, pWin());
  renderLegend();
};
$("#col-team").onclick = () => setColor("team");
$("#col-prob").onclick = () => setColor("prob");
$<HTMLInputElement>("#exag").oninput = (e) => {
  const v = Number((e.target as HTMLInputElement).value);
  $("#exagv").textContent = String(v);
  scene.setExaggeration(v);
  placeCars();
  renderLegend();
};
$<HTMLInputElement>("#scrub").oninput = (e) => {
  if (!state.replay) return;
  state.frame = (Number((e.target as HTMLInputElement).value) / 1000) * (state.replay.frames - 1);
  placeCars();
  updateLapUI();
};
document.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((b) => {
  b.onclick = () => {
    state.speed = Number(b.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  };
});
$("#play").onclick = () => {
  if (state.replay && state.frame >= state.replay.frames - 1) state.frame = 0;
  setPlaying(!state.playing);
};

// hover card (mouse) or tap card (touch)
const tip = $("#tip");
let tipTimer = 0;
function showTip(ev: PointerEvent | MouseEvent): boolean {
  const car = state.replay ? scene.pick(ev.clientX, ev.clientY) : null;
  if (!car) {
    tip.hidden = true;
    return false;
  }
  const rows = state.race!.rows;
  const fc = rows.find((x) => x.driver === car.code);
  const rect = scene.canvas.getBoundingClientRect();
  tip.style.setProperty("--c", car.color);
  tip.style.left = `${ev.clientX - rect.left}px`;
  tip.style.top = `${ev.clientY - rect.top}px`;
  const result = car.finish && /Finished|Lap/.test(car.status) ? `P${car.finish}` : car.status;
  tip.innerHTML = `<b>${car.code} <span class="dim" style="font-size:13px">${car.team}</span></b>
    <div class="row"><span>Model P(win)</span><span class="f">${fc ? pct(fc.p_win, 1) : "–"}</span></div>
    <div class="row"><span>Predicted / grid</span><span>P${fc ? rows.indexOf(fc) + 1 : "–"} / P${car.grid}</span></div>
    <div class="row"><span>Result</span><span>${result}</span></div>`;
  tip.hidden = false;
  return true;
}
scene.canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "mouse") showTip(ev);
});
scene.canvas.addEventListener("pointerleave", (ev) => {
  if (ev.pointerType === "mouse") tip.hidden = true;
});
// touch has no hover: a tap on a car pins its card for a few seconds
scene.canvas.addEventListener("pointerup", (ev) => {
  if (ev.pointerType === "mouse") return;
  window.clearTimeout(tipTimer);
  if (showTip(ev)) tipTimer = window.setTimeout(() => (tip.hidden = true), 3500);
});

// keyboard: space play/pause, arrows step a lap, [ ] change race, 1-3 cameras
function jumpLap(step: number) {
  const rp = state.replay;
  if (!rp) return;
  const lap = currentLap();
  const target = Math.min(Math.max(lap + step, 1), rp.lap_starts.length);
  state.frame = rp.lap_starts[target - 1];
  placeCars();
  updateLapUI();
}
document.addEventListener("keydown", (ev) => {
  const el = ev.target as HTMLElement;
  if (ev.metaKey || ev.ctrlKey || ev.altKey || el.matches("input, textarea, select")) return;
  const races = state.season?.races ?? [];
  const idx = races.findIndex((r) => r.round === state.race?.round);
  if (ev.key === " " && !el.matches("button")) {
    ev.preventDefault();
    $<HTMLButtonElement>("#play").click();
  } else if (ev.key === "ArrowRight") {
    ev.preventDefault();
    jumpLap(1);
  } else if (ev.key === "ArrowLeft") {
    ev.preventDefault();
    jumpLap(-1);
  } else if (ev.key === "]" && idx < races.length - 1) {
    void selectRace(races[idx + 1].round);
  } else if (ev.key === "[" && idx > 0) {
    void selectRace(races[idx - 1].round);
  } else if (["1", "2", "3"].includes(ev.key)) {
    $(`#cam-${["orbit", "top", "side"][Number(ev.key) - 1]}`).click();
  }
});

// ------------------------------------------------------------------ loop
let prev = performance.now();
function tick(now: number) {
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  const rp = state.replay;
  if (state.playing && rp) {
    state.frame = Math.min(state.frame + (dt * state.speed) / rp.dt, rp.frames - 1);
    if (state.frame >= rp.frames - 1) setPlaying(false);
    placeCars();
    updateLapUI();
  }
  scene.render();
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ boot
function roundFromHash(): number | null {
  const m = /^#r(\d{1,2})$/.exec(location.hash);
  const rd = m ? Number(m[1]) : null;
  return rd && state.season?.races.some((r) => r.round === rd) ? rd : null;
}

async function boot() {
  // Car labels are painted on a canvas, which does not wait for web fonts.
  const labelFont = document.fonts.load(LABEL_FONT).catch(() => undefined);
  try {
    state.season = await getJSON<SeasonForecasts>("forecasts-2026.json");
  } catch (err) {
    overlay(`<div class="label">Data unavailable</div><p>${(err as Error).message}</p>`);
    return;
  }
  const races = state.season.races;
  renderHeader(races);
  scene.resize();
  requestAnimationFrame(tick);
  const latest = [...races].reverse().find((r) => r.replay) ?? races[races.length - 1];
  await labelFont;
  await selectRace(roundFromHash() ?? latest.round);
  window.addEventListener("hashchange", () => {
    const rd = roundFromHash();
    if (rd && rd !== state.race?.round) void selectRace(rd);
  });
}
void boot();
