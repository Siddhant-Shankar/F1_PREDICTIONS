"""Command-line entry point: ``python -m f1pred <command>``."""

from __future__ import annotations

import argparse
import logging
import sys

from f1pred.config import DEFAULT_SEASONS


def _seasons(text: str) -> list[int]:
    if "-" in text:
        lo, hi = text.split("-")
        return list(range(int(lo), int(hi) + 1))
    return [int(s) for s in text.split(",")]


def cmd_ingest(args) -> None:
    from f1pred.data.ingest import ingest

    df = ingest(args.seasons, refresh=args.refresh)
    print(df.groupby("season")["round"].nunique().rename("races").to_string())


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="f1pred", description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("ingest", help="download race weekends via FastF1")
    p.add_argument("--seasons", type=_seasons, default=list(DEFAULT_SEASONS))
    p.add_argument("--refresh", action="store_true", help="re-download everything")
    p.set_defaults(func=cmd_ingest)

    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s"
    )
    args.func(args)


if __name__ == "__main__":
    main()
