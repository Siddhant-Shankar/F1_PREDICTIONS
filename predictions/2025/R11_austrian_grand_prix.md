# 2025 Austrian Grand Prix (Round 11)

**Model:** `v6_ensemble`, Blend: 50% finishers-only ranker, 25% regressor, 25% grid  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | NOR | McLaren | 1 | 40.6% | 83.2% | 100.0% | 2.2 | 1 |
| 2 | LEC | Ferrari | 2 | 14.6% | 47.5% | 99.6% | 3.9 | 3 |
| 3 | PIA | McLaren | 3 | 10.5% | 38.7% | 98.8% | 4.5 | 2 |
| 4 | HAM | Ferrari | 4 | 9.1% | 32.4% | 98.0% | 4.9 | 4 |
| 5 | RUS | Mercedes | 5 | 8.2% | 30.6% | 97.7% | 5.1 | 5 |
| 6 | VER | Red Bull | 7 | 6.2% | 23.2% | 94.6% | 5.9 | 18 |
| 7 | ANT | Mercedes | 9 | 3.0% | 11.4% | 77.4% | 7.9 | 19 |
| 8 | LAW | RB F1 Team | 6 | 1.8% | 7.1% | 60.8% | 9.3 | 6 |
| 9 | BOR | Sauber | 8 | 1.2% | 5.1% | 47.4% | 10.5 | 8 |
| 10 | GAS | Alpine F1 Team | 10 | 1.0% | 4.2% | 43.7% | 10.9 | 13 |
| 11 | ALO | Aston Martin | 11 | 0.7% | 3.3% | 33.7% | 11.9 | 7 |
| 12 | ALB | Williams | 12 | 0.8% | 3.1% | 31.4% | 12.2 | 17 |
| 13 | HAD | RB F1 Team | 13 | 0.5% | 2.1% | 22.2% | 13.4 | 12 |
| 14 | TSU | Red Bull | 18 | 0.4% | 1.5% | 16.6% | 14.6 | 16 |
| 15 | BEA | Haas F1 Team | 15 | 0.3% | 1.4% | 15.7% | 14.8 | 11 |
| 16 | COL | Alpine F1 Team | 14 | 0.3% | 1.2% | 14.8% | 15.0 | 15 |
| 17 | OCO | Haas F1 Team | 17 | 0.3% | 1.3% | 13.6% | 15.3 | 10 |
| 18 | SAI | Williams | 19 | 0.2% | 1.0% | 12.3% | 15.6 | 20 |
| 19 | STR | Aston Martin | 16 | 0.3% | 0.9% | 11.5% | 15.8 | 14 |
| 20 | HUL | Sauber | 20 | 0.2% | 0.7% | 10.1% | 16.1 | 9 |

## How it went

- **Winner:** NOR (model gave 40.6%); favourite was NOR at 40.6%
- **Podium:** NOR, PIA, LEC; predicted podium NOR, LEC, PIA (3/3 correct)
- **Spearman ρ:** 0.574 · **NDCG@10:** 0.889 · **MAE:** 3.70 positions
