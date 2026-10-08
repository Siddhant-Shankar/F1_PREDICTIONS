"""Turn the raw results table into a leakage-free feature matrix.

Every feature for a race is computed from information available before that
race starts: the current weekend's qualifying/grid, and *previous* races'
results. Rolling statistics are always ``shift(1)``-ed within an entity so a
race never sees its own outcome. ``tests/test_features.py`` enforces this by
perturbing future results and checking that past features don't move.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from f1pred.features.elo import pre_race_elo

# Feature groups. The model zoo adds them one at a time so the backtest shows
# what each group is worth.
QUALI_FEATURES = ["grid", "quali_pos", "quali_gap_pct", "teammate_quali_delta"]
FORM_FEATURES = [
    "drv_form_pos",
    "drv_form_points",
    "drv_form_gain",
    "drv_dnf_rate",
    "team_form_points",
    "team_dnf_rate",
    "season_points_rank",
]
RATING_FEATURES = ["drv_elo", "team_elo", "drv_elo_rel", "team_elo_rel"]
CIRCUIT_FEATURES = ["drv_circuit_pos", "circuit_grid_corr"]

ALL_FEATURES = QUALI_FEATURES + FORM_FEATURES + RATING_FEATURES + CIRCUIT_FEATURES

FORM_HALFLIFE = 4  # races; roughly a month of racing carries half the weight


def _lagged_ewm(df: pd.DataFrame, by: str, col: str, halflife: float = FORM_HALFLIFE) -> pd.Series:
    """Exponentially weighted mean of ``col`` over *previous* rows of each group.

    ``df`` must already be in chronological order.
    """
    return df.groupby(by)[col].transform(
        lambda s: s.shift(1).ewm(halflife=halflife, ignore_na=True).mean()
    )


def add_race_keys(results: pd.DataFrame) -> pd.DataFrame:
    df = results.sort_values(["season", "round", "finish_pos"]).reset_index(drop=True)
    order = df[["season", "round"]].drop_duplicates().reset_index(drop=True)
    order["race_idx"] = np.arange(len(order))
    df = df.merge(order, on=["season", "round"])
    df["race_id"] = df["season"].astype(str) + "-" + df["round"].astype(str).str.zfill(2)
    df["field_size"] = df.groupby("race_idx")["driver"].transform("size")
    return df


def build_features(results: pd.DataFrame) -> pd.DataFrame:
    df = add_race_keys(results)
    df["dnf"] = (~df["classified"].astype(bool)).astype(float)
    df["pos_gain"] = df["grid"] - df["finish_pos"]

    # --- current weekend (known before the race) ----------------------------
    # No qualifying time set (crash, technical issue): treat as slowest of the field.
    slowest = df.groupby("race_idx")["quali_gap_pct"].transform("max")
    df["quali_gap_pct"] = df["quali_gap_pct"].fillna(slowest)

    # Teammate comparison is the cleanest driver-skill signal in F1: same car.
    team_q = df.groupby(["race_idx", "team"])["quali_gap_pct"]
    team_sum, team_n = team_q.transform("sum"), team_q.transform("count")
    mate_gap = (team_sum - df["quali_gap_pct"]) / (team_n - 1).replace(0, np.nan)
    df["teammate_quali_delta"] = df["quali_gap_pct"] - mate_gap

    # --- driver form (previous races only) ----------------------------------
    df["drv_form_pos"] = _lagged_ewm(df, "driver", "finish_pos")
    df["drv_form_points"] = _lagged_ewm(df, "driver", "points")
    df["drv_form_gain"] = _lagged_ewm(df, "driver", "pos_gain")
    df["drv_dnf_rate"] = _lagged_ewm(df, "driver", "dnf", halflife=8)

    # --- constructor form ---------------------------------------------------
    team_race = (
        df.groupby(["race_idx", "team"])
        .agg(team_points=("points", "sum"), team_dnf=("dnf", "mean"))
        .reset_index()
        .sort_values("race_idx")
    )
    team_race["team_form_points"] = _lagged_ewm(team_race, "team", "team_points")
    team_race["team_dnf_rate"] = _lagged_ewm(team_race, "team", "team_dnf", halflife=8)
    df = df.merge(
        team_race[["race_idx", "team", "team_form_points", "team_dnf_rate"]],
        on=["race_idx", "team"],
        how="left",
    )

    # --- championship standing going into the race --------------------------
    df["season_points_before"] = df.groupby(["season", "driver"])["points"].transform(
        lambda s: s.shift(1).fillna(0).cumsum()
    )
    df["season_points_rank"] = df.groupby("race_idx")["season_points_before"].rank(
        ascending=False, method="min"
    )

    # --- Elo ratings --------------------------------------------------------
    df["drv_elo"] = pre_race_elo(df, "driver")
    df["team_elo"] = pre_race_elo(df, "team")
    # Ratings relative to the field: 1600 means more against 1450s than 1580s.
    for col in ("drv_elo", "team_elo"):
        df[f"{col}_rel"] = df[col] - df.groupby("race_idx")[col].transform("mean")

    # --- circuit history ----------------------------------------------------
    df["drv_circuit_pos"] = df.groupby(["driver", "location"])["finish_pos"].transform(
        lambda s: s.shift(1).expanding().mean()
    )
    df["circuit_grid_corr"] = _circuit_grid_corr(df)

    return df.sort_values(["race_idx", "finish_pos"]).reset_index(drop=True)


def _circuit_grid_corr(df: pd.DataFrame) -> np.ndarray:
    """How much grid order has historically decided the race at this circuit.

    Spearman correlation of grid vs. finish over all *earlier* visits to the
    track: high at Monaco/Singapore (little overtaking), lower at Spa/Bahrain.
    Missing on a first visit; LightGBM handles NaN natively.
    """
    rows = []
    for (race_idx, location), r in df.groupby(["race_idx", "location"]):
        rows.append((race_idx, location, r["grid"].corr(r["finish_pos"], method="spearman")))
    per_race = pd.DataFrame(rows, columns=["race_idx", "location", "corr"]).sort_values("race_idx")
    per_race["circuit_grid_corr"] = per_race.groupby("location")["corr"].transform(
        lambda s: s.shift(1).expanding().mean()
    )
    merged = df[["race_idx", "location"]].merge(per_race, on=["race_idx", "location"], how="left")
    return merged["circuit_grid_corr"].to_numpy()
