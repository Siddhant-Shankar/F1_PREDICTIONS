"""Download race results with FastF1 and flatten them into one tidy table.

One row per (season, round, driver) with everything known *before* lights out
(qualifying, grid) plus the race outcome used as the training label. Features
are derived later in :mod:`f1pred.features`; this module only collects facts.

Results come from FastF1's Jolpica (Ergast-compatible) interface, which serves
a whole season per paginated query. Loading every session through the live
timing API instead costs about 10 requests per weekend and runs into FastF1's
500-requests-per-hour limit after a couple of seasons.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

import fastf1
import numpy as np
import pandas as pd
from fastf1.ergast import Ergast

from f1pred.config import CACHE_DIR, RESULTS_PATH, TEAM_LINEAGE

log = logging.getLogger(__name__)

RESULT_COLUMNS = [
    "season",
    "round",
    "event",
    "location",
    "date",
    "sprint_weekend",
    "driver",
    "driver_id",
    "team",
    "team_name",
    "quali_pos",
    "quali_best_s",
    "quali_gap_pct",
    "grid",
    "finish_pos",
    "classified",
    "status",
    "points",
]


def _ergast() -> Ergast:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    fastf1.set_log_level("WARNING")
    return Ergast(result_type="pandas", auto_cast=True, limit=100)


def _all_pages(response) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Concatenate a paginated multi-race response into (races, rows)."""
    descs, rows = [], []
    while True:
        for desc, content in zip(
            response.description.itertuples(index=False), response.content, strict=True
        ):
            descs.append(desc._asdict())
            rows.append(content.assign(season=desc.season, round=desc.round))
        try:
            response = response.get_next_result_page()
        except ValueError:  # raised by FastF1 when there is no further page
            break
    return pd.DataFrame(descs).drop_duplicates(["season", "round"]), pd.concat(rows)


def _qualifying(quali: pd.DataFrame) -> pd.DataFrame:
    times = quali[["Q1", "Q2", "Q3"]].apply(lambda c: pd.to_timedelta(c).dt.total_seconds())
    q = quali[["season", "round", "driverId", "position"]].copy()
    q["quali_best_s"] = times.min(axis=1)
    pole = q.groupby(["season", "round"])["quali_best_s"].transform("min")
    # Gap in percent rather than seconds so it is comparable across tracks
    # (0.3 s at Monaco is not the same as 0.3 s at Spa).
    q["quali_gap_pct"] = 100 * (q["quali_best_s"] - pole) / pole
    return q.rename(columns={"driverId": "driver_id", "position": "quali_pos"})


def load_season(season: int) -> pd.DataFrame:
    """Return one row per driver per race for every completed race in ``season``."""
    ergast = _ergast()
    races, res = _all_pages(ergast.get_race_results(season=season))
    _, quali = _all_pages(ergast.get_qualifying_results(season=season))

    schedule = fastf1.get_event_schedule(season, include_testing=False)
    sprint = {int(r.RoundNumber): "sprint" in str(r.EventFormat) for r in schedule.itertuples()}

    df = pd.DataFrame(
        {
            "season": res["season"].astype(int),
            "round": res["round"].astype(int),
            "driver": res["driverCode"],
            "driver_id": res["driverId"],
            "team_raw": res["constructorId"],
            "team_name": res["constructorName"],
            "grid": res["grid"].astype(float),
            "finish_pos": res["position"].astype(float),
            "classified": res["positionText"].astype(str).str.isdigit(),
            "status": res["status"],
            "points": res["points"].astype(float),
        }
    )
    df = df.merge(_qualifying(quali), on=["season", "round", "driver_id"], how="left")
    meta = races.rename(columns={"raceName": "event", "circuitId": "location", "raceDate": "date"})[
        ["season", "round", "event", "location", "date"]
    ].astype({"season": int, "round": int})
    df = df.merge(meta, on=["season", "round"], how="left")

    field = df.groupby(["season", "round"])["driver"].transform("size")
    # Grid 0 means a pit-lane start: effectively behind everyone.
    df["grid"] = df["grid"].replace(0, np.nan).fillna(field)
    df["quali_pos"] = df["quali_pos"].astype(float).fillna(field)
    df["team"] = df["team_raw"].map(lambda t: TEAM_LINEAGE.get(t, t))
    df["date"] = pd.to_datetime(df["date"])
    df["sprint_weekend"] = df["round"].map(sprint).fillna(False).astype(bool)
    return df[RESULT_COLUMNS]


def ingest(seasons: Iterable[int], refresh: bool = False) -> pd.DataFrame:
    """Build the results table, re-downloading only the seasons that may have changed."""
    existing = pd.DataFrame(columns=RESULT_COLUMNS)
    if RESULTS_PATH.exists() and not refresh:
        existing = pd.read_parquet(RESULTS_PATH)

    current = pd.Timestamp.now().year
    frames = []
    for season in seasons:
        cached = existing[existing["season"] == season]
        if len(cached) and season < current:
            frames.append(cached)
            continue
        frames.append(load_season(season))
        log.info("loaded %s: %d races", season, frames[-1]["round"].nunique())

    out = pd.concat(frames, ignore_index=True).sort_values(["season", "round", "finish_pos"])
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(RESULTS_PATH, index=False)
    return out
