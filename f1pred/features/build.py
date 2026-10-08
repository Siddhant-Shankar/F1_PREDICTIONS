"""Turn the raw results table into a leakage-free feature matrix.

Every feature for a race is computed from information available before that
race starts: the current weekend's qualifying/grid, and *previous* races'
results.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Feature groups. The model zoo adds them one at a time so the backtest shows
# what each group is worth.
QUALI_FEATURES = ["grid", "quali_pos", "quali_gap_pct", "teammate_quali_delta"]
ALL_FEATURES = list(QUALI_FEATURES)


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
    # --- current weekend (known before the race) ----------------------------
    # No qualifying time set (crash, technical issue): treat as slowest of the field.
    slowest = df.groupby("race_idx")["quali_gap_pct"].transform("max")
    df["quali_gap_pct"] = df["quali_gap_pct"].fillna(slowest)

    # Teammate comparison is the cleanest driver-skill signal in F1: same car.
    team_q = df.groupby(["race_idx", "team"])["quali_gap_pct"]
    team_sum, team_n = team_q.transform("sum"), team_q.transform("count")
    mate_gap = (team_sum - df["quali_gap_pct"]) / (team_n - 1).replace(0, np.nan)
    df["teammate_quali_delta"] = df["quali_gap_pct"] - mate_gap

    return df.sort_values(["race_idx", "finish_pos"]).reset_index(drop=True)
