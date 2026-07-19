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
pnpm seed               # tsx prisma/seed.ts — seeds the placeholder (fictional) reference dataset
pnpm seed:real          # tsx prisma/seed-real.ts — seeds the real top-5-leagues dataset (see below)
pnpm seed:managers      # tsx prisma/seed-managers.ts — seeds 100 real managers with hand-curated tactics (see below)
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
- **Real dataset** (`prisma/seed-real.ts` + `prisma/data/real-top5-2012-2024.json.gz`): real players/clubs for the top-5 European leagues (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1), seasons 2012-2024, sourced from [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) (real names/positions/appearances/market value/photo URLs — factual data, not scraped from a FIFA/EA-style ratings site). `overall`/`potential` are **computed by us** from a blend of market-value percentile, position-relative per-90 output, and involvement (minutes) — never copied from a third party's proprietary rating — then used as the `quality` seed for the engine's own `generateAttributes()` (`@futbol/engine/testing`), so attribute distributions stay consistent with `tools/sim-lab`'s calibration. `RefPlayer.photoUrl` hotlinks Transfermarkt's own image CDN directly (same trust level as the rest of the sourced data; no self-hosting/caching layer). Additive: seeded into the same `era-all-time` era as the fictional dataset, so both show up in the same league picker with no frontend change. ETL to regenerate the dataset lives in `tools/data-etl/` (see its README) — ratings formula tuning goes there, not in `seed-real.ts`. **Note on `createMany` + `skipDuplicates`**: it silently no-ops on rows that already exist, so a rerun that adds/changes a field (e.g. backfilling `photoUrl`) won't apply to previously-seeded rows — `seed-real.ts` follows up with an explicit per-row update pass for exactly this reason; keep that pattern for any future field additions to `RefPlayer`.
- **Player ratings mode** (`catalog.service.ts` `listPlayerSeasons`, `ratingsMode` filter: `"season" | "prime"`): "season" (default) returns each player exactly as they were in the drawn club-season. "prime" swaps in that player's own career-best (highest-`overall`) `RefPlayerSeason` — attributes/positions/overall/potential all come from the peak row, but `clubSeasonId`/club/season display context stays the drawn one, so the wheel still "found" them at that club while you draft the peak version of who they are. The substituted row's `id` is what actually gets drafted, so a player who peaked at a different club/season is fine — `DraftPage`'s existing `draftedIds` guard (keyed by `id`) already prevents drafting the same real person twice even if the wheel lands on them via two different club-seasons.
- **Managers** (`RefManager` + `prisma/seed-managers.ts`): 100 real, well-known managers, hand-curated (not ETL'd — small enough to author directly) with a real `name`/`nationality` and a tactical profile (`mentality`/`tempo`/`width`/`pressing`/`passingStyle`/`managerPhilosophy`) synthesized from well-documented public tactical analysis — same "real facts, our own derived rating" split as player `overall`, not copied from any FM/proprietary manager-attribute system. `WorldClub.refManagerId` is a **live FK** into `RefManager` (not copy-on-write like `WorldPlayer` — a manager's tactics don't evolve during a world's life, so there's nothing to snapshot). The user's own club gets whichever manager they draw via `POST /catalog/roll-manager` (optional, gated by the Setup "Managers" toggle; `refManagerId` rides along in the `draftFantasy` payload); `SeasonsService.fillAiClubs` assigns every AI-filled opponent club a random manager **unconditionally**, regardless of the human's own choice — tactical variety in the league only matters if all ~20 clubs have one, not just the user's.
- **World/save state** (`World`, `WorldClub`, `WorldPlayer`, `Season`, `Competition`, `Fixture`, `Match`, `MatchEvent`, `PlayerMatchStat`, ...): copy-on-write per save, everything scoped by `worldId`. Drafting copies `RefPlayerSeason` rows into new `WorldPlayer` rows with their own ids — **`WorldClub.lineup`/`.bench` (JSON `{position, playerId}[]`) must reference the new `WorldPlayer.id`, not the source `RefPlayerSeason.id`**. This bit a real bug once (see `apps/api/src/common/instantiate-world-club.ts` — it creates the `WorldClub` with an empty lineup first, creates all `WorldPlayer` rows, then updates the lineup/bench with the mapped ids). Any new code path that creates world players from ref data must follow the same two-phase pattern.

### Simulation engine contract (packages/engine)

`simulate(setup: MatchSetup, seed: bigint): MatchResult` is a **pure, deterministic function** — same inputs always produce the same output. All randomness goes through `createRng(seed)` (mulberry32); never `Math.random()`, never wall-clock time. Callers (currently only `apps/sim-worker`) generate a fresh random seed per match and persist `{setup, seed, engineVersion}` alongside the result for reproducibility/audit.

Internals worth knowing before touching `simulate.ts`: player attributes → `computePlayerQuality()` (per-dimension 0-1 scores) → `computeUnitRatings()` (aggregated per team, weighted by `POSITION_UNIT_WEIGHTS`) → tactics/home-advantage/weather modifiers applied once at kickoff → per-minute loop applies fatigue, momentum, then rolls chances/shots/cards/injuries/subs. Tuning constants live in `packages/engine/src/constants.ts` and are calibrated against realistic targets by `tools/sim-lab` (goal distribution, home-advantage, favorite-win-rate vs quality gap) — if you change a constant, rerun `pnpm --filter @futbol/sim-lab test` and `exec tsx src/report.ts` to confirm the distributions still look like real football.

**Tactics** (`strength.ts` `applyTactics()`): all five `Tactics` dimensions now have real mechanical effect. `mentality` shifts attack/defence balance (±18% at the extremes); `width` and `passingStyle` shift creation/attack/defence more modestly (±4-8%, same order of magnitude as the weather/home-advantage modifiers — deliberately kept well under mentality's swing so as not to destabilize calibration); `tempo`/`pressing` accelerate fatigue decay in `simulate.ts`'s `liveRatings()`. `managerPhilosophy` is **display-only** (shown in the UI, curated to already be narratively consistent with a given manager's mechanical fields) — it has no separate engine modifier, to avoid double-counting the same underlying tactical identity. Any change here needs the sim-lab recalibration step above; a contrasting-tactics sanity check (equal quality, only tactics differ) is a good way to confirm a new modifier has the intended directional effect before trusting the calibration numbers alone.

### Season simulation flow (api → queue → worker)

`apps/api`'s `SeasonsService.requestSimulation` marks the season `IN_PROGRESS` and enqueues a job (`SEASON_SIM_QUEUE` name + `SeasonSimJob` shape, both defined in `packages/domain/src/jobs.ts` so producer and consumer share the contract) onto BullMQ. `apps/sim-worker`'s `processSeasonSimJob` picks it up, rebuilds each fixture's `Squad` from persisted `WorldClub`/`WorldPlayer` rows (`build-squad.ts`), looks up each side's `WorldClub.refManager` and builds their `Tactics` from it (falling back to the shared `DEFAULT_TACTICS` for a manager-less club — see `tacticsForManager()`), calls `simulate()`, persists `Match`/`MatchEvent`/`PlayerMatchStat`, marks the `Fixture` completed, applies a light post-match fitness dip, and marks the `Season` completed once every fixture has a result. Morale/form progression between matches is intentionally not implemented yet (Phase 3/club-management territory) — don't add it ad hoc; note it in the plan doc instead.

### Auth: guest-first

`POST /auth/guest` creates a `User` with just a `displayName` (`email`/`passwordHash` nullable, `isGuest: true`) and issues a JWT — no signup friction to start playing. `POST /auth/upgrade` (authenticated) attaches `email`/`passwordHash` to that *same* user row (`isGuest: false`), so a guest's worlds/history carry over rather than requiring a fresh account. `register`/`login` are the traditional email+password paths for users who already upgraded. Don't reintroduce a hard login gate in front of `apps/web`'s entry flow — username-only play is a deliberate product decision, not a placeholder.

Two auth gotchas already hit once, worth knowing before touching this code:
- `JwtModule.register({ secret: process.env.JWT_SECRET })` in `auth.module.ts` reads `process.env` at **module-evaluation time**, which is before `@nestjs/config`'s `ConfigModule.forRoot()` has loaded `.env`. `apps/api/src/main.ts` therefore does `import "dotenv/config"` as its literal first line — before importing `AppModule` — so env vars are populated before any static `.register()` calls run. Don't remove that import or reorder it after the `AppModule` import.
- CJS packages without a normal ESM interop shape (e.g. `bcryptjs`) need `import bcrypt from "bcryptjs"` (default import), not `import * as bcrypt from "bcryptjs"` — the latter compiles fine but `bcrypt.hash` is `undefined` at runtime under real ESM output.

### Validation

Every Nest controller uses a shared `ZodValidationPipe` (`apps/api/src/common/zod-validation.pipe.ts`) with per-route zod schemas colocated next to each module (`*.schemas.ts`) — there's no `class-validator`/DTO-decorator usage anywhere in this codebase; keep new endpoints consistent with the zod pattern.

### apps/web: routing, the draft flow, and the design system

`apps/web` has real client-side routing now (`react-router-dom`, wired in `App.tsx`): `/` (`LandingPage`), `/signin` (`AuthPage`), `/setup` (`SetupPage`), `/draft` (`DraftPage`), `/season` (`SeasonPage`), `/multiplayer` (`MultiplayerPage`). Auth stays guest-first per above — landing and setup are browsable without a token; a JWT is only requested (via `GuestGateModal`) at the point an authenticated call is actually needed (confirming a drafted XI).

**Draft session state** lives in `apps/web/src/state/DraftContext.tsx` (config, in-progress `picks`, reroll budget, squad name, `worldId`) — entirely client-side and ephemeral (lost on a full page reload) until `DraftPage`'s confirm step calls `createWorld` + `draftFantasy`. `SetupPage` writes the config; `DraftPage` reads/mutates picks; `SeasonPage` reads `worldId` to fetch the resulting world. `apps/web/src/lib/formations.ts` hand-mirrors the backend's `FORMATION_POSITIONS` map (`apps/api/src/common/lineup.ts`) for pitch-slot layout and position-group coloring — keep the two in sync if formations change.

**The spin-the-wheel draft** (`DrawReel` component + `DraftPage`): a client-side random pick from `listClubSeasons` filtered by league/era-year-range (not the backend's `/catalog/roll`, since that endpoint doesn't support the year-range narrowing the UI offers). Gotcha already hit once: the same club-season can be drawn twice across separate spins, and since a club's placeholder-seed players are named generically ("Club Player 1", "Club Player 2", ...), it's easy to pick what *looks* like a duplicate. The real risk is picking the literal same `RefPlayerSeason.id` into two different slots — `draftFantasy`'s backend lookup (`findMany({ id: { in: ids } })`) silently collapses duplicate ids, so a squad with a true duplicate fails late with a generic "not found" error. `DraftPage` guards against this client-side (`draftedIds` set, disables/tags already-picked players in the pool) rather than relying on the backend to catch it. One pick per spin, by design — drawing a club shows its full squad, but choosing a player closes that draw and the next slot needs a fresh spin.

**Post-draft manager step**: once all 11 slots are filled and the Setup "Managers" toggle is on, `DraftPage` offers a real `/catalog/roll-manager` spin (`ManagerDto` — real name/nationality/philosophy/tactics, not the old fictional `MANAGER_NAMES` stub) before the final `draftFantasy` submission; declining ("No manager (classic)") leaves `refManagerId` unset and the club falls back to `DEFAULT_TACTICS` at simulation time.

**Player photos** (`RefPlayer.photoUrl` → `WorldPlayer.photoUrl`, copied at draft time by `instantiate-world-club.ts`): rendered directly as `<img>` in `PitchView`, `PlayerPickCard`, and `DraftedPlayerRow`, each with an `onError` handler that hides the broken image and falls back to the existing initials/rating badge — fictional players (`photoUrl: null`) hit that fallback by design, not as an error case.

**Design system**: a deliberately distinct palette from typical dark-mode draft-game references — warm charcoal (`ink-*`) base, `paper` (off-white, never pure white) text, `gold` primary/celebration accent, `teal`/`plum`/`crimson` secondary accents, `grass-*` reserved only for the literal pitch graphic. Shape language is angular clipped-corner ("ticket stub") via the `.notch`/`.notch-sm` CSS utilities (`apps/web/src/styles/index.css`) instead of rounded corners, `Oswald` (display) + `Work Sans` (body) instead of a generic geometric sans. Position-group colors are centralized in `apps/web/src/lib/positionColors.ts` (`GROUP_FILL`/`GROUP_TINT`/`GROUP_TEXT`/`GROUP_HALO`) — reuse these rather than inlining new color-per-position logic. New UI work in `apps/web` should stay within this token set rather than reaching for stock Tailwind colors or rounded-corner defaults.

### Testing conventions

Vitest everywhere. Business logic that doesn't need Nest/Prisma/a browser is factored into plain, dependency-free functions specifically so it's unit-testable without mocking infrastructure: `apps/api/src/common/lineup.ts` (greedy formation-slot assignment), `apps/api/src/seasons/round-robin.ts` (circle-method fixture generation), `apps/sim-worker/src/build-squad.ts` (Prisma-row → domain-`Squad` reconstruction). `packages/engine/src/testing/` (exported via the `@futbol/engine/testing` subpath) provides deterministic squad/match-setup fixture generators reused by both the engine's own tests and `tools/sim-lab`.
