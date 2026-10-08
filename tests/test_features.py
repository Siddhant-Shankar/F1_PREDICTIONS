import numpy as np
import pandas as pd
import pytest

from f1pred.features.build import ALL_FEATURES, build_features
from f1pred.features.elo import pre_race_elo


def _key(df):
    return df.set_index(["season", "round", "driver"]).sort_index()


@pytest.mark.parametrize("target", [(2023, 4), (2024, 8)])
def test_no_leakage_from_race_outcome(results, target):
    """Scrambling a race's result must not change any feature up to and including that race."""
    season, rnd = target
    base = _key(build_features(results))

    tampered = results.copy()
    mask = (tampered["season"] == season) & (tampered["round"] == rnd)
    rng = np.random.default_rng(1)
    tampered.loc[mask, "finish_pos"] = rng.permutation(tampered.loc[mask, "finish_pos"].to_numpy())
    tampered.loc[mask, "points"] = rng.permutation(tampered.loc[mask, "points"].to_numpy())
    tampered.loc[mask, "classified"] = False
    changed = _key(build_features(tampered))

    upto = (base.index.get_level_values("season") < season) | (
        (base.index.get_level_values("season") == season)
        & (base.index.get_level_values("round") <= rnd)
    )
    pd.testing.assert_frame_equal(base.loc[upto, ALL_FEATURES], changed.loc[upto, ALL_FEATURES])


def test_future_races_do_change_later_features(results):
    """Sanity check that the leakage test can actually detect a dependency."""
    base = _key(build_features(results))
    tampered = results.copy()
    mask = (tampered["season"] == 2023) & (tampered["round"] == 4)
    tampered.loc[mask, "finish_pos"] = tampered.loc[mask, "finish_pos"].to_numpy()[::-1]
    changed = _key(build_features(tampered))
    nxt = (2023, 5)
    assert not np.allclose(
        base.loc[nxt, "drv_form_pos"].to_numpy(), changed.loc[nxt, "drv_form_pos"].to_numpy()
    )


def test_first_race_has_no_history(results):
    feats = build_features(results)
    first = feats[feats["race_idx"] == 0]
    assert first["drv_form_pos"].isna().all()
    assert (first["drv_elo"] == 1500).all()


def test_teammate_delta_is_antisymmetric(results):
    feats = build_features(results)
    sums = feats.groupby(["race_idx", "team"])["teammate_quali_delta"].sum()
    assert np.allclose(sums, 0)


def test_elo_is_zero_sum_within_race(results):
    feats = build_features(results)
    elo = pre_race_elo(feats, "driver")
    # Within a season (no shrinkage) the total rating mass is conserved.
    season = feats[feats["season"] == 2022]
    totals = elo.loc[season.index].groupby(season["race_idx"]).sum()
    assert np.allclose(totals, totals.iloc[0])


def test_elo_rewards_the_strongest_driver(results):
    feats = build_features(results)
    last = feats[feats["race_idx"] == feats["race_idx"].max()]
    avg_finish = feats.groupby("driver")["finish_pos"].mean()
    best = avg_finish.idxmin()
    worst = avg_finish.idxmax()
    elo = last.set_index("driver")["drv_elo"]
    assert elo[best] > 1500 > elo[worst]
