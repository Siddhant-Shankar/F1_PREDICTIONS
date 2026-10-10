"""Command-line entry point: ``python -m f1pred <command>``."""

from __future__ import annotations

import argparse
import logging
import sys

import pandas as pd

from f1pred.config import DEFAULT_SEASONS, RESULTS_PATH


def _seasons(text: str) -> list[int]:
    if "-" in text:
        lo, hi = text.split("-")
        return list(range(int(lo), int(hi) + 1))
    return [int(s) for s in text.split(",")]


def _features() -> pd.DataFrame:
    from f1pred.features.build import build_features

    if not RESULTS_PATH.exists():
        raise SystemExit(f"{RESULTS_PATH} not found; run `python -m f1pred ingest` first")
    return build_features(pd.read_parquet(RESULTS_PATH))


def cmd_ingest(args) -> None:
    from f1pred.data.ingest import ingest

    df = ingest(args.seasons, refresh=args.refresh)
    print(df.groupby("season")["round"].nunique().rename("races").to_string())


def _backtest_one(name: str, start: int):
    from f1pred.evaluation.backtest import walk_forward
    from f1pred.models.zoo import get_zoo

    return walk_forward(_features(), get_zoo()[name], start_season=start)


def cmd_backtest(args) -> None:
    from concurrent.futures import ProcessPoolExecutor

    from f1pred.evaluation.report import write_reports
    from f1pred.models.zoo import get_zoo

    names = args.models or list(get_zoo())
    print(f"backtesting {', '.join(names)} ...")
    # Each model's walk-forward is independent, so run them in parallel.
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        results = list(pool.map(_backtest_one, names, [args.start] * len(names)))
    metrics = pd.concat([m for m, _ in results])
    preds = pd.concat([p for _, p in results])
    print(write_reports(metrics, preds))


def cmd_predict(args) -> None:
    from f1pred.models.zoo import get_zoo
    from f1pred.predict import write_race_report

    feats = _features()
    zoo = get_zoo()
    model = zoo[args.model or list(zoo)[-1]]
    summary = write_race_report(feats, model, args.season, args.round)
    print(f"wrote {summary['path']}")


def cmd_explain(args) -> None:
    from f1pred.explain import plot_global_importance
    from f1pred.models.zoo import get_zoo

    feats = _features()
    model = get_zoo()[args.model].fit(feats)
    importance = plot_global_importance(model, feats)
    print(importance.round(4).to_string())


def cmd_export_web(args) -> None:
    from f1pred.export import export_web

    export_web(args.season, args.rounds)
    print("wrote web/public/data")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="f1pred", description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("ingest", help="download race weekends via FastF1")
    p.add_argument("--seasons", type=_seasons, default=list(DEFAULT_SEASONS))
    p.add_argument("--refresh", action="store_true", help="re-download everything")
    p.set_defaults(func=cmd_ingest)

    p = sub.add_parser("backtest", help="walk-forward backtest of the model zoo")
    p.add_argument("--models", nargs="*")
    p.add_argument("--start", type=int, default=2023, help="first season to evaluate")
    p.add_argument("--jobs", type=int, default=None, help="parallel workers (default: all cores)")
    p.set_defaults(func=cmd_backtest)

    p = sub.add_parser("predict", help="forecast one race and write a race report")
    p.add_argument("season", type=int)
    p.add_argument("round", type=int)
    p.add_argument("--model", help="model version (default: latest)")
    p.set_defaults(func=cmd_predict)

    p = sub.add_parser("explain", help="SHAP feature importance for a tree model")
    p.add_argument("--model", default="v5_rank_finishers")
    p.set_defaults(func=cmd_explain)

    p = sub.add_parser("export-web", help="export forecasts and 3D replays for the web app")
    p.add_argument("--season", type=int, default=2026)
    p.add_argument("--rounds", type=int, nargs="*", help="default: every backtested round")
    p.set_defaults(func=cmd_export_web)

    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s"
    )
    args.func(args)


if __name__ == "__main__":
    main()
