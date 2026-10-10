# Methodology

How the model works, why it is built this way, and what the numbers mean.

## 1. The problem

Before a race we know the qualifying result, the starting grid, and the history
of every previous race. We want:

1. **an ordering** of the field (who finishes ahead of whom), and
2. **probabilities**: P(win), P(podium), P(points) for every driver.

A good ordering with bad probabilities ("Verstappen 99% to win") is not useful,
so both are measured separately.

## 2. Data

`f1pred/data/ingest.py` pulls every race and qualifying result from 2022 (the
start of the current ground-effect era) to the latest completed race via
FastF1's Jolpica/Ergast interface. The result is one row per driver per race:
grid, qualifying position and lap time, finishing position, status (finished /
retired), and points.

Fetching a whole season per paginated query instead of loading each session
keeps a full rebuild to about 50 HTTP requests. The session-by-session approach
needed about 10 per weekend and ran into FastF1's 500-requests-per-hour limit.

## 3. Features, and how leakage is prevented

Every feature for race *r* uses only:

- the current weekend's **qualifying and grid** (known before lights out), and
- results from races **strictly before** *r*.

Rolling statistics are computed per driver (or team) on a chronologically
sorted table and `shift(1)`-ed, so a race never sees its own result.
`tests/test_features.py` enforces this: it scrambles the result of one race and
asserts that no feature up to and including that race changes. A second test
confirms the check can detect a dependency at all, by verifying that the *next*
race's features do change.

| Group | Features | Intuition |
|---|---|---|
| Qualifying | grid, quali position, gap to pole (%), gap to teammate | Saturday pace. The gap is in percent so Monaco and Spa are comparable. The teammate gap isolates the driver from the car. |
| Form | EWMA of finishing position, points, positions gained, DNF rate; team points and DNF rate; championship rank | Who is quick right now. Exponential weighting (half-life of 4 races) follows in-season upgrades. |
| Ratings | Driver and constructor Elo, raw and relative to the field | A single number for strength that adjusts for *who* you beat. |
| Circuit | Driver's average finish at this track; historical grid-to-finish correlation at the track | Some tracks suit some drivers; at Monaco the grid decides almost everything. |

### Multi-competitor Elo

A race with *n* cars is treated as *n(n-1)/2* head-to-head results: each
driver "beat" everyone behind them. Ratings move by

```
ΔR_i = K/(n-1) · Σ_j (S_ij − E_ij),     E_ij = 1 / (1 + 10^((R_j − R_i)/400))
```

Dividing by *n-1* makes one race worth roughly one chess game. Between seasons
ratings shrink 20% toward 1500, and 50% when the technical regulations reset
(2022, 2026), because the previous car hierarchy then says much less about
the new one.

## 4. Models

Every model outputs one score per driver (higher = better). The versions are
cumulative, so each one tests a single idea:

| Version | Idea |
|---|---|
| `v0_grid` | Finish where you start. In F1 this is a very strong baseline. |
| `v1_quali_linear` | Ridge regression on qualifying pace: *how much* faster, not just the order. |
| `v2_form_gbm` | LightGBM regressor plus rolling form. Captures non-linear effects such as a fast car qualifying out of position. |
| `v3_elo_gbm` | Adds Elo ratings and circuit history. |
| `v4_lambdarank` | **Learning to rank.** LightGBM's LambdaRank optimises NDCG over each race's ordering directly, instead of position error per driver. |
| `v5_rank_finishers` | Trains the ranker on classified finishers only. A retired car's "P19" is mostly a mechanical failure or a crash, not information about pace. |
| `v6_ensemble` | Blends standardised scores: 50% ranker, 25% finishers-only regressor, 25% grid. The parts make partly independent errors. |

### Why learning to rank?

A regressor that predicts P4 and P6 for two drivers who actually finished P5
and P6 is penalised, even though it got their order right. In a race only the
order matters. LambdaRank weights each pairwise swap by how much it would change
NDCG, so mistakes at the front (the win and the podium) cost more than shuffling
P15 and P16. Relevance is linear in finishing position (`field_size + 1 − pos`)
with linear label gains. LightGBM's default `2^rel − 1` would make the winner
worth about a million times P10.

## 5. From scores to probabilities: Plackett-Luce

Plackett-Luce is the standard probability model for rankings. Given scores
*s*, the winner is driver *i* with probability

```
P(i wins) = exp(s_i / T) / Σ_j exp(s_j / T)
```

That driver is then removed, and P2 is drawn from the remaining cars by the same
rule, and so on down the field.

- **Simulation.** Adding independent Gumbel noise to `s/T` and sorting gives an
  exact Plackett-Luce sample (the Gumbel-max trick). Ten thousand races are a
  single vectorised `argsort`; P(podium) is just the share of simulations where
  a driver finishes in the top three.
- **Temperature *T*.** This controls confidence. It is fitted by maximum
  likelihood on the model's out-of-sample scores from the previous 40 races,
  never on the race being predicted. The likelihood is truncated to the top 10,
  because the back of the field is mostly noise and the probabilities that matter
  are for the front.

`tests/test_plackett_luce.py` checks that simulated win rates match the exact
softmax, and that the temperature fit recovers a known *T* from synthetic races.

## 6. Evaluation: walk-forward backtest

For each of the 86 races from 2023 through the latest 2026 round:

1. train on every earlier race,
2. predict this race from pre-race features,
3. calibrate *T* on earlier out-of-sample predictions,
4. score against the real result.

This is how the model would have performed if it had been run live every
weekend. A random train/test split would let the model learn from races *after*
the one it predicts, which flatters the numbers.
`tests/test_backtest.py` uses a spy model to prove training never sees the
test race or anything after it.

| Metric | Meaning |
|---|---|
| Spearman ρ | Rank correlation between the predicted and actual order (1 = perfect). |
| NDCG@10 | Ranking quality weighted toward the front of the field. |
| Winner hit-rate | How often the favourite won. |
| Podium overlap | Correctly predicted podium finishers ÷ 3. |
| MAE | Average error in finishing positions. |
| Winner log-loss | −log P(actual winner). Penalises confident wrong calls; lower is better. |
| Podium Brier | Mean squared error of the podium probabilities. |

## 7. Honest limitations

- **The grid is hard to beat on ordering alone.** Most of the gain shows up in
  probability quality (winner log-loss falls about 20%) and in the midfield, not
  in picking more winners.
- **Single-race metrics are noisy.** One safety car can swing Spearman ρ by 0.3.
  Judge versions on the full backtest, not on a single weekend.
- **No race-day information.** Weather, tyre strategy, and practice long-run
  pace are not used yet. Wet races are the largest source of error.
- **Regulation resets.** 2026 is a new era. Elo shrinkage helps, but the model
  still needs a few races of 2026 data before team form means much.
