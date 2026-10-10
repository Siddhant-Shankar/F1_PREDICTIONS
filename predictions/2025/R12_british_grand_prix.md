# 2025 British Grand Prix (Round 12)

**Model:** `v6_ensemble`, Blend: 50% finishers-only ranker, 25% regressor, 25% grid  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | PIA | McLaren | 2 | 21.1% | 57.2% | 99.8% | 3.4 | 2 |
| 2 | NOR | McLaren | 3 | 19.4% | 53.7% | 99.9% | 3.6 | 1 |
| 3 | VER | Red Bull | 1 | 18.9% | 53.4% | 99.7% | 3.6 | 5 |
| 4 | RUS | Mercedes | 4 | 11.3% | 35.9% | 98.5% | 4.7 | 10 |
| 5 | HAM | Ferrari | 5 | 8.8% | 28.1% | 96.9% | 5.4 | 4 |
| 6 | LEC | Ferrari | 6 | 8.2% | 27.7% | 96.5% | 5.5 | 14 |
| 7 | ANT | Mercedes | 10 | 2.9% | 9.8% | 72.7% | 8.4 | 16 |
| 8 | ALO | Aston Martin | 7 | 1.8% | 7.4% | 60.0% | 9.4 | 9 |
| 9 | SAI | Williams | 9 | 1.4% | 4.7% | 45.8% | 10.7 | 12 |
| 10 | GAS | Alpine F1 Team | 8 | 1.2% | 4.1% | 42.1% | 11.1 | 6 |
| 11 | TSU | Red Bull | 11 | 1.1% | 3.5% | 33.7% | 12.0 | 15 |
| 12 | ALB | Williams | 13 | 0.7% | 2.9% | 28.9% | 12.6 | 8 |
| 13 | HAD | RB F1 Team | 12 | 0.7% | 2.3% | 24.4% | 13.3 | 17 |
| 14 | OCO | Haas F1 Team | 14 | 0.5% | 1.9% | 20.8% | 13.8 | 13 |
| 15 | BEA | Haas F1 Team | 18 | 0.6% | 1.8% | 18.9% | 14.1 | 11 |
| 16 | LAW | RB F1 Team | 15 | 0.4% | 1.6% | 15.7% | 14.9 | 19 |
| 17 | BOR | Sauber | 16 | 0.4% | 1.3% | 14.3% | 15.1 | 18 |
| 18 | HUL | Sauber | 19 | 0.4% | 1.4% | 13.2% | 15.3 | 3 |
| 19 | STR | Aston Martin | 17 | 0.2% | 0.9% | 10.3% | 16.1 | 7 |
| 20 | COL | Alpine F1 Team | 20 | 0.2% | 0.7% | 7.8% | 16.9 | 20 |

## How it went

- **Winner:** NOR (model gave 19.4%); favourite was PIA at 21.1%
- **Podium:** NOR, PIA, HUL; predicted podium PIA, NOR, VER (2/3 correct)
- **Spearman ρ:** 0.505 · **NDCG@10:** 0.874 · **MAE:** 4.20 positions
