"""Project-wide paths and constants."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CACHE_DIR = ROOT / "cache"
REPORTS_DIR = ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"
ARTIFACTS_DIR = ROOT / "artifacts"

RESULTS_PATH = DATA_DIR / "processed" / "results.parquet"

# Ground-effect era onwards: the 2022 regulation reset makes older seasons a poor
# guide to current car performance.
DEFAULT_SEASONS = (2022, 2023, 2024, 2025, 2026)

# Constructors that were renamed but are the same organisation (same factory,
# staff, and largely the same car lineage). Mapping them to one key lets team
# form carry across seasons instead of resetting on every rebrand.
TEAM_LINEAGE = {
    "alphatauri": "rb",
    "rb": "rb",
    "racing_bulls": "rb",
    "alfa": "sauber",
    "sauber": "sauber",
    "kick_sauber": "sauber",
    "audi": "sauber",
    "alpine": "alpine",
    "aston_martin": "aston_martin",
}

# Points for finishing positions 1-10 (fastest-lap point dropped from 2025).
POINTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
