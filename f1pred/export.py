"""Export forecasts and 3D race replays as static JSON for the Pit Wall web app.

    python -m f1pred export-web --season 2026            # every completed round
    python -m f1pred export-web --season 2026 --rounds 3  # one race

Files land in ``web/public/data``:

- ``forecasts-<season>.json``: per race, the model's out-of-sample forecast
  (from the walk-forward backtest), the result, and a small circuit outline.
- ``races/<season>-<round>.json``: circuit centreline with elevation, plus
  every car's position sampled every ``dt`` seconds from the timing feed.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import fastf1
import numpy as np
import pandas as pd

from f1pred.config import CACHE_DIR, REPORTS_DIR, ROOT

log = logging.getLogger(__name__)

WEB_DATA = ROOT / "web" / "public" / "data"
TRACK_POINTS = 700  # centreline resolution after arc-length resampling
OUTLINE_POINTS = 90  # for the small circuit drawing on each race card


def _write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")


def _resample(xyz: np.ndarray, n: int) -> np.ndarray:
    """Evenly spaced points along a polyline (by arc length, not by time)."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(xyz, axis=0), axis=1))]
    u = np.linspace(0, d[-1], n)
    return np.stack([np.interp(u, d, xyz[:, i]) for i in range(xyz.shape[1])], axis=1)


def _centreline(laps) -> np.ndarray:
    """Position trace of the quickest lap that actually has position data.

    The fastest lap's position feed is sometimes empty (Monaco 2026), so fall
    back through the next-quickest laps until one has a usable trace.
    """
    for _, lap in laps.dropna(subset=["LapTime"]).sort_values("LapTime").head(40).iterlaps():
        try:
            pos = lap.get_pos_data()
        except Exception:  # noqa: BLE001 - missing feed for this lap; try the next
            continue
        if {"X", "Y", "Z"} <= set(pos.columns) and len(pos) > 200:
            return pos[["X", "Y", "Z"]].to_numpy(float)
    raise ValueError("no lap with position data")


def export_race(season: int, rnd: int, dt: float = 2.5) -> dict:
    """Circuit geometry and a sampled position replay for one race."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    fastf1.set_log_level("WARNING")
    session = fastf1.get_session(season, rnd, "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    laps, results = session.laps, session.results

    # FastF1 positions are in decimetres; convert to metres. The fastest lap
    # gives a clean centreline with the real elevation (Z) profile.
    lap_xyz = _centreline(laps) / 10.0
    track = _resample(lap_xyz, TRACK_POINTS)
    center = track.mean(axis=0)
    lap_length = float(np.linalg.norm(np.diff(track, axis=0), axis=1).sum())

    start = laps.loc[laps["LapNumber"] == 1, "LapStartTime"].min()
    end = laps.groupby("Driver")["Time"].max().max()
    clock = pd.timedelta_range(start, end, freq=pd.Timedelta(seconds=dt)).total_seconds()
    clock = clock.to_numpy()

    cars = []
    for num in session.drivers:
        pos = session.pos_data.get(num)
        if pos is None or num not in results.index:
            continue
        r = results.loc[num]
        t = pos["SessionTime"].dt.total_seconds().to_numpy()
        xyz = pos[["X", "Y", "Z"]].to_numpy(float) / 10.0
        coords = [
            np.round(np.interp(clock, t, xyz[:, i]) - center[i]).astype(int) for i in range(3)
        ]
        driver_laps = laps.pick_drivers(num)
        last = driver_laps["Time"].max().total_seconds() if len(driver_laps) else clock[0]
        cars.append(
            {
                "code": r["Abbreviation"],
                "team": r["TeamName"],
                "color": "#" + (r["TeamColor"] or "7a808a"),
                "grid": int(r["GridPosition"]) if r["GridPosition"] > 0 else len(results),
                "finish": None if pd.isna(r["Position"]) else int(r["Position"]),
                "status": r["Status"],
                # frames after the car's last timed lap are hidden (retired / in the garage)
                "until": int((clock <= last + 5).sum()),
                "x": coords[0].tolist(),
                "y": coords[1].tolist(),
                "z": coords[2].tolist(),
            }
        )

    winner = results.loc[results["Position"] == 1, "Abbreviation"].iloc[0]
    lap_starts = [
        int(round((t.total_seconds() - clock[0]) / dt))
        for t in laps.pick_drivers(winner)["LapStartTime"]
    ]
    order = {
        int(n): g.dropna(subset=["Position"]).sort_values("Position")["Driver"].tolist()
        for n, g in laps.groupby("LapNumber")
    }
    data = {
        "season": season,
        "round": rnd,
        "event": session.event["EventName"],
        "circuit": session.event["Location"],
        "total_laps": int(session.total_laps),
        "lap_length_m": round(lap_length),
        "dt": dt,
        "frames": len(clock),
        "track": np.round(track - center, 1).tolist(),
        "cars": cars,
        "lap_starts": lap_starts,
        "order": order,
    }
    _write(WEB_DATA / "races" / f"{season}-{rnd:02d}.json", data)
    return data


def _outline(track: list) -> list:
    xy = _resample(np.asarray(track)[:, :2], OUTLINE_POINTS)
    return np.round(xy).astype(int).tolist()


def export_forecasts(season: int, model: str = "v6_ensemble") -> list[dict]:
    """Per-race forecasts from the committed backtest output."""
    preds = pd.read_csv(REPORTS_DIR / "backtest_predictions.csv.gz")
    metrics = pd.read_csv(REPORTS_DIR / "backtest_metrics.csv")
    preds = preds[(preds["model"] == model) & (preds["season"] == season)]
    metrics = metrics[(metrics["model"] == model) & (metrics["season"] == season)]

    races = []
    for m in metrics.sort_values("round").itertuples(index=False):
        p = preds[preds["race_id"] == m.race_id].sort_values("score", ascending=False)
        replay = WEB_DATA / "races" / f"{season}-{int(m.round):02d}.json"
        outline = None
        if replay.exists():
            outline = _outline(json.loads(replay.read_text(encoding="utf-8"))["track"])
        races.append(
            {
                "round": int(m.round),
                "event": m.event,
                "spearman": round(float(m.spearman), 3),
                "podium_hits": int(round(m.podium_hits * 3)),
                "winner_hit": bool(m.winner_hit),
                "temperature": round(float(m.temperature), 2),
                "replay": replay.exists(),
                "outline": outline,
                "rows": [
                    {
                        "driver": r.driver,
                        "team": r.team_name,
                        "grid": int(r.grid),
                        "finish": int(r.finish_pos),
                        "p_win": round(float(r.p_win), 4),
                        "p_podium": round(float(r.p_podium), 4),
                        "p_points": round(float(r.p_points), 4),
                    }
                    for r in p.itertuples(index=False)
                ],
            }
        )
    _write(
        WEB_DATA / f"forecasts-{season}.json", {"season": season, "model": model, "races": races}
    )
    return races


def export_web(season: int, rounds: list[int] | None = None) -> None:
    done = pd.read_csv(REPORTS_DIR / "backtest_metrics.csv")
    available = sorted(done.loc[done["season"] == season, "round"].unique().tolist())
    for rnd in rounds or available:
        try:
            data = export_race(season, int(rnd))
            log.info("exported %s round %s: %s frames", season, rnd, data["frames"])
        except Exception as exc:  # noqa: BLE001 - one missing feed shouldn't stop the rest
            log.warning("no replay for %s round %s: %s", season, rnd, exc)
    export_forecasts(season)
