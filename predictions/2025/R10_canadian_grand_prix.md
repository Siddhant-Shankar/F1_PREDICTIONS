# 2025 Canadian Grand Prix (Round 10)

**Model:** `v6_ensemble`, Blend: 50% finishers-only ranker, 25% regressor, 25% grid  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | RUS | Mercedes | 1 | 23.1% | 64.2% | 100.0% | 3.1 | 1 |
| 2 | PIA | McLaren | 3 | 22.3% | 61.4% | 99.9% | 3.2 | 4 |
| 3 | VER | Red Bull | 2 | 19.8% | 56.1% | 99.9% | 3.5 | 2 |
| 4 | NOR | McLaren | 7 | 8.8% | 28.2% | 97.2% | 5.3 | 18 |
| 5 | ANT | Mercedes | 4 | 7.1% | 24.3% | 96.0% | 5.7 | 3 |
| 6 | HAM | Ferrari | 5 | 5.0% | 16.9% | 89.2% | 6.7 | 6 |
| 7 | LEC | Ferrari | 8 | 4.5% | 15.6% | 87.6% | 6.9 | 5 |
| 8 | ALO | Aston Martin | 6 | 2.5% | 9.2% | 70.2% | 8.6 | 7 |
| 9 | ALB | Williams | 9 | 1.9% | 6.9% | 61.2% | 9.3 | 20 |
| 10 | HAD | RB F1 Team | 12 | 1.1% | 4.1% | 41.6% | 11.0 | 16 |
| 11 | COL | Alpine F1 Team | 10 | 0.5% | 1.9% | 22.6% | 13.2 | 13 |
| 12 | HUL | Sauber | 11 | 0.6% | 2.0% | 23.5% | 13.1 | 8 |
| 13 | TSU | Red Bull | 18 | 0.5% | 1.9% | 22.2% | 13.3 | 12 |
| 14 | SAI | Williams | 16 | 0.4% | 1.7% | 18.8% | 13.9 | 10 |
| 15 | OCO | Haas F1 Team | 14 | 0.4% | 1.4% | 16.4% | 14.4 | 9 |
| 16 | BEA | Haas F1 Team | 13 | 0.3% | 1.0% | 14.9% | 14.7 | 11 |
| 17 | BOR | Sauber | 15 | 0.3% | 1.1% | 10.8% | 15.7 | 14 |
| 18 | STR | Aston Martin | 17 | 0.3% | 0.8% | 9.8% | 16.0 | 17 |
| 19 | GAS | Alpine F1 Team | 20 | 0.2% | 0.7% | 9.8% | 16.0 | 15 |
| 20 | LAW | RB F1 Team | 19 | 0.2% | 0.8% | 8.6% | 16.3 | 19 |

## How it went

- **Winner:** RUS (model gave 23.1%); favourite was RUS at 23.1%
- **Podium:** RUS, VER, ANT; predicted podium RUS, PIA, VER (2/3 correct)
- **Spearman ρ:** 0.630 · **NDCG@10:** 0.866 · **MAE:** 3.50 positions
