# 2025 Emilia Romagna Grand Prix (Round 7)

**Model:** `v4_lambdarank`, LightGBM LambdaRank (optimises in-race ordering, NDCG)  
Trained on every race before this one; probabilities from 10,000 Plackett-Luce simulations of the race.

| Pred | Driver | Team | Grid | P(win) | P(podium) | P(points) | E[pos] | Actual |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | PIA | McLaren | 1 | 34.8% | 77.2% | 100.0% | 2.5 | 3 |
| 2 | RUS | Mercedes | 3 | 17.5% | 53.7% | 99.7% | 3.6 | 7 |
| 3 | VER | Red Bull | 2 | 15.2% | 52.0% | 99.7% | 3.7 | 1 |
| 4 | NOR | McLaren | 4 | 14.2% | 46.1% | 99.5% | 3.9 | 2 |
| 5 | LEC | Ferrari | 11 | 2.1% | 9.4% | 68.2% | 8.7 | 6 |
| 6 | ALB | Williams | 7 | 1.9% | 8.5% | 63.6% | 9.1 | 5 |
| 7 | SAI | Williams | 6 | 2.5% | 8.4% | 62.0% | 9.3 | 8 |
| 8 | ALO | Aston Martin | 5 | 1.9% | 7.6% | 59.9% | 9.5 | 11 |
| 9 | ANT | Mercedes | 13 | 2.0% | 6.9% | 57.9% | 9.7 | 19 |
| 10 | HAM | Ferrari | 12 | 1.8% | 6.3% | 52.7% | 10.1 | 4 |
| 11 | HAD | RB F1 Team | 9 | 1.0% | 4.1% | 39.1% | 11.6 | 9 |
| 12 | STR | Aston Martin | 8 | 0.7% | 3.6% | 34.6% | 12.2 | 15 |
| 13 | TSU | Red Bull | 20 | 1.0% | 3.5% | 32.7% | 12.5 | 10 |
| 14 | GAS | Alpine F1 Team | 10 | 0.9% | 2.9% | 29.9% | 12.8 | 13 |
| 15 | BEA | Haas F1 Team | 19 | 0.5% | 2.1% | 21.2% | 14.3 | 17 |
| 16 | OCO | Haas F1 Team | 18 | 0.4% | 1.8% | 18.5% | 14.8 | 20 |
| 17 | BOR | Sauber | 14 | 0.4% | 1.6% | 16.2% | 15.2 | 18 |
| 18 | COL | Alpine F1 Team | 16 | 0.4% | 1.4% | 15.8% | 15.3 | 16 |
| 19 | HUL | Sauber | 17 | 0.4% | 1.4% | 15.4% | 15.4 | 12 |
| 20 | LAW | RB F1 Team | 15 | 0.3% | 1.4% | 13.5% | 15.9 | 14 |

## How it went

- **Winner:** VER (model gave 15.2%); favourite was PIA at 34.8%
- **Podium:** VER, NOR, PIA; predicted podium PIA, RUS, VER (2/3 correct)
- **Spearman ρ:** 0.761 · **NDCG@10:** 0.922 · **MAE:** 3.20 positions
