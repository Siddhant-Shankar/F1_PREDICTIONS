"""Smoke test: the dashboard renders against the committed backtest output."""

from pathlib import Path

import pytest

st_testing = pytest.importorskip("streamlit.testing.v1")

APP = Path(__file__).resolve().parent.parent / "app" / "streamlit_app.py"


def test_dashboard_renders_without_errors():
    at = st_testing.AppTest.from_file(str(APP), default_timeout=60).run()
    assert not at.exception
    assert at.title[0].value == "F1 race forecasts"
    assert len(at.tabs) == 3


def test_switching_model_and_race():
    at = st_testing.AppTest.from_file(str(APP), default_timeout=60).run()
    at.selectbox[0].select("v0_grid").run()
    at.selectbox[1].select(2025).run()
    assert not at.exception
