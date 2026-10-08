# 2025 Miami Grand Prix (Round 6)

**Model:** `v3_elo_gbm`, + driver/team Elo ratings and circuit history  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | NOR | McLaren | 2 | 22.3% | 59.0% | 99.9% | 3.3 | 2 |
| 2 | PIA | McLaren | 4 | 18.3% | 52.4% | 99.6% | 3.7 | 1 |
| 3 | VER | Red Bull | 1 | 17.1% | 49.6% | 99.4% | 3.9 | 4 |
| 4 | RUS | Mercedes | 5 | 11.1% | 35.1% | 97.7% | 4.9 | 3 |
| 5 | ANT | Mercedes | 3 | 9.9% | 29.8% | 96.2% | 5.3 | 6 |
| 6 | LEC | Ferrari | 8 | 6.0% | 20.2% | 90.4% | 6.4 | 7 |
| 7 | SAI | Williams | 6 | 3.6% | 12.2% | 75.7% | 8.0 | 9 |
| 8 | HAM | Ferrari | 12 | 2.9% | 9.6% | 66.9% | 8.7 | 8 |
| 9 | ALB | Williams | 7 | 2.3% | 8.0% | 60.8% | 9.2 | 5 |
| 10 | OCO | Haas F1 Team | 9 | 1.9% | 7.3% | 55.5% | 9.6 | 12 |
| 11 | TSU | Red Bull | 10 | 1.4% | 5.5% | 48.2% | 10.3 | 10 |
| 12 | HAD | RB F1 Team | 11 | 0.5% | 2.3% | 24.0% | 12.8 | 11 |
| 13 | ALO | Aston Martin | 17 | 0.6% | 1.6% | 16.8% | 14.0 | 15 |
| 14 | GAS | Alpine F1 Team | 20 | 0.4% | 1.3% | 11.1% | 15.3 | 13 |
| 15 | LAW | RB F1 Team | 15 | 0.3% | 1.3% | 12.2% | 15.2 | 17 |
| 16 | HUL | Sauber | 16 | 0.4% | 1.1% | 10.6% | 15.4 | 14 |
| 17 | DOO | Alpine F1 Team | 14 | 0.3% | 0.9% | 10.2% | 15.6 | 20 |
| 18 | BOR | Sauber | 13 | 0.2% | 1.1% | 9.6% | 15.7 | 18 |
| 19 | BEA | Haas F1 Team | 19 | 0.3% | 0.9% | 9.2% | 15.9 | 19 |
| 20 | STR | Aston Martin | 18 | 0.2% | 0.7% | 6.3% | 16.9 | 16 |

## How it went

- **Winner:** PIA (model gave 18.3%); favourite was NOR at 22.3%
- **Podium:** PIA, NOR, RUS; predicted podium NOR, PIA, VER (2/3 correct)
- **Spearman ρ:** 0.947 · **NDCG@10:** 0.984 · **MAE:** 1.50 positions
