"""Model versions, from a naive baseline to the full model.

Every model has the same interface: ``fit(train)`` on races strictly before
the one being predicted, then ``score(race)``, where a higher score means a
better expected finish. Plackett-Luce turns any score into probabilities, so
each version is judged on identical terms.

Versions are cumulative. Each adds one idea, so the backtest leaderboard
reads as a changelog of what moved the needle.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from f1pred.features.build import (
    ALL_FEATURES,
    FORM_FEATURES,
    QUALI_FEATURES,
)

GBM_PARAMS = dict(
    n_estimators=300,
    learning_rate=0.03,
    num_leaves=15,
    min_child_samples=20,
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    random_state=42,
    verbose=-1,
)


class Model:
    name: str = "base"
    description: str = ""
    features: list[str] = []

    def fit(self, train: pd.DataFrame) -> Model:
        return self

    def score(self, race: pd.DataFrame) -> np.ndarray:
        raise NotImplementedError


class GridBaseline(Model):
    """Finish where you start. The bar every F1 model has to clear."""

    name = "v0_grid"
    description = "Baseline: predicted order = starting grid"
    features = ["grid"]

    def score(self, race):
        return -race["grid"].to_numpy(dtype=float)


@dataclass
class LinearQuali(Model):
    """Ridge regression on qualifying pace, which captures *how much* faster than the field."""

    name: str = "v1_quali_linear"
    description: str = "Ridge regression on grid + qualifying gap + teammate delta"
    features: list[str] = field(default_factory=lambda: list(QUALI_FEATURES))

    def fit(self, train):
        self.pipe = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), Ridge(1.0))
        self.pipe.fit(train[self.features], train["finish_pos"])
        return self

    def score(self, race):
        return -self.pipe.predict(race[self.features])


@dataclass
class GBMRegressor(Model):
    """Gradient-boosted trees predicting finishing position."""

    name: str = "v2_form_gbm"
    description: str = "LightGBM regressor + driver/team rolling form"
    features: list[str] = field(default_factory=lambda: QUALI_FEATURES + FORM_FEATURES)
    finishers_only: bool = False

    def fit(self, train):
        if self.finishers_only:
            train = train[train["classified"].astype(bool)]
        self.model = lgb.LGBMRegressor(objective="l1", **GBM_PARAMS)
        self.model.fit(train[self.features], train["finish_pos"])
        return self

    def score(self, race):
        return -self.model.predict(race[self.features])


@dataclass
class LambdaRanker(Model):
    """Learning-to-rank: optimise the *ordering* within each race directly.

    A regressor is penalised for predicting P4 vs P6 for a driver who finished
    P5, even if it ranked the whole field correctly. LambdaRank instead
    optimises NDCG, a ranking metric that weights mistakes at the front of the
    grid most, which is where podiums and wins are decided.
    """

    name: str = "v4_lambdarank"
    description: str = "LightGBM LambdaRank (optimises in-race ordering, NDCG)"
    features: list[str] = field(default_factory=lambda: list(ALL_FEATURES))
    finishers_only: bool = False

    def fit(self, train):
        if self.finishers_only:
            # DNFs are mostly mechanical failures and crashes, so the "finishing
            # position" of a retired car says little about its pace. Learning the
            # order of classified finishers only gives a cleaner pace signal.
            train = train[train["classified"].astype(bool)]
        train = train.sort_values(["race_idx", "finish_pos"])
        # Graded relevance: P1 in a 20-car field -> 20, P20 -> 1. Linear gains
        # (instead of LightGBM's default 2^rel - 1) keep the midfield in play.
        rel = (train["field_size"] + 1 - train["finish_pos"]).clip(lower=0).astype(int)
        max_rel = int(rel.max())
        self.model = lgb.LGBMRanker(
            objective="lambdarank",
            label_gain=list(range(max_rel + 1)),
            lambdarank_truncation_level=10,
            **GBM_PARAMS,
        )
        self.model.fit(
            train[self.features],
            rel,
            group=train.groupby("race_idx", sort=True).size().to_numpy(),
        )
        return self

    def score(self, race):
        return self.model.predict(race[self.features])


@dataclass
class Ensemble(Model):
    """Average of per-race standardised scores from several models.

    The ranker, the regressor and the grid make partly independent errors:
    the ranker is sharp at the front, the regressor is steadier through the
    midfield, and the grid anchors both to what actually happened on Saturday.
    """

    name: str = "v6_ensemble"
    description: str = "Blend: 50% finishers-only ranker, 25% regressor, 25% grid"
    parts: list[tuple[Model, float]] = field(default_factory=list)

    def __post_init__(self):
        if not self.parts:
            self.parts = [
                (LambdaRanker(finishers_only=True), 0.5),
                (GBMRegressor(features=list(ALL_FEATURES), finishers_only=True), 0.25),
                (GridBaseline(), 0.25),
            ]
        self.features = sorted({f for m, _ in self.parts for f in m.features})

    def fit(self, train):
        for model, _ in self.parts:
            model.fit(train)
        return self

    def score(self, race):
        total = np.zeros(len(race))
        for model, weight in self.parts:
            s = model.score(race)
            total += weight * (s - s.mean()) / (s.std() + 1e-9)
        return total


def get_zoo() -> dict[str, Model]:
    models: list[Model] = [
        GridBaseline(),
        LinearQuali(),
        GBMRegressor(),
        GBMRegressor(
            name="v3_elo_gbm",
            description="+ driver/team Elo ratings and circuit history",
            features=list(ALL_FEATURES),
        ),
        LambdaRanker(),
        LambdaRanker(
            name="v5_rank_finishers",
            description="LambdaRank trained on classified finishers only (DNFs are noise)",
            finishers_only=True,
        ),
        Ensemble(),
    ]
    return {m.name: m for m in models}
