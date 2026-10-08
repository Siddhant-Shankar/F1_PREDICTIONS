"""SHAP explanations: which features drive the model's ranking, and for whom."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from f1pred.config import FIGURES_DIR  # noqa: E402


def shap_values(model, frame: pd.DataFrame):
    """TreeSHAP values for a fitted LightGBM-based model from the zoo."""
    import shap

    explainer = shap.TreeExplainer(model.model)
    return explainer(frame[model.features])


def plot_global_importance(model, train: pd.DataFrame, path=None) -> pd.Series:
    """Mean |SHAP| per feature over the training set, as a horizontal bar chart."""
    sv = shap_values(model, train)
    importance = (
        pd.DataFrame(abs(sv.values), columns=model.features).mean().sort_values(ascending=True)
    )
    fig, ax = plt.subplots(figsize=(7, 0.32 * len(importance) + 1), facecolor="#fcfcfb")
    ax.set_facecolor("#fcfcfb")
    ax.barh(importance.index, importance.values, color="#2a78d6", height=0.6)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.tick_params(colors="#52514e", labelsize=9)
    ax.set_xlabel("mean |SHAP value| (impact on ranking score)", color="#52514e", fontsize=9)
    ax.set_title("What the model looks at", loc="left", fontsize=10, color="#0b0b0b")
    fig.tight_layout()
    fig.savefig(path or FIGURES_DIR / "shap_importance.png", dpi=150, facecolor="#fcfcfb")
    plt.close(fig)
    return importance.sort_values(ascending=False)


def explain_driver(model, race: pd.DataFrame, driver: str, top: int = 5) -> pd.Series:
    """Top feature contributions for one driver in one race (positive = helps)."""
    sv = shap_values(model, race)
    row = race.reset_index(drop=True).index[race["driver"].to_numpy() == driver][0]
    contrib = pd.Series(sv.values[row], index=model.features)
    return contrib.reindex(contrib.abs().sort_values(ascending=False).index).head(top)
