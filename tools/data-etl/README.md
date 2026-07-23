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
  filtered dataset, and that blend is then **quantile-mapped onto a realistic
  rating curve** (a normal distribution, mean 81.5 / sd 5, clamped to
  `[70, 99]` — see the `OVR_*` constants) so the final distribution looks like
  real football — floor at 70, the bulk clustered in the low-80s, a thin elite
  tail only the very best season reaches 99 — instead of the near-flat 40-99
  spread a raw linear map produced (see `build_real_catalog.py`). `potential`/individual
  attributes are then generated from that `overall` via `@futbol/engine`'s own
  `generateAttributes()` so they stay consistent with how `tools/sim-lab`
  calibrates the match engine.

### Recalibrating an existing dataset without the raw CSVs

`rescale_existing_overall.py` applies the same `[70, 99]` curve to the already
shipped `real-top5-2012-2024.json.gz` in place (overall, potential, and
club-season reputation), for when the raw Transfermarkt CSVs aren't present to
run a full `build_real_catalog.py` regen. It anchors to the file's *current*
distribution, so run it only against a pristine ETL-produced file, never twice
against its own output. After running it, reseed with `pnpm seed:real` — the
seed script now syncs overall/potential/attributes onto existing rows, so no DB
wipe is needed.

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
