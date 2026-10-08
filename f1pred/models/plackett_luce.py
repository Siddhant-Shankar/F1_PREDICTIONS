"""Plackett-Luce: turn a model's scores into finishing-order probabilities.

A ranking model gives every driver a score s_i. Plackett-Luce says the race is
won by driver i with probability exp(s_i / T) / sum_j exp(s_j / T); the winner
is removed and the same rule picks P2 from those left, and so on.

T (temperature) controls how confident we are. Small T means the top score
almost always wins, large T makes it a lottery. We fit T by maximum likelihood
on *out-of-sample* scores from earlier races (see ``backtest.py``), which
calibrates the probabilities without touching the test race.

Sampling uses the Gumbel-max trick: adding independent Gumbel noise to
s_i / T and sorting gives an exact Plackett-Luce sample. That lets us simulate
tens of thousands of races with one vectorised ``argsort``.
"""

from __future__ import annotations

import numpy as np
from scipy.optimize import minimize_scalar


def log_likelihood(scores: np.ndarray, finish_order: np.ndarray, temperature: float) -> float:
    """Log-probability of an observed finishing order under Plackett-Luce.

    ``finish_order`` holds indices into ``scores``, winner first.
    """
    s = scores[finish_order] / temperature
    # log P = sum_k [ s_k - logsumexp(s_k, ..., s_n) ]; the reversed cumulative
    # logsumexp gives every "remaining field" denominator in one pass.
    rev_lse = np.logaddexp.accumulate(s[::-1])[::-1]
    return float(np.sum(s - rev_lse))


def fit_temperature(
    races: list[tuple[np.ndarray, np.ndarray]],
    bounds: tuple[float, float] = (0.05, 20.0),
    top_k: int | None = 10,
) -> float:
    """Maximum-likelihood temperature over a list of (scores, finish_order) races.

    ``top_k`` truncates the likelihood to the first k finishers. The back of
    the field is mostly DNFs and noise, and the probabilities we care about
    (win, podium, points) depend on the front.
    """

    def nll(log_t: float) -> float:
        t = float(np.exp(log_t))
        total = 0.0
        for scores, order in races:
            k = len(order) if top_k is None else min(top_k, len(order))
            s = scores[order] / t
            rev_lse = np.logaddexp.accumulate(s[::-1])[::-1]
            total -= float(np.sum((s - rev_lse)[:k]))
        return total

    res = minimize_scalar(nll, bounds=np.log(bounds), method="bounded")
    return float(np.exp(res.x))


def simulate(
    scores: np.ndarray,
    temperature: float,
    n_sims: int = 20_000,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Simulate races; returns an (n_sims, n_drivers) array of finishing positions (1-based)."""
    rng = rng or np.random.default_rng(0)
    gumbel = rng.gumbel(size=(n_sims, len(scores)))
    order = np.argsort(-(scores / temperature + gumbel), axis=1)
    positions = np.empty_like(order)
    rows = np.arange(n_sims)[:, None]
    positions[rows, order] = np.arange(1, len(scores) + 1)
    return positions


def outcome_probabilities(
    scores: np.ndarray, temperature: float, n_sims: int = 20_000, seed: int = 0
) -> dict[str, np.ndarray]:
    """Win / podium / points probabilities and expected finishing position."""
    pos = simulate(scores, temperature, n_sims, np.random.default_rng(seed))
    return {
        "p_win": (pos == 1).mean(axis=0),
        "p_podium": (pos <= 3).mean(axis=0),
        "p_points": (pos <= 10).mean(axis=0),
        "exp_pos": pos.mean(axis=0),
    }


def win_probabilities(scores: np.ndarray, temperature: float) -> np.ndarray:
    """Exact P(win), a softmax, with no simulation needed."""
    z = scores / temperature
    z = z - z.max()
    e = np.exp(z)
    return e / e.sum()
