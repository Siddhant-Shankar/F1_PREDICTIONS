"""Backtest explorer: `streamlit run app/streamlit_app.py`.

Reads the files written by `python -m f1pred backtest`; no model training here.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

REPORTS = Path(__file__).resolve().parent.parent / "reports"
ACCENT = "#2a78d6"
MUTED = "#a3a29c"

st.set_page_config(page_title="f1pred backtest", layout="wide")


@st.cache_data
def load():
    metrics = pd.read_csv(REPORTS / "backtest_metrics.csv")
    preds = pd.read_csv(REPORTS / "backtest_predictions.csv.gz")
    return metrics, preds


if not (REPORTS / "backtest_metrics.csv").exists():
    st.error("No backtest found. Run `python -m f1pred backtest` first.")
    st.stop()

metrics, preds = load()
models = list(dict.fromkeys(metrics["model"]))

with st.sidebar:
    model = st.selectbox("Model", models, index=len(models) - 1)
    season = st.selectbox("Season", sorted(metrics["season"].unique(), reverse=True))
    races = metrics[(metrics["model"] == model) & (metrics["season"] == season)]
    event = st.selectbox("Race", races.sort_values("round")["event"].tolist()[::-1])

race_m = races[races["event"] == event].iloc[0]
race_p = preds[(preds["model"] == model) & (preds["race_id"] == race_m["race_id"])]
race_p = race_p.sort_values("p_win", ascending=False)

st.title(f"{season} {event}")
st.caption(
    f"`{model}` · trained only on races before this one · "
    f"Plackett-Luce temperature {race_m['temperature']:.2f}"
)

c1, c2, c3, c4 = st.columns(4)
winner = race_p.loc[race_p["finish_pos"] == 1].iloc[0]
c1.metric("Winner", winner["driver"], f"model gave {winner['p_win']:.0%}", delta_color="off")
c2.metric("Podium picked", f"{round(race_m['podium_hits'] * 3)}/3")
c3.metric("Spearman ρ", f"{race_m['spearman']:.3f}")
c4.metric("MAE", f"{race_m['mae_pos']:.2f} pos")

left, right = st.columns([3, 2])
with left:
    st.subheader("Win and podium probability")
    top = race_p.head(10).iloc[::-1]
    fig = go.Figure()
    fig.add_bar(
        y=top["driver"], x=top["p_podium"], name="P(podium)", orientation="h", marker_color=MUTED
    )
    fig.add_bar(
        y=top["driver"], x=top["p_win"], name="P(win)", orientation="h", marker_color=ACCENT
    )
    fig.update_layout(
        barmode="overlay",
        height=380,
        margin=dict(l=0, r=0, t=10, b=0),
        xaxis_tickformat=".0%",
        legend=dict(orientation="h", y=-0.15),
    )
    st.plotly_chart(fig, use_container_width=True)
with right:
    st.subheader("Predicted vs actual")
    table = race_p.assign(pred=race_p["score"].rank(ascending=False).astype(int))
    table = table.sort_values("pred")[
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
        table.style.format(
            {"P(win)": "{:.1%}", "P(podium)": "{:.1%}", "Grid": "{:.0f}", "Actual": "{:.0f}"}
        ),
        hide_index=True,
        height=380,
    )

st.subheader("Model versions over the whole backtest")
summary = (
    metrics.groupby("model")[["spearman", "winner_hit", "podium_hits", "mae_pos", "win_logloss"]]
    .mean()
    .loc[models]
)
st.dataframe(summary.style.format("{:.3f}"), use_container_width=True)

st.subheader("Race by race")
window = st.slider("Rolling window (races)", 1, 15, 8)
fig = go.Figure()
for name in [models[0], model]:
    m = metrics[metrics["model"] == name].sort_values("race_idx")
    fig.add_scatter(
        x=m["race_id"],
        y=m["spearman"].rolling(window, min_periods=1).mean(),
        name=name,
        mode="lines",
        line=dict(width=2, color=MUTED if name == models[0] else ACCENT),
    )
fig.update_layout(
    height=320,
    margin=dict(l=0, r=0, t=10, b=0),
    yaxis_title="Spearman ρ",
    hovermode="x unified",
    legend=dict(orientation="h", y=-0.25),
)
st.plotly_chart(fig, use_container_width=True)
