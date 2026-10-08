import numpy as np

from f1pred.evaluation.backtest import summarise, walk_forward
from f1pred.features.build import build_features
from f1pred.models.zoo import GridBaseline, Model, get_zoo


class SpyModel(Model):
    """Records what it was trained on so we can prove no future data leaks in."""

    name = "spy"

    def __init__(self):
        self.calls = []

    def fit(self, train):
        self._train_max = train["race_idx"].max()
        return self

    def score(self, race):
        self.calls.append((self._train_max, race["race_idx"].iloc[0]))
        return -race["grid"].to_numpy(dtype=float)


def test_walk_forward_trains_only_on_the_past(results):
    feats = build_features(results)
    spy = SpyModel()
    walk_forward(feats, spy, start_season=2023, n_sims=200)
    assert spy.calls
    assert all(train_max < test_idx for train_max, test_idx in spy.calls)


def test_every_model_runs_and_beats_noise(results):
    feats = build_features(results)
    for model in get_zoo().values():
        metrics, preds = walk_forward(
            feats, model, start_season=2024, n_sims=500, min_train_races=5
        )
        assert len(metrics) == 8
        # Synthetic races are driven by a latent pace, so any sane model is positive.
        assert metrics["spearman"].mean() > 0.3, model.name
        assert np.allclose(preds.groupby("race_id")["p_win"].sum(), 1.0)


def test_summary_table(results):
    feats = build_features(results)
    metrics, _ = walk_forward(
        feats, GridBaseline(), start_season=2024, n_sims=200, min_train_races=5
    )
    table = summarise(metrics)
    assert table.loc["v0_grid", "races"] == 8
