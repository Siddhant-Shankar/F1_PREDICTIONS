"""Leaderboard tables and figures generated from backtest output."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from f1pred.config import FIGURES_DIR, REPORTS_DIR  # noqa: E402
from f1pred.evaluation.backtest import SUMMARY_METRICS, summarise  # noqa: E402

INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"
SURFACE = "#fcfcfb"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
BASELINE = "#a3a29c"


def _style(ax):
    ax.set_facecolor(SURFACE)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GRID)
    ax.tick_params(colors=INK_2, labelsize=9)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def leaderboard_markdown(metrics: pd.DataFrame) -> str:
    table = summarise(metrics)
    lines = ["| Model | Races | " + " | ".join(SUMMARY_METRICS.values()) + " |"]
    lines.append("|---|---:|" + "---:|" * len(SUMMARY_METRICS))
    for name, row in table.iterrows():
        cells = [f"{row[m]:.3f}" for m in SUMMARY_METRICS]
        lines.append(f"| `{name}` | {int(row['races'])} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def plot_leaderboard(metrics: pd.DataFrame, path=None) -> None:
    """One small panel per headline metric, a bar per model version."""
    table = summarise(metrics)
    panels = [
        ("spearman", "Spearman ρ  (higher is better)"),
        ("podium_hits", "Podium overlap  (higher is better)"),
        ("win_logloss", "Winner log-loss  (lower is better)"),
    ]
    fig, axes = plt.subplots(1, 3, figsize=(13, 3.8), facecolor=SURFACE)
    x = np.arange(len(table))
    for ax, (col, title) in zip(axes, panels, strict=True):
        _style(ax)
        vals = table[col].to_numpy()
        colors = [BASELINE] * (len(vals) - 1) + [SERIES[0]]
        ax.bar(x, vals, width=0.6, color=colors, edgecolor=SURFACE, linewidth=2)
        for xi, v in zip(x, vals, strict=True):
            ax.text(xi, v, f"{v:.3f}", ha="center", va="bottom", fontsize=8, color=INK_2)
        ax.set_xticks(x, [n.split("_", 1)[0] for n in table.index])
        ax.set_title(title, loc="left", fontsize=10, color=INK)
        lo = 0 if col != "win_logloss" else max(0, vals.min() * 0.85)
        ax.set_ylim(lo, vals.max() * 1.12)
    fig.suptitle("Walk-forward backtest by model version", x=0.01, ha="left", color=INK)
    fig.tight_layout()
    fig.savefig(path or FIGURES_DIR / "leaderboard.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def plot_over_time(metrics: pd.DataFrame, models: list[str], window: int = 8, path=None) -> None:
    """Rolling per-race Spearman, race by race across the test window."""
    fig, ax = plt.subplots(figsize=(12, 4), facecolor=SURFACE)
    _style(ax)
    for i, name in enumerate(models):
        m = metrics[metrics["model"] == name].sort_values("race_idx")
        roll = m["spearman"].rolling(window, min_periods=3).mean()
        color = BASELINE if name.startswith("v0") else SERIES[i % len(SERIES)]
        ax.plot(np.arange(len(m)), roll, color=color, linewidth=2, label=name)
        ax.text(len(m) - 0.5, roll.iloc[-1], f" {name}", color=INK_2, fontsize=8, va="center")
    m0 = metrics[metrics["model"] == models[0]].sort_values("race_idx").reset_index(drop=True)
    starts = m0.index[m0["season"] != m0["season"].shift()].tolist()
    for s in starts:
        ax.axvline(s, color=GRID, linewidth=1)
        ax.text(
            s + 0.3, ax.get_ylim()[1], str(m0.loc[s, "season"]), color=INK_2, fontsize=9, va="top"
        )
    ax.set_ylabel(f"Spearman ρ ({window}-race rolling mean)", color=INK_2, fontsize=9)
    ax.set_xlabel("Race (walk-forward order)", color=INK_2, fontsize=9)
    ax.legend(frameon=False, fontsize=8, loc="lower left")
    ax.set_xlim(0, len(m0) + 6)
    fig.tight_layout()
    fig.savefig(path or FIGURES_DIR / "over_time.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def plot_calibration(predictions: pd.DataFrame, model: str, path=None, bins: int = 10) -> None:
    """Reliability diagram: when we say 30% podium chance, does it happen 30% of the time?"""
    p = predictions[predictions["model"] == model]
    y = (p["finish_pos"] <= 3).astype(float)
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p["p_podium"], edges) - 1, 0, bins - 1)
    grouped = pd.DataFrame({"bin": idx, "p": p["p_podium"], "y": y}).groupby("bin")
    agg = grouped.agg(pred=("p", "mean"), obs=("y", "mean"), n=("y", "size"))
    agg = agg[agg["n"] >= 5]

    fig, ax = plt.subplots(figsize=(4.6, 4.4), facecolor=SURFACE)
    _style(ax)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.plot([0, 1], [0, 1], color=BASELINE, linewidth=1, linestyle="--", label="perfect")
    ax.plot(
        agg["pred"],
        agg["obs"],
        color=SERIES[0],
        linewidth=2,
        marker="o",
        markersize=7,
        markeredgecolor=SURFACE,
        markeredgewidth=2,
        label=model,
    )
    ax.set_xlabel("Predicted podium probability", color=INK_2, fontsize=9)
    ax.set_ylabel("Observed podium frequency", color=INK_2, fontsize=9)
    ax.set_title("Podium calibration", loc="left", fontsize=10, color=INK)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    fig.tight_layout()
    fig.savefig(path or FIGURES_DIR / "calibration.png", dpi=150, facecolor=SURFACE)
    plt.close(fig)


def write_reports(metrics: pd.DataFrame, predictions: pd.DataFrame) -> str:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    metrics.to_csv(REPORTS_DIR / "backtest_metrics.csv", index=False)
    predictions.to_csv(REPORTS_DIR / "backtest_predictions.csv.gz", index=False)
    md = leaderboard_markdown(metrics)
    (REPORTS_DIR / "leaderboard.md").write_text(md + "\n", encoding="utf-8")

    models = list(dict.fromkeys(metrics["model"]))
    plot_leaderboard(metrics)
    plot_over_time(metrics, [models[0], models[-1]])
    plot_calibration(predictions, models[-1])
    return md
