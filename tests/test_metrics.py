import numpy as np

from f1pred.evaluation.metrics import ndcg_at_k, predicted_positions, race_metrics


def test_perfect_prediction():
    finish = np.arange(1, 21, dtype=float)
    m = race_metrics(-finish, finish)
    assert m["spearman"] == 1.0
    assert np.isclose(m["ndcg10"], 1.0)
    assert m["winner_hit"] == 1.0 and m["podium_hits"] == 1.0 and m["mae_pos"] == 0.0


def test_reversed_prediction_is_worst():
    finish = np.arange(1, 21, dtype=float)
    m = race_metrics(finish, finish)
    assert m["spearman"] == -1.0
    assert m["winner_hit"] == 0.0 and m["podium_hits"] == 0.0
    assert ndcg_at_k(finish, finish) < 0.6


def test_predicted_positions():
    assert list(predicted_positions(np.array([0.1, 3.0, -1.0]))) == [2, 1, 3]


def test_probability_metrics():
    finish = np.array([2.0, 1.0, 3.0, 4.0])
    p_win = np.array([0.1, 0.7, 0.1, 0.1])
    m = race_metrics(-finish, finish, p_win=p_win, p_podium=np.array([1, 1, 1, 0.0]))
    assert np.isclose(m["win_logloss"], -np.log(0.7))
    assert np.isclose(m["podium_brier"], 0.0)
