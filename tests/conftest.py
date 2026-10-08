"""Synthetic race results so the test suite runs offline in seconds."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from f1pred.config import POINTS


def make_results(seasons=(2022, 2023, 2024), rounds=8, n_teams=5, seed=0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    drivers = [f"D{i:02d}" for i in range(n_teams * 2)]
    teams = {d: f"team{i // 2}" for i, d in enumerate(drivers)}
    car = {f"team{i}": rng.normal(0, 1.0) for i in range(n_teams)}
    skill = {d: rng.normal(0, 0.5) for d in drivers}
    locations = [f"track{r}" for r in range(rounds)]

    rows = []
    for season in seasons:
        for rnd in range(1, rounds + 1):
            pace = np.array([car[teams[d]] + skill[d] for d in drivers])
            quali = pace + rng.normal(0, 0.3, len(drivers))
            race = pace + rng.normal(0, 0.6, len(drivers))
            q_pos = (-quali).argsort().argsort() + 1
            f_pos = (-race).argsort().argsort() + 1
            best = 90 - quali
            for i, d in enumerate(drivers):
                dnf = rng.random() < 0.05
                rows.append(
                    dict(
                        season=season,
                        round=rnd,
                        event=f"GP {rnd}",
                        location=locations[rnd - 1],
                        date=pd.Timestamp(season, 3, 1) + pd.Timedelta(weeks=int(2 * rnd)),
                        sprint_weekend=False,
                        driver=d,
                        driver_id=d.lower(),
                        team=teams[d],
                        team_name=teams[d],
                        quali_pos=float(q_pos[i]),
                        quali_best_s=best[i],
                        quali_gap_pct=100 * (best[i] - best.min()) / best.min(),
                        grid=float(q_pos[i]),
                        finish_pos=float(f_pos[i]),
                        classified=not dnf,
                        status="Retired" if dnf else "Finished",
                        points=float(POINTS.get(int(f_pos[i]), 0)),
                    )
                )
    return pd.DataFrame(rows)


@pytest.fixture
def results() -> pd.DataFrame:
    return make_results()
