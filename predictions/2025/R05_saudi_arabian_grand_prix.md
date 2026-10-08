# 2025 Saudi Arabian Grand Prix (Round 5)

**Model:** `v2_form_gbm`, LightGBM regressor + driver/team rolling form  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | PIA | McLaren | 2 | 25.2% | 65.6% | 99.9% | 3.1 | 1 |
| 2 | VER | Red Bull | 1 | 19.4% | 54.3% | 99.6% | 3.6 | 2 |
| 3 | RUS | Mercedes | 3 | 13.6% | 41.2% | 98.7% | 4.4 | 5 |
| 4 | LEC | Ferrari | 4 | 10.3% | 32.9% | 96.9% | 5.1 | 3 |
| 5 | ANT | Mercedes | 5 | 7.9% | 26.5% | 94.7% | 5.7 | 6 |
| 6 | NOR | McLaren | 10 | 6.9% | 22.6% | 91.8% | 6.2 | 4 |
| 7 | HAM | Ferrari | 7 | 4.4% | 15.2% | 83.4% | 7.3 | 7 |
| 8 | SAI | Williams | 6 | 4.2% | 14.0% | 80.3% | 7.6 | 8 |
| 9 | TSU | Red Bull | 8 | 2.0% | 6.2% | 50.3% | 10.1 | 19 |
| 10 | GAS | Alpine F1 Team | 9 | 1.6% | 5.6% | 48.9% | 10.3 | 20 |
| 11 | BEA | Haas F1 Team | 15 | 0.8% | 2.5% | 23.6% | 13.0 | 13 |
| 12 | ALB | Williams | 11 | 0.8% | 2.4% | 22.5% | 13.3 | 9 |
| 13 | ALO | Aston Martin | 13 | 0.5% | 1.8% | 18.5% | 13.9 | 11 |
| 14 | HAD | RB F1 Team | 14 | 0.7% | 2.0% | 18.3% | 14.0 | 10 |
| 15 | LAW | RB F1 Team | 12 | 0.4% | 1.6% | 15.2% | 14.6 | 12 |
| 16 | HUL | Sauber | 18 | 0.3% | 1.6% | 15.2% | 14.7 | 15 |
| 17 | DOO | Alpine F1 Team | 17 | 0.3% | 1.2% | 12.9% | 15.1 | 17 |
| 18 | OCO | Haas F1 Team | 19 | 0.3% | 1.2% | 13.3% | 15.1 | 14 |
| 19 | STR | Aston Martin | 16 | 0.2% | 0.9% | 9.2% | 16.2 | 16 |
| 20 | BOR | Sauber | 20 | 0.1% | 0.5% | 6.7% | 17.0 | 18 |

## How it went

- **Winner:** PIA (model gave 25.2%); favourite was PIA at 25.2%
- **Podium:** PIA, VER, LEC; predicted podium PIA, VER, RUS (2/3 correct)
- **Spearman ρ:** 0.788 · **NDCG@10:** 0.919 · **MAE:** 2.50 positions
