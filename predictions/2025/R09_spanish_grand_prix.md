# 2025 Spanish Grand Prix (Round 9)

**Model:** `v6_ensemble`, Blend: 50% finishers-only ranker, 25% regressor, 25% grid  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | PIA | McLaren | 1 | 32.1% | 76.0% | 100.0% | 2.5 | 1 |
| 2 | NOR | McLaren | 2 | 24.3% | 66.2% | 100.0% | 3.0 | 2 |
| 3 | VER | Red Bull | 3 | 12.0% | 41.9% | 99.3% | 4.2 | 10 |
| 4 | RUS | Mercedes | 4 | 10.2% | 34.4% | 98.9% | 4.7 | 4 |
| 5 | LEC | Ferrari | 7 | 5.1% | 18.9% | 91.6% | 6.3 | 3 |
| 6 | HAM | Ferrari | 5 | 4.3% | 17.1% | 90.6% | 6.5 | 6 |
| 7 | ANT | Mercedes | 6 | 3.6% | 13.9% | 85.6% | 7.1 | 18 |
| 8 | GAS | Alpine F1 Team | 8 | 1.8% | 6.5% | 58.8% | 9.5 | 8 |
| 9 | HAD | RB F1 Team | 9 | 1.5% | 5.5% | 54.0% | 9.9 | 7 |
| 10 | ALO | Aston Martin | 10 | 1.3% | 4.7% | 45.6% | 10.6 | 9 |
| 11 | ALB | Williams | 11 | 0.9% | 3.6% | 40.2% | 11.1 | 19 |
| 12 | BOR | Sauber | 12 | 0.5% | 1.8% | 20.4% | 13.6 | 12 |
| 13 | SAI | Williams | 17 | 0.4% | 1.7% | 20.1% | 13.7 | 14 |
| 14 | LAW | RB F1 Team | 13 | 0.5% | 1.7% | 19.8% | 13.8 | 11 |
| 15 | BEA | Haas F1 Team | 14 | 0.3% | 1.1% | 16.8% | 14.3 | 17 |
| 16 | TSU | Red Bull | 19 | 0.4% | 1.5% | 17.5% | 14.2 | 13 |
| 17 | OCO | Haas F1 Team | 16 | 0.4% | 1.4% | 14.8% | 14.6 | 16 |
| 18 | HUL | Sauber | 15 | 0.3% | 1.0% | 15.2% | 14.6 | 5 |
| 19 | COL | Alpine F1 Team | 18 | 0.3% | 1.0% | 10.7% | 15.6 | 15 |

## How it went

- **Winner:** PIA (model gave 32.1%); favourite was PIA at 32.1%
- **Podium:** PIA, NOR, LEC; predicted podium PIA, NOR, VER (2/3 correct)
- **Spearman ρ:** 0.604 · **NDCG@10:** 0.922 · **MAE:** 3.05 positions
