# Futbol

A football universe simulator: draft a squad, simulate a season, chase an unbeaten record, share the result — with Football Manager-depth attributes and a server-authoritative match engine underneath. See [`plans/i-want-to-build-shiny-candy.md`](plans/i-want-to-build-shiny-candy.md) for the full architecture doc (data model, simulation engine, multiplayer, roadmap), and [`CLAUDE.md`](CLAUDE.md) for a developer-oriented tour of the codebase.

This is Phase 1 (MVP): **Draft → Season → Share**, single-player.

## Structure

```
apps/
  web/         React + Vite + Tailwind frontend
  api/         NestJS REST API (auth, catalog, worlds, draft, seasons)
  sim-worker/  BullMQ worker that runs the match engine and persists results
packages/
  domain/      Shared types (Player, Squad, MatchEvent, MatchResult, ...) + zod schemas
  engine/      Deterministic match simulation engine (simulate(setup, seed))
  db/          Prisma schema, migrations, seed data
  config/      Shared tsconfig
tools/
  sim-lab/     Statistical calibration harness for the engine
infra/
  docker-compose.yml   Local Postgres + Redis
```

## Prerequisites

- Node.js >= 22, pnpm >= 10
- A PostgreSQL database and a Redis-compatible service, reachable via connection strings. Any of the following work:
  - Managed/serverless: [Neon](https://neon.tech) (Postgres) + [Upstash](https://upstash.com) (Redis) — quickest way to get going, no local install
  - Local native installs, e.g. [Memurai](https://www.memurai.com) for Redis on Windows (Redis itself has no official Windows build)
  - `infra/docker-compose.yml` for a local Postgres + Redis pair

## Setup

```bash
pnpm install

# packages/db
cp packages/db/.env.example packages/db/.env   # set DATABASE_URL
cd packages/db
pnpm prisma:migrate     # applies prisma/migrations/*
pnpm seed               # seeds a small placeholder reference dataset
cd ../..

# apps/api
cp apps/api/.env.example apps/api/.env         # set DATABASE_URL, REDIS_URL, JWT_SECRET

# apps/sim-worker
cp apps/sim-worker/.env.example apps/sim-worker/.env   # same DATABASE_URL, plus REDIS_URL
```

## Running

```bash
pnpm --filter @futbol/api dev          # http://localhost:4000
pnpm --filter @futbol/sim-worker dev   # consumes season-simulation jobs
pnpm --filter @futbol/web dev          # http://localhost:5173
```

Then in the browser: **enter a username and hit "Play now"** (no email/password required to start) → pick an era → draft a club (browse, roll, or fantasy-draft players) → create a season → simulate → view standings and the shareable result card. A "Save your progress" button appears in the header for guest sessions — it attaches an email/password to the same account so history persists across devices.

## Verifying the whole workspace

```bash
pnpm build      # turbo: builds every package
pnpm test       # turbo: runs every test suite
pnpm typecheck  # turbo: typechecks every package
```

All three pass cleanly across all 8 packages (22 tests: domain, engine determinism/calibration, sim-lab statistical realism, api business logic, sim-worker).

## Verified live, end-to-end

Beyond build/test/typecheck, the full user journey has been exercised against a real Postgres (Neon) and real Redis (Memurai), both via direct API calls and through the actual browser UI: register/guest-login → create world → draft a club → create a season → simulate (queued to Redis, picked up by the worker, engine runs, results persisted) → standings render correctly → shareable result card renders correctly. Four real bugs were found and fixed by this live pass (a CJS/ESM import gotcha, a JWT-secret load-order bug, a draft lineup referencing the wrong id, and a missing Prisma `include`) — see `CLAUDE.md` for the specifics, since they're the kind of thing worth knowing before touching that code again.

**Deployment**: not performed. Standing up production infrastructure and deploying `apps/api`, `apps/sim-worker`, and `apps/web` to a host (Railway/Render/Fly.io, per the architecture doc) requires your accounts and credentials — that's a step for you to drive, or to hand back to me once you've chosen a platform and I can wire up the deploy config.

## Known placeholder

`packages/db/prisma/seed.ts` seeds a small **fictional** placeholder dataset (two made-up clubs, generated attributes) purely to exercise the pipeline end-to-end. The real historical player-season dataset (real clubs/players/eras) is a separate data-sourcing decision — see the architecture doc's licensing note and open question on dataset source.
