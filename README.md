# Futbol

A football universe simulator: draft a squad, simulate a season, chase an unbeaten record, share the result — with Football Manager-depth attributes and a server-authoritative match engine underneath. See [`plans/i-want-to-build-shiny-candy.md`](plans/i-want-to-build-shiny-candy.md) for the full architecture doc (data model, simulation engine, multiplayer, roadmap), and [`CLAUDE.md`](CLAUDE.md) for a developer-oriented tour of the codebase.

This is Phase 1 (MVP): **Draft → Season → Share**, single-player.

## Structure

```
apps/
  web/         React + Vite + Tailwind frontend
  api/         NestJS REST API (auth, catalog, worlds, draft, seasons, europe)
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

Then in the browser: from the landing page, **Start a draft** → **Set the Rules** (pick a league or all of them, a formation, difficulty, and a few other options) → the **Draft Room**, where you spin a wheel for a random club-season, pick a player from that squad into an open position, and repeat until the XI is full → review **Your XI**, optionally draw a manager, see a pre-season projection → **Simulate Season**. From there the season plays out match-by-match — a popup per fixture with the score and every goalscorer/assist/minute, ~1.5s each and skippable — before landing on the final table and a "your club's season" stats screen (top scorer, top assist, full squad breakdown). Finish in the domestic top 8 and it continues automatically into a Champions-League-style European campaign: a league phase, then a two-legged knockout bracket (quarter-finals → semi-finals → a single-match final), each round replayed the same way, ending on a champion and a shareable result card either way. A guest username is only requested at the draft's final confirm step (via a lightweight modal), not up front — browsing and drafting work with no account. A **Multiplayer** mode (`/multiplayer`) supports local pass-and-play head-to-head: two players each draft an XI under the same rules, then a two-leg fixture decides the winner. A "Save your progress" button appears in the header for guest sessions — it attaches an email/password to the same account so history persists across devices.

## Verifying the whole workspace

```bash
pnpm build      # turbo: builds every package
pnpm test       # turbo: runs every test suite
pnpm typecheck  # turbo: typechecks every package
```

All three pass cleanly across all 8 packages (24 tests: domain, engine determinism/calibration, sim-lab statistical realism, api business logic, sim-worker).

## Verified live, end-to-end

Beyond build/test/typecheck, the full user journey has been exercised against a real Postgres (Neon) and real Redis (Memurai), both via direct API calls and through the actual browser UI: register/guest-login → create world → draft a club → create a season → simulate (queued to Redis, picked up by the worker, engine runs, results persisted) → standings render correctly → shareable result card renders correctly. Four real bugs were found and fixed by this live pass (a CJS/ESM import gotcha, a JWT-secret load-order bug, a draft lineup referencing the wrong id, and a missing Prisma `include`) — see `CLAUDE.md` for the specifics, since they're the kind of thing worth knowing before touching that code again.

A later pass verified the animated season replay and Champions League feature the same way: drafted a full squad, simulated a real 380-fixture domestic season, confirmed the match-by-match popups render correct scorers/assists/minutes, confirmed qualification correctly triggers the European campaign, and drove the entire league-phase → QF → SF → Final bracket to a resolved champion (including watching the drafted club get eliminated in the semis, confirming the tournament still plays out to completion for everyone else). Two more real bugs were found and fixed: `apps/api`'s `tsx watch` dev server silently resolves NestJS's constructor-injected dependencies to `undefined` (esbuild doesn't emit the decorator metadata Nest's DI needs — fixed by making every injection explicit with `@Inject()`), and the team-stats endpoint was folding the opponent's whole squad into "your" stats since `PlayerMatchStat` rows aren't tagged by club. Both are documented in `CLAUDE.md`.

**Deployment**: not performed. Standing up production infrastructure and deploying `apps/api`, `apps/sim-worker`, and `apps/web` to a host (Railway/Render/Fly.io, per the architecture doc) requires your accounts and credentials — that's a step for you to drive, or to hand back to me once you've chosen a platform and I can wire up the deploy config.

## Known placeholder

`packages/db/prisma/seed.ts` seeds a broader but still entirely **fictional** placeholder dataset — 6 made-up leagues across 4 countries (36 clubs, 2 seasons each spanning 1992-2025, ~1,300 generated player-seasons) — enough for the league picker and spin-the-wheel draft to have real variety, with zero licensing risk. The real historical player-season dataset (real clubs/players/eras) is a separate data-sourcing decision — see the architecture doc's licensing note and open question on dataset source.
