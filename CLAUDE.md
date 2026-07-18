# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Futbol: a football universe simulator (draft a squad → simulate a season → chase an unbeaten record → share the result), inspired by 38-0/FIFA Career Mode/Football Manager. Currently Phase 1 (MVP): single-player draft → season → share, built as a pnpm/Turborepo monorepo. Full architecture, database design, and phased roadmap live in `plans/i-want-to-build-shiny-candy.md` — read that before making structural changes.

## Commands

All commands run from the repo root unless noted. Package manager is **pnpm** (`packageManager` pinned in root `package.json`); Node >= 22.

```bash
pnpm install                     # install + link all workspace packages

pnpm build                       # turbo: build every package
pnpm test                        # turbo: run every test suite
pnpm typecheck                   # turbo: typecheck every package

pnpm --filter @futbol/engine test         # run one package's tests
pnpm --filter @futbol/engine test -- -t "determinism"   # single test (vitest -t filter)

pnpm --filter @futbol/api dev             # NestJS API, http://localhost:4000 (tsx watch)
pnpm --filter @futbol/sim-worker dev      # BullMQ worker (tsx watch)
pnpm --filter @futbol/web dev             # Vite dev server, http://localhost:5173

pnpm --filter @futbol/sim-lab exec tsx src/report.ts     # print engine calibration stats
```

Database (from `packages/db`):

```bash
pnpm prisma:migrate     # prisma migrate dev — creates + applies a migration from schema changes
pnpm prisma:deploy      # prisma migrate deploy — applies existing migrations (CI/prod)
pnpm prisma:generate    # regenerate Prisma Client after schema.prisma changes
pnpm seed               # tsx prisma/seed.ts — seeds the placeholder reference dataset
```

Each runnable package needs its own `.env` (copy from that package's `.env.example`): `packages/db`, `apps/api`, `apps/sim-worker` need `DATABASE_URL`; `apps/api`/`apps/sim-worker` also need `REDIS_URL`; `apps/api` needs `JWT_SECRET`. `apps/web` needs `VITE_API_URL`. `infra/docker-compose.yml` provides a local Postgres+Redis if you don't have your own.

Every package's `build`/`typecheck`/`test` scripts are standardized (`tsc -p tsconfig.json[--noEmit]`, `vitest run`), which is what makes the root `turbo run <script>` commands work uniformly — keep new packages consistent with this.

## Architecture

### Monorepo layout and dependency direction

```
packages/domain   -- shared types + zod schemas (Player, Squad, MatchEvent, MatchResult, jobs). Zero dependencies.
packages/engine   -- deterministic match simulator. Depends only on domain.
packages/db       -- Prisma schema/client, seed script. Depends on domain (for attribute shapes) and, as a devDependency, engine (seed script reuses its attribute generator).
packages/config   -- shared tsconfig base.
tools/sim-lab     -- statistical calibration harness for engine. Depends on engine (incl. its /testing subpath) and domain.
apps/api          -- NestJS REST API. Depends on domain, engine (types only), db.
apps/sim-worker   -- BullMQ consumer. Depends on domain, engine, db.
apps/web          -- React/Vite/Tailwind SPA. No workspace deps — talks to apps/api over plain REST via apps/web/src/api/client.ts (types hand-mirrored in apps/web/src/api/types.ts, not imported from @futbol/domain, since it's a separate ESM/bundler build target).
```

All Node packages are ESM (`"type": "module"`, `moduleResolution: NodeNext` from `packages/config/base.json`), so internal imports use explicit `.js` extensions. `apps/web` is the one exception: Vite/bundler resolution, extensionless imports, its own `tsconfig.json` (DOM lib, `jsx: react-jsx`, `moduleResolution: bundler`).

### The reference-catalog / world-state split (packages/db/prisma/schema.prisma)

This is the central data-modeling decision and shows up everywhere:

- **Reference catalog** (`Era`, `RefLeague`, `RefClub`, `RefClubSeason`, `RefPlayer`, `RefPlayerSeason`, ...): read-mostly, versioned. `RefPlayerSeason` is the draftable atom (a player's attributes in one specific season). Real-data licensing is an open question — see the architecture doc — so nothing outside this catalog hardcodes real identities.
- **World/save state** (`World`, `WorldClub`, `WorldPlayer`, `Season`, `Competition`, `Fixture`, `Match`, `MatchEvent`, `PlayerMatchStat`, ...): copy-on-write per save, everything scoped by `worldId`. Drafting copies `RefPlayerSeason` rows into new `WorldPlayer` rows with their own ids — **`WorldClub.lineup`/`.bench` (JSON `{position, playerId}[]`) must reference the new `WorldPlayer.id`, not the source `RefPlayerSeason.id`**. This bit a real bug once (see `apps/api/src/common/instantiate-world-club.ts` — it creates the `WorldClub` with an empty lineup first, creates all `WorldPlayer` rows, then updates the lineup/bench with the mapped ids). Any new code path that creates world players from ref data must follow the same two-phase pattern.

### Simulation engine contract (packages/engine)

`simulate(setup: MatchSetup, seed: bigint): MatchResult` is a **pure, deterministic function** — same inputs always produce the same output. All randomness goes through `createRng(seed)` (mulberry32); never `Math.random()`, never wall-clock time. Callers (currently only `apps/sim-worker`) generate a fresh random seed per match and persist `{setup, seed, engineVersion}` alongside the result for reproducibility/audit.

Internals worth knowing before touching `simulate.ts`: player attributes → `computePlayerQuality()` (per-dimension 0-1 scores) → `computeUnitRatings()` (aggregated per team, weighted by `POSITION_UNIT_WEIGHTS`) → tactics/home-advantage/weather modifiers applied once at kickoff → per-minute loop applies fatigue, momentum, then rolls chances/shots/cards/injuries/subs. Tuning constants live in `packages/engine/src/constants.ts` and are calibrated against realistic targets by `tools/sim-lab` (goal distribution, home-advantage, favorite-win-rate vs quality gap) — if you change a constant, rerun `pnpm --filter @futbol/sim-lab test` and `exec tsx src/report.ts` to confirm the distributions still look like real football.

### Season simulation flow (api → queue → worker)

`apps/api`'s `SeasonsService.requestSimulation` marks the season `IN_PROGRESS` and enqueues a job (`SEASON_SIM_QUEUE` name + `SeasonSimJob` shape, both defined in `packages/domain/src/jobs.ts` so producer and consumer share the contract) onto BullMQ. `apps/sim-worker`'s `processSeasonSimJob` picks it up, rebuilds each fixture's `Squad` from persisted `WorldClub`/`WorldPlayer` rows (`build-squad.ts`), calls `simulate()`, persists `Match`/`MatchEvent`/`PlayerMatchStat`, marks the `Fixture` completed, applies a light post-match fitness dip, and marks the `Season` completed once every fixture has a result. Morale/form progression between matches is intentionally not implemented yet (Phase 3/club-management territory) — don't add it ad hoc; note it in the plan doc instead.

### Auth: guest-first

`POST /auth/guest` creates a `User` with just a `displayName` (`email`/`passwordHash` nullable, `isGuest: true`) and issues a JWT — no signup friction to start playing. `POST /auth/upgrade` (authenticated) attaches `email`/`passwordHash` to that *same* user row (`isGuest: false`), so a guest's worlds/history carry over rather than requiring a fresh account. `register`/`login` are the traditional email+password paths for users who already upgraded. Don't reintroduce a hard login gate in front of `apps/web`'s entry flow — username-only play is a deliberate product decision, not a placeholder.

Two auth gotchas already hit once, worth knowing before touching this code:
- `JwtModule.register({ secret: process.env.JWT_SECRET })` in `auth.module.ts` reads `process.env` at **module-evaluation time**, which is before `@nestjs/config`'s `ConfigModule.forRoot()` has loaded `.env`. `apps/api/src/main.ts` therefore does `import "dotenv/config"` as its literal first line — before importing `AppModule` — so env vars are populated before any static `.register()` calls run. Don't remove that import or reorder it after the `AppModule` import.
- CJS packages without a normal ESM interop shape (e.g. `bcryptjs`) need `import bcrypt from "bcryptjs"` (default import), not `import * as bcrypt from "bcryptjs"` — the latter compiles fine but `bcrypt.hash` is `undefined` at runtime under real ESM output.

### Validation

Every Nest controller uses a shared `ZodValidationPipe` (`apps/api/src/common/zod-validation.pipe.ts`) with per-route zod schemas colocated next to each module (`*.schemas.ts`) — there's no `class-validator`/DTO-decorator usage anywhere in this codebase; keep new endpoints consistent with the zod pattern.

### Testing conventions

Vitest everywhere. Business logic that doesn't need Nest/Prisma/a browser is factored into plain, dependency-free functions specifically so it's unit-testable without mocking infrastructure: `apps/api/src/common/lineup.ts` (greedy formation-slot assignment), `apps/api/src/seasons/round-robin.ts` (circle-method fixture generation), `apps/sim-worker/src/build-squad.ts` (Prisma-row → domain-`Squad` reconstruction). `packages/engine/src/testing/` (exported via the `@futbol/engine/testing` subpath) provides deterministic squad/match-setup fixture generators reused by both the engine's own tests and `tools/sim-lab`.
