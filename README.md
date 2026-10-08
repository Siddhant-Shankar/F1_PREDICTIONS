# F1 Race Predictions

Forecasting Formula 1 race results from qualifying, form and history, built up
race by race through the 2025 season.

Started as two single-race scripts (Australia and China 2025, now in `legacy/`)
and is being rebuilt as a proper package:

```bash
pip install -e ".[dev]"
python -m f1pred ingest      # every race since the 2022 regulation reset
```
