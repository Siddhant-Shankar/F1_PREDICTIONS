import "@fontsource-variable/hubot-sans/wdth.css";
import "@fontsource-variable/mona-sans/wdth.css";
import "@fontsource/monaspace-neon/400.css";
import "@fontsource/monaspace-neon/600.css";
import "./landing.css";
import { carDrawing } from "./car-drawing";
import type { RaceForecast, SeasonForecasts } from "../types";

const DATA = `${import.meta.env.BASE_URL}data`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const pad = (n: number) => String(n).padStart(2, "0");
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const shortName = (e: string) => e.replace(" Grand Prix", " GP").replace(" in Malaysia", " (Sepang)");
const replayHref = (round: number) => `replay/#r${pad(round)}`;
const winnerOf = (r: RaceForecast) => r.rows.find((x) => x.finish === 1)!;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one",
  "twenty-two", "twenty-three", "twenty-four"];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const DIAMOND = `<svg class="mk" viewBox="0 0 10 10" aria-hidden="true"><path class="fav" d="M5 0.5 9.5 5 5 9.5 0.5 5z"/></svg>`;
const DOT = `<svg class="mk" viewBox="0 0 10 10" aria-hidden="true"><circle class="win" cx="5" cy="5" r="4"/></svg>`;

// ------------------------------------------------------------------ theme (shared key with the replay app)
type Theme = "dark" | "light";
function setTheme(theme: Theme, save: boolean) {
  document.documentElement.dataset.theme = theme;
  $("#theme-dark").setAttribute("aria-pressed", String(theme === "dark"));
  $("#theme-light").setAttribute("aria-pressed", String(theme === "light"));
  if (save) {
    try {
      localStorage.setItem("pitwall-theme", theme);
    } catch {
      /* private mode: the choice lasts for this page view */
    }
  }
}
const savedTheme = () => {
  try {
    return localStorage.getItem("pitwall-theme");
  } catch {
    return null;
  }
};
setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);
matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
  if (!savedTheme()) setTheme(e.matches ? "light" : "dark", false);
});
$("#theme-dark").onclick = () => setTheme("dark", true);
$("#theme-light").onclick = () => setTheme("light", true);

// ------------------------------------------------------------------ circuit outlines
/** SVG path of a circuit outline fitted into a w×h box, keeping its proportions. */
function outlinePath(outline: [number, number][], w: number, h: number, inset = 2): string {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((w - inset * 2) / (x1 - x0), (h - inset * 2) / (y1 - y0));
  const ox = (w - (x1 - x0) * scale) / 2;
  const oy = (h - (y1 - y0) * scale) / 2;
  return (
    outline
      .map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - x0) * scale).toFixed(1)} ${(oy + (y1 - y) * scale).toFixed(1)}`)
      .join("") + "Z"
  );
}

// ------------------------------------------------------------------ hero: the latest race
function renderLatest(race: RaceForecast, season: number) {
  const win = winnerOf(race);
  const fav = race.rows[0];
  const finish = [...race.rows].sort((a, b) => a.finish - b.finish).slice(0, 5);
  const forecast = race.rows.slice(0, 5);
  const top = Math.max(...forecast.map((r) => r.p_win));

  if (race.outline) {
    const d = outlinePath(race.outline, 400, 300, 12);
    const [, sx, sy] = /^M([\d.]+) ([\d.]+)/.exec(d)!;
    $("#heroTrack").innerHTML = `<path class="ghost" d="${d}"/><path class="draw" pathLength="1" d="${d}"/>
      <circle class="sf" cx="${sx}" cy="${sy}" r="5"/>`;
  }

  const verdict = race.winner_hit
    ? `${fav.driver} won${win.grid === 1 ? " from pole" : ` from P${win.grid}`}, as the model expected.`
    : `${win.driver} won from P${win.grid}. The model had ${fav.driver} as favourite.`;

  $("#latestCard").innerHTML = `
    <h2><a href="${replayHref(race.round)}">${race.event}</a></h2>
    <p class="meta"><span class="num">R${pad(race.round)} · ${season}</span>
      <span class="hit ${race.winner_hit ? "y" : "n"}">${race.winner_hit ? "Called" : "Missed"}</span></p>
    <table class="duel">
      <thead><tr><th scope="col">Forecast</th><th scope="col" class="r">P(win)</th><th scope="col">Finished</th></tr></thead>
      <tbody>${forecast
        .map((r, i) => {
          const f = finish[i];
          const same = f.driver === r.driver;
          return `<tr${same ? ' class="same"' : ""}>
            <td><span class="pos num">${i + 1}</span>${r.driver}</td>
            <td class="r"><span class="bar"><s style="--w:${((r.p_win / top) * 100).toFixed(1)}%"></s></span><span class="num">${pct(r.p_win)}</span></td>
            <td>${f.driver}</td></tr>`;
        })
        .join("")}</tbody>
    </table>
    <p class="verdict">${verdict}</p>`;
  const cta = $<HTMLAnchorElement>("#cta-replay");
  cta.href = replayHref(race.round);
  cta.textContent = `Replay round ${race.round}`;
}

// ------------------------------------------------------------------ season ledger
function renderSeason(data: SeasonForecasts) {
  const races = data.races;
  const n = races.length;
  const hits = races.filter((r) => r.winner_hit).length;
  const podium = races.reduce((a, r) => a + r.podium_hits, 0);
  const rho = races.reduce((a, r) => a + r.spearman, 0) / n;

  $("#season-title").textContent = `${cap(word(n))} races, ${word(n)} calls.`;
  $("#seasonSummary").innerHTML = `The favourite won <b class="num">${hits}</b> of <b class="num">${n}</b>.
    It named <b class="num">${podium}</b> of the <b class="num">${n * 3}</b> drivers who reached the podium, and its
    predicted order correlated <b class="num">${rho.toFixed(2)}</b> with the finish on average.`;

  $("#ledger").innerHTML = races
    .map((r) => {
      const fav = r.rows[0];
      const win = winnerOf(r);
      return `<li><a href="${replayHref(r.round)}" aria-label="${r.event}: favourite ${fav.driver}, winner ${win.driver}, ${r.winner_hit ? "called" : "missed"}">
        <span class="rd"><span class="num">R${pad(r.round)}</span><span class="hit ${r.winner_hit ? "y" : "n"}">${r.winner_hit ? "Called" : "Missed"}</span></span>
        <svg class="outline" viewBox="0 0 160 70" aria-hidden="true">${r.outline ? `<path d="${outlinePath(r.outline, 160, 70)}"/>` : ""}</svg>
        <span class="nm">${shortName(r.event)}</span>
        <span class="calls">
          <span class="f">${DIAMOND}${fav.driver} <span class="num">${pct(fav.p_win)}</span></span>
          <span class="w">${DOT}${win.driver}</span>
        </span>
        ${r.replay ? "" : `<span class="no3d">No position data, so no replay</span>`}
      </a></li>`;
    })
    .join("");
}

// ------------------------------------------------------------------ misses
function renderMisses(data: SeasonForecasts) {
  const misses = data.races.filter((r) => !r.winner_hit).sort((a, b) => winnerOf(a).p_win - winnerOf(b).p_win);
  if (!misses.length) {
    $("#missesSummary").textContent = "None yet: every favourite has won this season.";
    $("#missTable").hidden = true;
    return;
  }
  $("#missesSummary").textContent = `${cap(word(misses.length))} favourite${misses.length === 1 ? "" : "s"} didn't win. Biggest surprise first.`;
  $("#missTable tbody").innerHTML = misses
    .map((r) => {
      const w = winnerOf(r);
      const f = r.rows[0];
      return `<tr>
        <th scope="row"><a href="${replayHref(r.round)}">${shortName(r.event)}</a></th>
        <td><b>${w.driver}</b> <span class="dim">from P${w.grid}</span></td>
        <td class="r num">${pct(w.p_win, 1)}</td>
        <td>${f.driver} <span class="num f">${pct(f.p_win)}</span> <span class="dim">finished P${f.finish}</span></td>
      </tr>`;
    })
    .join("");
}

// ------------------------------------------------------------------ boot
const narrow = matchMedia("(max-width: 640px)");
const drawCar = () => ($("#carDrawing").innerHTML = carDrawing(narrow.matches));
drawCar();
narrow.addEventListener("change", drawCar);

async function boot() {
  let data: SeasonForecasts;
  try {
    const res = await fetch(`${DATA}/forecasts-2026.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as SeasonForecasts;
  } catch (err) {
    $("#latestCard").innerHTML = `<p class="loading">Couldn't load the season data (${(err as Error).message}). The replays may still work.</p>`;
    return;
  }
  const latest = data.races[data.races.length - 1];
  renderLatest(latest, data.season);
  renderSeason(data);
  renderMisses(data);
  document.documentElement.classList.add("ready");
}
void boot();
