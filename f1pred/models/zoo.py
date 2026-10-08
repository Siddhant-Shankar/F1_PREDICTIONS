"""Model versions, from a naive baseline to the full model.

Every model has the same interface: ``fit(train)`` on races strictly before
the one being predicted, then ``score(race)``, where a higher score means a
better expected finish. Plackett-Luce turns any score into probabilities, so
each version is judged on identical terms.

Versions are cumulative. Each adds one idea, so the backtest leaderboard
reads as a changelog of what moved the needle.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


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


def get_zoo() -> dict[str, Model]:
    models: list[Model] = [
        GridBaseline(),
    ]
    return {m.name: m for m in models}
