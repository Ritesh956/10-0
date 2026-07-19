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
  `overall` is a blend of market-value percentile, position-relative per-90
  goal contribution, and involvement (minutes played) within the filtered
  dataset (see `build_real_catalog.py`), and `potential`/individual
  attributes are then generated from that `overall` via
  `@futbol/engine`'s own `generateAttributes()` so they stay consistent with
  how `tools/sim-lab` calibrates the match engine.

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
