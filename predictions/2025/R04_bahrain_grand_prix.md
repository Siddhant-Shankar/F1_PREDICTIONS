# 2025 Bahrain Grand Prix (Round 4)

**Model:** `v1_quali_linear`, Ridge regression on grid + qualifying gap + teammate delta  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | PIA | McLaren | 1 | 24.8% | 61.8% | 99.9% | 3.2 | 1 |
| 2 | RUS | Mercedes | 3 | 17.6% | 50.8% | 99.3% | 3.9 | 2 |
| 3 | LEC | Ferrari | 2 | 13.9% | 42.7% | 98.2% | 4.4 | 4 |
| 4 | ANT | Mercedes | 5 | 10.6% | 33.2% | 96.1% | 5.1 | 11 |
| 5 | GAS | Alpine F1 Team | 4 | 8.2% | 25.9% | 91.9% | 5.9 | 7 |
| 6 | NOR | McLaren | 6 | 6.8% | 21.2% | 87.1% | 6.6 | 3 |
| 7 | VER | Red Bull | 7 | 4.7% | 15.1% | 77.6% | 7.6 | 6 |
| 8 | SAI | Williams | 8 | 3.1% | 11.3% | 66.9% | 8.5 | 19 |
| 9 | HAM | Ferrari | 9 | 2.7% | 9.9% | 61.4% | 9.0 | 5 |
| 10 | TSU | Red Bull | 10 | 1.9% | 7.4% | 52.4% | 9.8 | 9 |
| 11 | DOO | Alpine F1 Team | 11 | 1.4% | 5.2% | 41.6% | 10.9 | 14 |
| 12 | HAD | RB F1 Team | 12 | 1.2% | 3.9% | 31.5% | 12.0 | 13 |
| 13 | ALO | Aston Martin | 13 | 0.8% | 3.0% | 24.7% | 12.8 | 15 |
| 14 | OCO | Haas F1 Team | 14 | 0.7% | 2.3% | 18.5% | 13.7 | 8 |
| 15 | ALB | Williams | 15 | 0.4% | 1.8% | 16.2% | 14.1 | 12 |
| 16 | HUL | Sauber | 16 | 0.5% | 1.5% | 11.2% | 15.2 | 20 |
| 17 | LAW | RB F1 Team | 17 | 0.3% | 1.1% | 9.2% | 15.8 | 16 |
| 18 | BOR | Sauber | 18 | 0.2% | 0.9% | 7.0% | 16.6 | 18 |
| 19 | STR | Aston Martin | 19 | 0.2% | 0.6% | 5.2% | 17.1 | 17 |
| 20 | BEA | Haas F1 Team | 20 | 0.1% | 0.5% | 4.1% | 17.8 | 10 |

## How it went

- **Winner:** PIA (model gave 24.8%); favourite was PIA at 24.8%
- **Podium:** PIA, RUS, NOR; predicted podium PIA, RUS, LEC (2/3 correct)
- **Spearman ρ:** 0.713 · **NDCG@10:** 0.935 · **MAE:** 3.10 positions
