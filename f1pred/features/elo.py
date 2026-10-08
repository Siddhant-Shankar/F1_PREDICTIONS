"""Multi-competitor Elo ratings for drivers and constructors.

A race with n finishers is treated as n*(n-1)/2 head-to-head matches: every
driver "beats" everyone who finished behind them. Each rating moves by

    K / (n - 1) * sum_j (S_ij - E_ij),   E_ij = 1 / (1 + 10 ** ((R_j - R_i) / 400))

which is the standard pairwise decomposition of a ranking into Elo updates
(the online analogue of fitting a Plackett-Luce / Bradley-Terry model).
Dividing by n - 1 keeps a single race worth roughly one classic Elo game.

Ratings shrink toward the mean between seasons, and harder when the technical
regulations reset (2022, 2026), because the previous car hierarchy then says
much less about the new one.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np
import pandas as pd

BASE = 1500.0
REG_RESETS = {2022, 2026}


def _expected(r: np.ndarray) -> np.ndarray:
    diff = r[None, :] - r[:, None]  # diff[i, j] = R_j - R_i
    return 1.0 / (1.0 + 10.0 ** (diff / 400.0))


def pre_race_elo(
    results: pd.DataFrame,
    key: str,
    k: float = 24.0,
    season_shrink: float = 0.2,
    reset_shrink: float = 0.5,
) -> pd.Series:
    """Rating of ``key`` (``"driver"`` or ``"team"``) *before* each race.

    The returned series is aligned to ``results.index``. A race only updates
    ratings after its own rows have been assigned the pre-race value, so the
    result never leaks into the feature.
    """
    ratings: dict[str, float] = defaultdict(lambda: BASE)
    out = pd.Series(np.nan, index=results.index, dtype=float)
    last_season = None

    order = results[["season", "round"]].drop_duplicates().sort_values(["season", "round"])
    for season, rnd in order.itertuples(index=False):
        if last_season is not None and season != last_season:
            shrink = reset_shrink if season in REG_RESETS else season_shrink
            for name in list(ratings):
                ratings[name] = BASE + (1 - shrink) * (ratings[name] - BASE)
        last_season = season

        race = results[(results["season"] == season) & (results["round"] == rnd)]
        out.loc[race.index] = race[key].map(lambda n: ratings[n]).to_numpy()

        if key == "team":
            # A constructor's result is its best car, so each team is ranked
            # once per race rather than double-counted.
            names = race.groupby("team")["finish_pos"].min().sort_values().index.to_numpy()
        else:
            names = race.sort_values("finish_pos")["driver"].to_numpy()

        n = len(names)
        if n < 2:
            continue
        r = np.array([ratings[name] for name in names])
        expected = _expected(r)
        np.fill_diagonal(expected, 0.0)
        # names are in finishing order, so i beat j iff i < j
        actual = np.triu(np.ones((n, n)), k=1)
        delta = k / (n - 1) * (actual - expected).sum(axis=1)
        for name, d in zip(names, delta, strict=True):
            ratings[name] += d
    return out
