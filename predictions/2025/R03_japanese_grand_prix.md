# 2025 Japanese Grand Prix (Round 3)

**Model:** `v0_grid`, Baseline: predicted order = starting grid  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | VER | Red Bull | 1 | 21.8% | 57.3% | 99.2% | 3.5 | 1 |
| 2 | NOR | McLaren | 2 | 18.1% | 48.6% | 98.8% | 4.0 | 2 |
| 3 | PIA | McLaren | 3 | 12.8% | 40.2% | 97.0% | 4.7 | 3 |
| 4 | LEC | Ferrari | 4 | 10.5% | 33.5% | 94.6% | 5.3 | 4 |
| 5 | RUS | Mercedes | 5 | 8.2% | 26.4% | 90.7% | 6.0 | 5 |
| 6 | ANT | Mercedes | 6 | 6.6% | 21.2% | 85.1% | 6.7 | 6 |
| 7 | HAD | RB F1 Team | 7 | 5.3% | 16.8% | 77.2% | 7.5 | 8 |
| 8 | HAM | Ferrari | 8 | 4.1% | 12.9% | 67.5% | 8.4 | 7 |
| 9 | ALB | Williams | 9 | 2.7% | 9.8% | 59.2% | 9.2 | 9 |
| 10 | BEA | Haas F1 Team | 10 | 2.5% | 8.2% | 48.8% | 10.1 | 10 |
| 11 | GAS | Alpine F1 Team | 11 | 1.7% | 6.0% | 40.6% | 10.9 | 13 |
| 12 | ALO | Aston Martin | 12 | 1.4% | 4.7% | 33.1% | 11.8 | 11 |
| 13 | LAW | RB F1 Team | 13 | 1.1% | 3.8% | 26.3% | 12.7 | 17 |
| 14 | TSU | Red Bull | 14 | 0.9% | 2.9% | 21.7% | 13.4 | 12 |
| 15 | SAI | Williams | 15 | 0.6% | 2.2% | 17.0% | 14.2 | 14 |
| 16 | HUL | Sauber | 16 | 0.5% | 1.6% | 13.3% | 15.0 | 16 |
| 17 | BOR | Sauber | 17 | 0.4% | 1.2% | 10.3% | 15.7 | 19 |
| 18 | OCO | Haas F1 Team | 18 | 0.3% | 1.2% | 8.2% | 16.4 | 18 |
| 19 | DOO | Alpine F1 Team | 19 | 0.3% | 0.9% | 6.7% | 16.9 | 15 |
| 20 | STR | Aston Martin | 20 | 0.2% | 0.7% | 4.9% | 17.5 | 20 |

## How it went

- **Winner:** VER (model gave 21.8%); favourite was VER at 21.8%
- **Podium:** VER, NOR, PIA; predicted podium VER, NOR, PIA (3/3 correct)
- **Spearman ρ:** 0.964 · **NDCG@10:** 1.000 · **MAE:** 0.90 positions
