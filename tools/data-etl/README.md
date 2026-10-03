# Real reference-catalog ETL

Builds `packages/db/prisma/data/real-top5-2012-2024.json.gz`, the compact
dataset that `packages/db/prisma/seed-real.ts` loads into the `Ref*` tables
(alongside, not replacing, the fictional dataset from `prisma/seed.ts`).

## Source

[dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) —
a CC-licensed, weekly-refreshed CSV extract of public Transfermarkt data
(players, clubs, competitions, per-game appearances, market valuations). No
API key or login required.

## What's real vs. computed

- **Real**: player names, positions, nationalities, dates of birth, club
  names, league/season/club membership, per-game minutes/goals/assists/cards,
  market valuations.
- **Computed by us**: `overall`/`potential` and the full FM-style attribute
  vector. These are **not** copied from any FIFA/EA/SoFIFA-style rating —
  `overall` starts as a blend of market-value percentile, position-relative
  per-90 goal contribution, and involvement (minutes played) within the
  filtered dataset, and that blend is then mapped onto a realistic rating
  curve in two stages: (1) quantile-mapped onto a normal distribution (mean
  81.5 / sd 5, clamped to `[70, 99]` — the `OVR_*` constants), then (2)
  stretched by `ovr_spread.py`'s piecewise-linear curve to a final **58–97**
  range, so 90+ is genuinely rare (top ~1.5% of player-seasons) and a league's
  best and worst XIs sit far enough apart for a realistic simulated table.
  `potential`/individual attributes are then generated from that `overall` via
  `@futbol/engine`'s own `generateAttributes()` (quality from
  `overallToEngineQuality` in `@futbol/engine/testing`) so they stay
  consistent with how `tools/sim-lab` calibrates the match engine.

The curve, the engine's rating→quality map and its `GK_SAVE_PIVOT` were tuned
together against `tools/sim-lab`'s real-league harness — after changing any of
them, re-run `pnpm --filter @futbol/sim-lab calibrate -- --write` so the web
app's pre-season projection table matches.

### Recalibrating an existing dataset without the raw CSVs

The shipped `real-top5-2012-2024.json.gz` already carries the final (stage 2)
ratings. History, for when the raw Transfermarkt CSVs aren't present:

- `rescale_existing_overall.py` — applied stage 1 (July 2026). Anchors to the
  file's current distribution, so never run it against its own output.
- `apply_ovr_spread.py` — applied stage 2 (October 2026) as an exact
  per-integer remap of overall/potential plus club-season reputation. Refuses
  to run on a file that already has overalls below 70.

After changing the file, reseed with `pnpm seed:real` — the seed syncs
overall/potential/attributes/reputation onto existing rows, so no DB wipe is
needed.

## Scope

Top-5 European leagues (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1),
seasons 2012-2024 (the earliest season this data source covers in full is
2012/13). Player-seasons under 300 minutes played are dropped as noise.

## Regenerating

```bash
./download_source_data.sh          # fetches raw CSVs into ./raw (gitignored)
python3 -m pip install pandas numpy
python3 build_real_catalog.py      # writes ../../packages/db/prisma/data/real-top5-2012-2024.json.gz
```

Then from `packages/db`: `pnpm seed:real` to load it into Postgres.
