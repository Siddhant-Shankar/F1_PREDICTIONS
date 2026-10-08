"""Walk-forward (race-by-race) backtest.

For every race in the test window:

1. train on all races strictly before it,
2. score the race's grid using only pre-race features,
3. fit the Plackett-Luce temperature on the model's *earlier out-of-sample*
   scores (never the current race),
4. record ranking and probability metrics against the actual result.

This mirrors how the model would have been used live, one weekend at a time.
A random train/test split would let the model learn from races after the one
it predicts, which flatters the numbers.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from f1pred.evaluation.metrics import race_metrics
from f1pred.models.plackett_luce import fit_temperature, outcome_probabilities
from f1pred.models.zoo import Model

log = logging.getLogger(__name__)

MIN_TRAIN_RACES = 20  # about one season of history before the first prediction
TEMP_WINDOW = 40  # most recent OOS races used to calibrate the temperature
DEFAULT_TEMPERATURE = 1.0


def walk_forward(
    features: pd.DataFrame,
    model: Model,
    start_season: int = 2023,
    n_sims: int = 10_000,
    min_train_races: int = MIN_TRAIN_RACES,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (per-race metrics, per-driver predictions) for ``model``."""
    races = (
        features[["race_idx", "race_id", "season", "round", "event"]]
        .drop_duplicates("race_idx")
        .sort_values("race_idx")
    )
    test_races = races[(races["season"] >= start_season) & (races["race_idx"] >= min_train_races)]

    history: list[tuple[np.ndarray, np.ndarray]] = []  # OOS (scores, finish order)
    metric_rows, pred_frames = [], []

    for race in test_races.itertuples(index=False):
        train = features[features["race_idx"] < race.race_idx]
        test = features[features["race_idx"] == race.race_idx].reset_index(drop=True)

        scores = model.fit(train).score(test)
        # Standardise per race so one temperature works across models and races.
        z = (scores - scores.mean()) / (scores.std() + 1e-9)

        temp = (
            fit_temperature(history[-TEMP_WINDOW:]) if len(history) >= 10 else DEFAULT_TEMPERATURE
        )
        probs = outcome_probabilities(z, temp, n_sims=n_sims, seed=int(race.race_idx))
        finish = test["finish_pos"].to_numpy()

        m = race_metrics(z, finish, probs["p_win"], probs["p_podium"])
        m.update(
            race_idx=race.race_idx,
            race_id=race.race_id,
            season=race.season,
            round=race.round,
            event=race.event,
            temperature=temp,
            model=model.name,
        )
        metric_rows.append(m)

        pred = test[
            [
                "race_id",
                "season",
                "round",
                "event",
                "driver",
                "team",
                "team_name",
                "grid",
                "finish_pos",
            ]
        ].copy()
        pred["score"] = z
        for k, v in probs.items():
            pred[k] = v
        pred["model"] = model.name
        pred_frames.append(pred)

        history.append((z, np.argsort(finish, kind="stable")))
        log.debug("%s %s spearman=%.3f T=%.2f", model.name, race.race_id, m["spearman"], temp)

    return pd.DataFrame(metric_rows), pd.concat(pred_frames, ignore_index=True)


SUMMARY_METRICS = {
    "spearman": "Spearman ρ ↑",
    "ndcg10": "NDCG@10 ↑",
    "winner_hit": "Winner hit-rate ↑",
    "podium_hits": "Podium overlap ↑",
    "top10_hits": "Points (top-10) overlap ↑",
    "mae_pos": "MAE (positions) ↓",
    "win_logloss": "Winner log-loss ↓",
    "podium_brier": "Podium Brier ↓",
}


def summarise(metrics: pd.DataFrame) -> pd.DataFrame:
    """Mean of each metric per model, in zoo order."""
    order = list(dict.fromkeys(metrics["model"]))
    out = metrics.groupby("model")[list(SUMMARY_METRICS)].mean().loc[order]
    out.insert(0, "races", metrics.groupby("model").size().loc[order])
    return out
