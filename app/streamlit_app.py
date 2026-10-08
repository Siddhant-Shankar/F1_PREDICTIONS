"""Backtest explorer: `streamlit run app/streamlit_app.py`.

Reads the files written by `python -m f1pred backtest`; no model training here,
so it deploys on Streamlit Community Cloud with only the light dependencies in
app/requirements.txt.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

REPORTS = Path(__file__).resolve().parent.parent / "reports"
REPO_URL = "https://github.com/Siddhant-Shankar/F1_PREDICTIONS"

ACCENT = "#d1361f"
MUTED = "#b9b7b0"
INK_2 = "#52514e"
GRID = "#e4e3df"

VERSION_NOTES = {
    "v0_grid": "Starting grid",
    "v1_quali_linear": "+ qualifying pace (ridge)",
    "v2_form_gbm": "+ rolling form (LightGBM)",
    "v3_elo_gbm": "+ Elo and circuit history",
    "v4_lambdarank": "Learning to rank",
    "v5_rank_finishers": "Rank on finishers only",
    "v6_ensemble": "Ensemble",
}

st.set_page_config(page_title="F1 race forecasts", page_icon="🏁", layout="wide")


def _layout(fig: go.Figure, height: int) -> go.Figure:
    fig.update_layout(
        height=height,
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Mona Sans, sans-serif", color=INK_2, size=12),
        legend=dict(orientation="h", y=-0.18, x=0),
    )
    fig.update_xaxes(gridcolor=GRID, zeroline=False)
    fig.update_yaxes(gridcolor=GRID, zeroline=False)
    return fig


@st.cache_data
def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    metrics = pd.read_csv(REPORTS / "backtest_metrics.csv")
    preds = pd.read_csv(REPORTS / "backtest_predictions.csv.gz")
    return metrics, preds


if not (REPORTS / "backtest_metrics.csv").exists():
    st.error("No backtest found. Run `python -m f1pred backtest` first.")
    st.stop()

metrics, preds = load()
models = list(dict.fromkeys(metrics["model"]))
n_races = metrics["race_id"].nunique()

st.title("F1 race forecasts")
st.markdown(
    f"Every race from {metrics['season'].min()} to {metrics['season'].max()} "
    f"({n_races} Grands Prix) predicted **using only the races before it**. "
    "A learning-to-rank model scores the grid, and 10,000 Plackett-Luce race "
    f"simulations turn the scores into probabilities. [Code and methodology]({REPO_URL})"
)

final = metrics[metrics["model"] == models[-1]]
base = metrics[metrics["model"] == models[0]]
k1, k2, k3, k4 = st.columns(4)
k1.metric("Races backtested", n_races)
k2.metric(
    "Favourite won",
    f"{final['winner_hit'].mean():.0%}",
    f"{final['winner_hit'].mean() - base['winner_hit'].mean():+.0%} vs grid",
)
k3.metric(
    "Rank correlation",
    f"{final['spearman'].mean():.3f}",
    f"{final['spearman'].mean() - base['spearman'].mean():+.3f} vs grid",
)
k4.metric(
    "Winner log-loss",
    f"{final['win_logloss'].mean():.2f}",
    f"{final['win_logloss'].mean() - base['win_logloss'].mean():+.2f} vs grid",
    delta_color="inverse",
)

race_tab, versions_tab, time_tab = st.tabs(["Race explorer", "Model versions", "Race by race"])

# --------------------------------------------------------------------------- race
with race_tab:
    c1, c2, c3 = st.columns([2, 1, 2])
    model = c1.selectbox(
        "Model",
        models,
        index=len(models) - 1,
        format_func=lambda m: f"{m}: {VERSION_NOTES.get(m, '')}",
    )
    seasons = sorted(metrics["season"].unique(), reverse=True)
    season = c2.selectbox("Season", seasons)
    races = metrics[(metrics["model"] == model) & (metrics["season"] == season)]
    races = races.sort_values("round", ascending=False)
    event = c3.selectbox(
        "Race", races["event"].tolist(), format_func=lambda e: e.replace(" Grand Prix", " GP")
    )

    race_m = races[races["event"] == event].iloc[0]
    race_p = preds[(preds["model"] == model) & (preds["race_id"] == race_m["race_id"])]
    race_p = race_p.assign(pred=race_p["score"].rank(ascending=False, method="first").astype(int))
    race_p = race_p.sort_values("pred")

    winner = race_p.loc[race_p["finish_pos"] == 1].iloc[0]
    fav = race_p.iloc[0]
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Favourite", fav["driver"], f"{fav['p_win']:.0%} to win", delta_color="off")
    m2.metric("Winner", winner["driver"], f"model gave {winner['p_win']:.0%}", delta_color="off")
    m3.metric("Podium picked", f"{round(race_m['podium_hits'] * 3)}/3")
    m4.metric("Rank correlation", f"{race_m['spearman']:.3f}")

    left, right = st.columns([3, 2])
    with left:
        st.markdown("**Win and podium probability**, top 10 by model score")
        top = race_p.head(10).iloc[::-1]
        fig = go.Figure()
        fig.add_bar(
            y=top["driver"],
            x=top["p_podium"],
            name="P(podium)",
            orientation="h",
            marker_color=MUTED,
            hovertemplate="%{y}: %{x:.1%} podium<extra></extra>",
        )
        fig.add_bar(
            y=top["driver"],
            x=top["p_win"],
            name="P(win)",
            orientation="h",
            marker_color=ACCENT,
            hovertemplate="%{y}: %{x:.1%} win<extra></extra>",
        )
        fig.update_layout(barmode="overlay", bargap=0.35)
        fig.update_xaxes(tickformat=".0%", range=[0, 1])
        st.plotly_chart(_layout(fig, 400), width="stretch")
    with right:
        st.markdown("**Predicted vs actual**")
        table = race_p[
            ["pred", "driver", "team_name", "grid", "finish_pos", "p_win", "p_podium"]
        ].rename(
            columns={
                "pred": "Pred",
                "driver": "Driver",
                "team_name": "Team",
                "grid": "Grid",
                "finish_pos": "Actual",
                "p_win": "P(win)",
                "p_podium": "P(podium)",
            }
        )
        st.dataframe(
            table,
            hide_index=True,
            height=400,
            column_config={
                "P(win)": st.column_config.ProgressColumn(
                    format="percent", min_value=0, max_value=1
                ),
                "P(podium)": st.column_config.ProgressColumn(
                    format="percent", min_value=0, max_value=1
                ),
                "Grid": st.column_config.NumberColumn(format="%d"),
                "Actual": st.column_config.NumberColumn(format="%d"),
            },
        )
    st.caption(
        f"Trained on races before this one. Plackett-Luce temperature "
        f"{race_m['temperature']:.2f}, fitted on earlier out-of-sample predictions."
    )

# ----------------------------------------------------------------------- versions
with versions_tab:
    st.markdown(
        "Each version adds one idea, and all of them are scored on the same "
        f"{n_races}-race walk-forward backtest."
    )
    summary = (
        metrics.groupby("model")[
            ["spearman", "ndcg10", "winner_hit", "podium_hits", "mae_pos", "win_logloss"]
        ]
        .mean()
        .loc[models]
    )
    metric = st.radio(
        "Metric",
        ["spearman", "winner_hit", "podium_hits", "win_logloss"],
        horizontal=True,
        format_func={
            "spearman": "Rank correlation ↑",
            "winner_hit": "Favourite won ↑",
            "podium_hits": "Podium overlap ↑",
            "win_logloss": "Winner log-loss ↓",
        }.get,
    )
    best = summary[metric].idxmin() if metric == "win_logloss" else summary[metric].idxmax()
    fig = go.Figure(
        go.Bar(
            x=[f"{m.split('_', 1)[0]}<br>{VERSION_NOTES.get(m, '')}" for m in summary.index],
            y=summary[metric],
            marker_color=[ACCENT if m == best else MUTED for m in summary.index],
            text=summary[metric].map("{:.3f}".format),
            textposition="outside",
            hovertemplate="%{x}: %{y:.3f}<extra></extra>",
        )
    )
    lo = summary[metric].min()
    fig.update_yaxes(range=[lo * 0.9, summary[metric].max() * 1.04])
    st.plotly_chart(_layout(fig, 380), width="stretch")
    st.dataframe(
        summary.rename(
            columns={
                "spearman": "Rank corr.",
                "ndcg10": "NDCG@10",
                "winner_hit": "Favourite won",
                "podium_hits": "Podium overlap",
                "mae_pos": "MAE (pos)",
                "win_logloss": "Winner log-loss",
            }
        ).style.format("{:.3f}"),
        width="stretch",
    )

# --------------------------------------------------------------------------- time
with time_tab:
    window = st.slider("Rolling window (races)", 1, 15, 8)
    compare = st.multiselect("Models", models, default=[models[0], models[-1]])
    fig = go.Figure()
    for name in compare:
        m = metrics[metrics["model"] == name].sort_values("race_idx")
        fig.add_scatter(
            x=m["race_id"],
            y=m["spearman"].rolling(window, min_periods=1).mean(),
            name=name,
            mode="lines",
            line=dict(width=2, color=MUTED if name == models[0] else None),
            customdata=m["event"],
            hovertemplate="%{customdata}<br>%{y:.3f}<extra>" + name + "</extra>",
        )
    fig.update_layout(hovermode="x unified", colorway=[ACCENT, "#2a78d6", "#1baf7a", "#eda100"])
    fig.update_yaxes(title_text=f"Rank correlation ({window}-race mean)")
    st.plotly_chart(_layout(fig, 380), width="stretch")
    st.caption(
        "Single races are noisy (one safety car can swing the result), so judge "
        "model versions on the rolling average, not on one weekend."
    )
