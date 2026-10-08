"""Per-race evaluation metrics.

Ranking quality and probability quality are measured separately: a model can
order the field well but be badly over-confident, or vice versa.
"""

from __future__ import annotations

import numpy as np
from scipy.stats import spearmanr

EPS = 1e-12


def predicted_positions(scores: np.ndarray) -> np.ndarray:
    """1-based predicted finishing position from scores (higher = better)."""
    order = np.argsort(-scores, kind="stable")
    pos = np.empty(len(scores), dtype=int)
    pos[order] = np.arange(1, len(scores) + 1)
    return pos


def ndcg_at_k(scores: np.ndarray, finish_pos: np.ndarray, k: int = 10) -> float:
    """NDCG@k with linear relevance (field_size + 1 - finish_pos)."""
    n = len(scores)
    rel = n + 1 - finish_pos
    order = np.argsort(-scores, kind="stable")[:k]
    discounts = 1.0 / np.log2(np.arange(2, k + 2))[: len(order)]
    dcg = float(np.sum(rel[order] * discounts))
    ideal = np.sort(rel)[::-1][:k]
    idcg = float(np.sum(ideal * discounts[: len(ideal)]))
    return dcg / idcg if idcg > 0 else 0.0


def race_metrics(
    scores: np.ndarray,
    finish_pos: np.ndarray,
    p_win: np.ndarray | None = None,
    p_podium: np.ndarray | None = None,
) -> dict[str, float]:
    finish_pos = np.asarray(finish_pos, dtype=float)
    pred = predicted_positions(scores)
    winner = finish_pos == 1
    podium = finish_pos <= 3
    out = {
        "spearman": float(spearmanr(pred, finish_pos).statistic),
        "ndcg10": ndcg_at_k(scores, finish_pos, 10),
        "winner_hit": float(winner[pred == 1].any()),
        "podium_hits": float(np.sum(podium & (pred <= 3)) / 3.0),
        "top10_hits": float(np.sum((finish_pos <= 10) & (pred <= 10)) / 10.0),
        "mae_pos": float(np.mean(np.abs(pred - finish_pos))),
    }
    if p_win is not None:
        out["win_logloss"] = float(-np.log(np.clip(p_win[winner], EPS, 1)).sum())
        out["win_brier"] = float(np.mean((p_win - winner) ** 2))
    if p_podium is not None:
        p = np.clip(p_podium, EPS, 1 - EPS)
        out["podium_brier"] = float(np.mean((p_podium - podium) ** 2))
        out["podium_logloss"] = float(-np.mean(podium * np.log(p) + (~podium) * np.log(1 - p)))
    return out
