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

    def fit(self, train):
        self.model = lgb.LGBMRegressor(objective="l1", **GBM_PARAMS)
        self.model.fit(train[self.features], train["finish_pos"])
        return self

    def score(self, race):
        return -self.model.predict(race[self.features])


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
    ]
    return {m.name: m for m in models}
