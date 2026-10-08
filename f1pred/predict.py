"""Forecast a single race and write a markdown race report."""

from __future__ import annotations

import re

import numpy as np
import pandas as pd

from f1pred.config import ROOT
from f1pred.evaluation.backtest import walk_forward
from f1pred.evaluation.metrics import predicted_positions, race_metrics
from f1pred.models.zoo import Model

PREDICTIONS_DIR = ROOT / "predictions"
CALIBRATION_RACES = 30


def predict_race(features: pd.DataFrame, model: Model, season: int, rnd: int) -> pd.DataFrame:
    """Per-driver forecast for one race, trained only on races before it.

    Runs a short walk-forward over the preceding races first, so the
    Plackett-Luce temperature is calibrated on genuinely out-of-sample scores.
    """
    target = features[(features["season"] == season) & (features["round"] == rnd)]
    if target.empty:
        raise ValueError(f"no data for {season} round {rnd}")
    idx = int(target["race_idx"].iloc[0])
    window = features[features["race_idx"].between(idx - CALIBRATION_RACES, idx)]
    _, preds = walk_forward(
        features[features["race_idx"] <= idx],
        model,
        start_season=int(window["season"].min()),
        min_train_races=max(idx - CALIBRATION_RACES, 10),
    )
    out = preds[preds["race_id"] == target["race_id"].iloc[0]].copy()
    out["pred_pos"] = predicted_positions(out["score"].to_numpy())
    return out.sort_values("pred_pos").reset_index(drop=True)


def _slug(event: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", event.lower()).strip("_")


def race_report(pred: pd.DataFrame, model: Model) -> tuple[str, dict]:
    season, rnd, event = (
        int(pred["season"].iloc[0]),
        int(pred["round"].iloc[0]),
        pred["event"].iloc[0],
    )
    done = pred["finish_pos"].notna().all()

    lines = [
        f"# {season} {event} (Round {rnd})",
        "",
        f"**Model:** `{model.name}`, {model.description}  ",
        "Trained on every race before this one; probabilities from 10,000 Plackett-Luce "
        "simulations of the race.",
        "",
        "| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] |"
        + (" Actual |" if done else ""),
        "|---:|---|---|---:|---:|---:|---:|---:|" + ("---:|" if done else ""),
    ]
    for r in pred.itertuples(index=False):
        row = (
            f"| {r.pred_pos} | {r.driver} | {r.team_name} | {int(r.grid)} | {r.p_win:.1%} | "
            f"{r.p_podium:.1%} | {r.p_points:.1%} | {r.exp_pos:.1f} |"
        )
        if done:
            row += f" {int(r.finish_pos)} |"
        lines.append(row)

    summary: dict = {"season": season, "round": rnd, "event": event, "model": model.name}
    if done:
        m = race_metrics(
            pred["score"].to_numpy(),
            pred["finish_pos"].to_numpy(),
            pred["p_win"].to_numpy(),
            pred["p_podium"].to_numpy(),
        )
        winner = pred.loc[pred["finish_pos"] == 1, "driver"].iloc[0]
        p_winner = float(pred.loc[pred["finish_pos"] == 1, "p_win"].iloc[0])
        fav = pred.iloc[0]
        actual_podium = pred.sort_values("finish_pos")["driver"].head(3).tolist()
        summary.update(m, winner=winner, favourite=fav["driver"], p_winner=p_winner)
        lines += [
            "",
            "## How it went",
            "",
            f"- **Winner:** {winner} (model gave {p_winner:.1%}); favourite was "
            f"{fav['driver']} at {fav['p_win']:.1%}",
            f"- **Podium:** {', '.join(actual_podium)}; predicted podium "
            f"{', '.join(pred['driver'].head(3))} ({int(round(m['podium_hits'] * 3))}/3 correct)",
            f"- **Spearman ρ:** {m['spearman']:.3f} · **NDCG@10:** {m['ndcg10']:.3f} · "
            f"**MAE:** {m['mae_pos']:.2f} positions",
        ]
    return "\n".join(lines) + "\n", summary


def write_race_report(features: pd.DataFrame, model: Model, season: int, rnd: int) -> dict:
    pred = predict_race(features, model, season, rnd)
    text, summary = race_report(pred, model)
    out_dir = PREDICTIONS_DIR / str(season)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"R{rnd:02d}_{_slug(pred['event'].iloc[0])}.md"
    path.write_text(text, encoding="utf-8")
    summary["path"] = path.relative_to(PREDICTIONS_DIR.parent).as_posix()
    _update_scoreboard(season, summary)
    return summary


def _update_scoreboard(season: int, summary: dict) -> None:
    """Keep a running per-season table of how each race forecast did."""
    csv = PREDICTIONS_DIR / str(season) / "scoreboard.csv"
    board = pd.read_csv(csv) if csv.exists() else pd.DataFrame()
    board = (
        board[board.get("round", pd.Series(dtype=int)) != summary["round"]] if len(board) else board
    )
    board = pd.concat([board, pd.DataFrame([summary])], ignore_index=True).sort_values("round")
    board.to_csv(csv, index=False)

    lines = [
        f"# {season} race-by-race forecasts",
        "",
        "Each race was forecast using only data available before it, with the model "
        "version that existed at the time.",
        "",
        "| Rd | Race | Model | Favourite | Winner | P(winner) | Podium hits | Spearman ρ |",
        "|---:|---|---|---|---|---:|---:|---:|",
    ]
    for r in board.itertuples(index=False):
        if pd.isna(getattr(r, "spearman", np.nan)):
            continue
        name = r.event.replace(" Grand Prix", " GP")
        lines.append(
            f"| {r.round} | [{name}]({r.path.split('/')[-1]}) | `{r.model}` | {r.favourite} | "
            f"{r.winner} | {r.p_winner:.1%} | {int(round(r.podium_hits * 3))}/3 | "
            f"{r.spearman:.3f} |"
        )
    (PREDICTIONS_DIR / str(season) / "README.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
