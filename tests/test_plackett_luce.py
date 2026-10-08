import numpy as np

from f1pred.models.plackett_luce import (
    fit_temperature,
    log_likelihood,
    outcome_probabilities,
    simulate,
    win_probabilities,
)


def test_simulated_win_rate_matches_softmax():
    scores = np.array([1.5, 1.0, 0.2, -0.5, -1.0])
    sim = outcome_probabilities(scores, temperature=0.7, n_sims=200_000)
    assert np.allclose(sim["p_win"], win_probabilities(scores, 0.7), atol=5e-3)


def test_simulated_positions_are_permutations():
    pos = simulate(np.zeros(6), 1.0, n_sims=100)
    assert (np.sort(pos, axis=1) == np.arange(1, 7)).all()


def test_probabilities_are_consistent():
    p = outcome_probabilities(np.linspace(2, -2, 20), 1.0, n_sims=20_000)
    assert np.isclose(p["p_win"].sum(), 1.0)
    assert np.isclose(p["p_podium"].sum(), 3.0)
    assert np.isclose(p["p_points"].sum(), 10.0)
    assert (p["p_win"] <= p["p_podium"]).all() and (p["p_podium"] <= p["p_points"]).all()


def test_log_likelihood_two_drivers_is_logistic():
    scores = np.array([1.0, 0.0])
    ll = log_likelihood(scores, np.array([0, 1]), temperature=1.0)
    assert np.isclose(ll, np.log(1 / (1 + np.exp(-1.0))))


def test_fit_temperature_recovers_truth():
    rng = np.random.default_rng(0)
    true_t = 0.6
    races = []
    for _ in range(400):
        scores = rng.normal(size=20)
        pos = simulate(scores, true_t, n_sims=1, rng=rng)[0]
        races.append((scores, np.argsort(pos)))
    est = fit_temperature(races, top_k=None)
    assert abs(est - true_t) < 0.08
