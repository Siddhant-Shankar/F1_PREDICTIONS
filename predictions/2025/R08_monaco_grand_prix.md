# 2025 Monaco Grand Prix (Round 8)

**Model:** `v5_rank_finishers`, LambdaRank trained on classified finishers only (DNFs are noise)  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | NOR | McLaren | 1 | 45.8% | 88.5% | 100.0% | 2.0 | 1 |
| 2 | PIA | McLaren | 3 | 19.1% | 63.8% | 99.9% | 3.1 | 3 |
| 3 | LEC | Ferrari | 2 | 8.2% | 33.0% | 97.1% | 4.9 | 2 |
| 4 | VER | Red Bull | 4 | 7.8% | 30.1% | 96.4% | 5.1 | 4 |
| 5 | RUS | Mercedes | 14 | 4.3% | 19.4% | 89.5% | 6.4 | 11 |
| 6 | HAM | Ferrari | 7 | 3.0% | 13.6% | 79.3% | 7.5 | 5 |
| 7 | ALO | Aston Martin | 6 | 1.7% | 7.5% | 56.6% | 9.6 | 19 |
| 8 | HAD | RB F1 Team | 5 | 1.2% | 5.8% | 48.1% | 10.5 | 6 |
| 9 | ANT | Mercedes | 15 | 1.1% | 5.3% | 46.2% | 10.7 | 18 |
| 10 | ALB | Williams | 10 | 1.5% | 5.9% | 46.1% | 10.8 | 9 |
| 11 | OCO | Haas F1 Team | 8 | 1.1% | 5.2% | 45.4% | 10.8 | 7 |
| 12 | TSU | Red Bull | 12 | 1.2% | 5.1% | 42.9% | 11.1 | 17 |
| 13 | SAI | Williams | 11 | 1.0% | 4.4% | 36.9% | 11.8 | 10 |
| 14 | LAW | RB F1 Team | 9 | 0.8% | 3.2% | 29.2% | 12.8 | 8 |
| 15 | GAS | Alpine F1 Team | 17 | 0.4% | 1.9% | 18.8% | 14.5 | 20 |
| 16 | HUL | Sauber | 13 | 0.3% | 1.6% | 14.8% | 15.3 | 16 |
| 17 | BOR | Sauber | 16 | 0.4% | 1.5% | 13.7% | 15.7 | 14 |
| 18 | COL | Alpine F1 Team | 18 | 0.3% | 1.4% | 13.5% | 15.6 | 13 |
| 19 | BEA | Haas F1 Team | 20 | 0.3% | 1.4% | 13.2% | 15.7 | 12 |
| 20 | STR | Aston Martin | 19 | 0.3% | 1.1% | 12.4% | 15.9 | 15 |

## How it went

- **Winner:** NOR (model gave 45.8%); favourite was NOR at 45.8%
- **Podium:** NOR, LEC, PIA; predicted podium NOR, PIA, LEC (3/3 correct)
- **Spearman ρ:** 0.633 · **NDCG@10:** 0.895 · **MAE:** 3.80 positions
