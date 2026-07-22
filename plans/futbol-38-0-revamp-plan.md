# Futbol → 38-0 Parity Revamp — Extremely Detailed Phased Plan

**Goal**: rebuild Futbol so it delivers the full 38-0.app experience — every mode, every UI/UX beat, every mechanic documented in [38-0-app-research.md](38-0-app-research.md) and [38-0-research-notes.md](38-0-research-notes.md) — but spanning the **top-5 European leagues** (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1) instead of the English top flight only.

This plan is grounded in a fresh audit of the current codebase (2026-07-22). Read it top to bottom before starting any phase; the Current-State Audit (§3) is what keeps us from re-planning work that already exists.

---

## 0. How to read this plan

- Each phase has: **Goal**, **Why it's placed here**, **Work items** (broken into `web` / `api` / `db` / `engine` / `test`), **New files**, **Acceptance criteria**, and **Top-5 notes**.
- Work items reference real files from our tree so they're actionable, not abstract.
- "38-0 §N" cross-references point at sections of [38-0-app-research.md](38-0-app-research.md).
- A phase is *done* only when its acceptance criteria pass AND the standard gates are green: `pnpm typecheck`, `pnpm test`, and (for engine-touching work) the sim-lab recalibration (`pnpm --filter @futbol/sim-lab test` + `exec tsx src/report.ts`).
- Phases are ordered by dependency and by value-per-effort. Phases 1–5 rebuild the **solo core loop** to full parity (this is the bulk of "make it exactly like that"). Phases 6–10 add the surrounding modes.

---

## 1. Key product decisions — CONFIRMED 2026-07-22

All three confirmed by the user; the plan is built around these.
- **A — Design**: ✅ Keep our mint design system; match 38-0's UX/flow/mechanics, not their dark skin.
- **B — Draft scope**: ✅ Per-league default + a new optional "All Top-5" cross-league mix.
- **C — Priority**: ✅ Solo core first (Phases 0–5) before the surrounding modes.

### Decision A — Visual design language: keep our mint system, adopt their information architecture. **(CONFIRMED)**
38-0 is near-black + emerald. We *just* overhauled to a mint-green / rounded-corner system (latest commit `de9ee74`). "Exactly like that" almost certainly means the **flow, screens, mechanics, and layouts**, not throwing away a design system built days ago. So: **keep the `ink-*`/`mint`/`paper` token set and `.notch` shape language**, but restructure every screen's *content and interaction* to match 38-0 exactly (their panels, their ordering, their live readouts, their narrative blocks). Where they use color to signal meaning (gold = trophy, amber-orange = "risky gamble", red = danger/relegation), we map onto our existing accents (`amber` for trophies, `crimson` for danger) rather than importing their palette.
- *Override option*: if you literally want 38-0's dark-emerald skin, that's a Phase 0 token swap — cheap to do, but discards the recent mint overhaul.

### Decision B — Draft scope across top-5. **(recommended: per-league draft, with an optional "All Top-5" mix)**
38-0 has no league picker (PL only). We already have one (`LeaguePicker`, `SetupPage`). For top-5:
- **Default**: you pick ONE league at setup; the wheel draws club-seasons from that league's whole history; AI-fill is that league's current clubs (our existing `fillAiClubsFromLeague`). This is the cleanest analogue to 38-0's "one division" model and needs the least new work.
- **Plus a new "All Top-5" option**: wheel draws from all five leagues' histories mixed (a true cross-league all-star draft); AI-fill is a **synthetic 20-club "European Super League"** of the current strongest clubs across all five. This is the top-5 analogue of 38-0's "all-time XI from anywhere" and is the headline differentiator vs 38-0.
- *Override option*: make "All Top-5" the default instead of per-league.

### Decision C — Mode scope & priority. **(recommended: solo-core-first)**
Ship the solo core loop to full parity (Phases 1–5) before the surrounding modes (6–10). Rationale: 38-0 themselves shipped solo-draft-and-simulate first and everything else afterward (their own timeline, 38-0 §8), and the solo loop is where "it's so much better" is most visible. Leaderboard/One-Club/Daily/Multiplayer/Nations are each independently shippable afterward.
- *Override option*: pull a specific later mode forward (e.g. Leaderboard early for virality).

---

## 2. Guiding principles (apply in every phase)

1. **Reuse the wheel.** 38-0's power move is that One-Club, Daily, and the January window all re-enter the *same* `DrawReel`/`SlotReel` draft widget. Build every new "pick a player" surface on our existing reel components, never a new picker.
2. **Live feedback over end-of-flow reveals.** Their draft shows a running OVERALL + per-unit readout after every pick; their draft/daily shows live odds. We currently compute odds only once at squad-complete. Bias toward continuous, per-action feedback.
3. **Narrative over bare numbers.** Their biggest edge is procedurally-generated prose. Every stats surface should pair the number with a sentence.
4. **The schema is ready.** `Transfer`, `Award`, `WorldRecord`, `Achievement` models already exist unused (`schema.prisma:504-565`). Wire them, don't invent new ones, unless a genuinely new shape is needed.
5. **Determinism & calibration are sacred.** Every engine constant change re-runs sim-lab. Every `simulate()` call stays pure. January transfers must persist as auditable `Transfer` rows + re-snapshotted `WorldPlayer`s, same copy-on-write discipline as drafting.
6. **Top-5 is a data-scope change, not a mechanic change.** Almost everything generalizes by swapping "the one English league" for "the chosen league (or All Top-5)". Call out the few places it's genuinely different (European Nights, One-Club count, AI-fill pools).

---

## 3. Current-state audit — what already exists (do NOT re-plan these)

| 38-0 feature (research §) | Our current status | File(s) |
|---|---|---|
| Guest-first auth, JWT 24h | ✅ Have | `auth.*`, `GuestGateModal.tsx` |
| Setup: League picker (top-5 filtered) | ✅ Have (single-select) | `SetupPage.tsx`, `LeaguePicker.tsx`, `leagues.ts` |
| Setup: Formation picker | ✅ Have — **10 of their 12** | `FormationPicker.tsx`, `formations.ts` |
| Setup: Difficulty (reroll+ratings coupling) | ✅ Have | `SetupPage.tsx`, `DraftContext.tsx` |
| Setup: Show Ratings toggle | ✅ Have | `SetupPage.tsx` |
| Setup: Draft Mode (squad/position-first) | ⚠️ Config exists; **verify position-first is fully wired in `DraftPage`** | `DraftContext.tsx`, `DraftPage.tsx` |
| Setup: Player Ratings (season/prime) | ✅ Have, incl. backend | `catalog.service.ts` (`ratingsMode`) |
| Setup: Era range slider + presets | ✅ Have | `SetupPage.tsx`, `RangeSlider.tsx` |
| Setup: Advanced toggles (Managers/Europe/January) | ⚠️ UI exists; **Europe & January toggles are DEAD client-side state** (never sent to backend) | `SetupPage.tsx`, `DraftContext.tsx`, CLAUDE.md |
| Spin-the-wheel draft (pre-decided winner, reel settle) | ✅ Have | `DrawReel.tsx`, `SlotReel.tsx`, `DraftPage.tsx` |
| Player pool w/ position-eligibility chips | ✅ Have | `PlayerPickCard.tsx`, `formations.ts` (`canPlayPosition`) |
| Deadlock guard / auto-reroll | ✅ Have (post-hoc) | `DraftPage.tsx` (`MAX_AUTO_REROLL_ATTEMPTS`) |
| Duplicate-player prevention | ✅ Have | `DraftPage.tsx` (`draftedIds`) |
| Manager roll + decline | ✅ Have | `DraftPage.tsx`, `catalog` roll-manager |
| Pre-season odds panel | ✅ Have (win/top4/relegation/finish) — **missing Top6/Top10 bands** | `DraftPage.tsx` (`computePreseasonOdds`), `DraftPage.odds.test.ts` |
| Animated season reveal | ✅ Have (popup reel, filtered to own fixtures) | `SeasonPage.tsx` (`MatchPopupReel`) |
| Champions League / Europe (top-8, QF→SF→Final) | ✅ Have | `europe.service.ts`, `KnockoutBracket.tsx` |
| Post-season stats hub (Golden Boot, MVP, top-10) | ✅ Have | `CompetitionStatsPanel.tsx`, `seasons.service.ts` (`getCompetitionStats`) |
| Standings w/ "(You)" tag | ✅ Have | `StandingsTable.tsx` |
| Team season stats | ✅ Have | `TeamStatsPanel.tsx`, `getTeamStats` |
| Share card | ✅ Have (one generic) | `ShareCard.tsx` |
| Schema for transfers/awards/records/achievements | ✅ Models exist, **unused** | `schema.prisma:504-565` |
| `PlayerMatchStat` incl. assists | ✅ Data captured | `schema.prisma:397` |

### Confirmed GAPS (everything below is net-new work in this plan)
- **Setup**: ~~2 missing formations~~ ✅ done in Phase 0; ~~wire the 2 dead toggles~~ ✅ done in Phase 0.
- **Draft** (revised after a direct code audit at the start of Phase 0 — see Phase 1 for the corrected, much smaller scope): squad-ratings panel needs to render progressively instead of only at squad-complete; reroll pip indicator (cosmetic, the count itself already shows); tap-anywhere/Space-to-spin; Top-6/Top-10 odds bands. **Already built, contrary to the original research-only assumption**: player-pool sort control, "Move a player" reposition, and the underlying live squad-ratings computation itself (just gated wrong) — CLAUDE.md's prose summary undersold how much of this screen already exists.
- **Season sim**: continuous newest-first feed (vs discrete popups); persistent skip control.
- **January Transfer Window**: entire mechanic — backend event resolution + frontend gamble flow.
- **End-of-season**: auto-generated narrative block; Playmaker (assists) + Golden Glove (clean sheets) awards; manager stat card; season totals strip; full match log view; squad-tier flavor names; two-way share (season + January); end-of-season guest-persistence prompt.
- **New modes**: Leaderboard (global, filtered, verified, handle-gated); One-Club XI; Daily Challenge; async Leagues + Live Draft multiplayer; Nations Trophy.
- **Content pages**: How It Works, How to Play, Greatest XI, Story (none exist yet).
- **Persistence layer**: trophies/history/records tied to accounts; per-user run archive.

---

## 4. Top-5-leagues adaptation — cross-cutting strategy

Applies across all phases; each phase's "Top-5 notes" points back here.

1. **Data**: we already seed real top-5 data (`seed-real.ts`, `real-top5-2012-2024.json.gz`). Confirm coverage depth per league is sufficient for a full draft pool (38-0 quotes 4,000+ player-seasons over 34 seasons for one country; our five-country dataset is 2012-2024 — **shorter era window**). *Action in Phase 0*: audit dataset breadth and decide whether to extend the ETL era range (`tools/data-etl/`) so an "All-time" era feels as deep as 38-0's.
2. **Draft pool scoping** (Decision B): per-league or All-Top-5. `catalog.service.ts` `listPlayerSeasons` + the web draft pool fetch already filter by league; add an "All Top-5" pseudo-selection.
3. **AI-fill**: `fillAiClubsFromLeague` already sizes to the chosen league's real current club count (20 PL/LaLiga/Serie A, 18 Bundesliga/Ligue 1). For "All Top-5", add a new fill path producing a 20-club cross-league elite division.
4. **European Nights**: 38-0's Europe is a scaled-down single-division cup. With five real leagues we can make it *more* real: qualifiers pooled across leagues into one continental competition. But to avoid scope creep, **Phase-4 keeps our existing top-8-of-your-division model**; a "true multi-league UCL" is an explicit stretch item (Phase 10+).
5. **Club counts**: One-Club XI (Phase 7) spans ~all top-5 clubs in the dataset (far more than 38-0's 49); Daily Challenge (Phase 8) constraints reference top-5 clubs/nationalities; Leaderboard (Phase 6) club filter lists top-5 clubs. All just consume the existing catalog — no special-casing.
6. **Copy/branding**: every "English top-flight" string becomes "top-5 European" / "Europe's top leagues". Landing, FAQ, How-It-Works, meta titles.

---

## 5. PHASE 0 — Foundations, decisions lock-in, and quick parity wins — ✅ COMPLETE (2026-07-22)

All work items done, all acceptance criteria met: 12 formations selectable end-to-end (web/api/domain/engine all in sync), `europeanNights`/`januaryWindow` persisted on `World.settings` and actually read (Europe qualification now genuinely skips when off, test-covered), position-first draft mode confirmed fully wired (no changes needed), dataset depth audited with concrete numbers recorded above. `pnpm typecheck` and `pnpm test` both green across all 10 packages. Migration `20260721223204_add_world_settings` applied to the dev database.



**Goal**: clear the cheap, unblocking gaps so later phases build on a clean base.
**Why here**: everything downstream assumes 12 formations, live toggles, and a known dataset depth.

**Work items**
- `web` — Add the 2 missing formations **4-1-2-1-2** and **4-2-2-2** to `formations.ts`: extend `FORMATIONS`, `FORMATION_POSITIONS`, `FORMATION_DESCRIPTIONS`, `FORMATION_COORDS`. Mirror them in the backend map.
- `api` — Add the same 2 formations to `apps/api/src/common/lineup.ts` `FORMATION_POSITIONS` (the two maps MUST stay in sync per CLAUDE.md). Extend `lineup.test.ts`.
- **`domain`** (discovered doing this work, not in the original audit) — `packages/domain/src/tactics.ts`'s `formation` zod enum is a *third* place formations are declared, and it gates `draftFantasySchema`/`draftClubSchema` validation — missing entries here reject the new formations at draft-confirm time even though the web UI happily offers them. Must extend alongside the other two.
- **`engine`** (also discovered doing this work) — `packages/engine/src/testing/fixtures.ts` has a *fourth* `FORMATION_POSITIONS` copy (typed against `@futbol/domain`'s `Formation`), used only by engine/sim-lab test fixtures — TS catches a missing entry at compile time here (`Record<Formation, Position[]>` becomes non-exhaustive), which is how this one was actually found. **Running note for future formation changes: there are now 4 formation-position maps to keep in sync** (`apps/web/src/lib/formations.ts`, `apps/api/src/common/lineup.ts`, `packages/domain/src/tactics.ts`'s enum, `packages/engine/src/testing/fixtures.ts`) — CLAUDE.md only documented the first two.
- `web`/`api` — **Wire the dead toggles.** `europeanNights` and `januaryWindow` must ride along in the `draftFantasy`/world-creation payload and be persisted on the `World` (add `europeanNights Boolean` + `januaryWindow Boolean` columns, or a `settings Json`). Update `worlds.schemas.ts`, `worlds.service.ts`, `draft.service.ts`.
- `db` — Migration for the two new `World` settings columns (or a `World.settings Json`). Prefer a single `settings Json` blob to avoid churn as more toggles land.
- `web` — Verify **position-first draft mode** actually works end-to-end in `DraftPage`; if it's config-only, either finish it or hide the option until Phase 1 completes it.
- `data` — Audit top-5 dataset depth (seasons/players per league). Decide + ticket any ETL era-window extension (`tools/data-etl/`). Not a blocker for Phase 1 but sizes the "All-time" feel.
  **AUDITED 2026-07-22** (`packages/db/prisma/data/real-top5-2012-2024.json.gz`, decompressed + counted directly):

  | League | Seasons | Distinct clubs | Club-seasons | Player-seasons |
  |---|---|---|---|---|
  | Premier League | 2012–2024 (13) | 37 | 259 | 5,509 |
  | LaLiga | 2012–2024 (13) | 32 | 258 | 5,712 |
  | Serie A | 2012–2024 (13) | 38 | 260 | 5,917 |
  | Bundesliga | 2012–2024 (13) | 31 | 234 | 4,889 |
  | Ligue 1 | 2012–2024 (13) | 35 | 253 | 5,488 |
  | **All 5 combined** | 2012–2024 (13) | **173 clubs** | 1,264 | **27,515** |

  vs 38-0: 34 seasons (1992-93–2025/26), 49 clubs, 4,000+ player-seasons, one league.

  **Finding**: per-league *density* is not the gap — every single one of our five leagues individually already has more player-seasons (4,900–5,900) than 38-0's entire one-league total (4,000+), and combined we have 27,515 across 173 clubs vs their 49. The real gap is **historical depth**: our data starts at 2012, theirs at 1992 — 13 seasons of coverage vs 34. Every 90s/2000s club-season (Invincibles-era Arsenal, Ferguson's early Man Utd treble side, etc.) that makes 38-0's "any era" pitch land is currently outside our range entirely.
  **Decision**: defer the ETL era-back-extension (`tools/data-etl/`, sourcing 1992–2011 for all five leagues) as its own scoped data-sourcing project rather than folding it into Phase 0 — it's a real scraping/verification effort, not a quick win, and doesn't block Phases 1–9's mechanics work (which are era-range-agnostic). It IS a prerequisite for the "All-time" era preset and the Decision-B "All Top-5" mode to feel as deep as 38-0's. Flagged as a standing backlog item — revisit before or alongside Phase 10 (content/polish), or sooner if era depth is user-tested as a felt gap.
- `web` — Decision-A token confirmation: no code change if we keep mint; if overriding to dark-emerald, do the token swap in `styles/index.css` + `tailwind.config.ts` here.

**Acceptance criteria**
- 12 formations selectable, both maps in sync, `lineup.test.ts` + `formations.test.ts` green.
- Toggling European Nights off actually suppresses Europe; toggling January off actually suppresses the January window (verifiable once Phases 3–4 land — until then, the flag is persisted and read).
- Dataset-depth decision recorded in this doc.

**Top-5 notes**: dataset audit is the main top-5-specific item.

---

## 6. PHASE 1 — Draft Room revamp (full parity with 38-0's draft screen) — ✅ COMPLETE (2026-07-22)

All corrected-scope work items done. Squad-ratings panel now renders progressively (from the very first pick, gated on `filledCount > 0` instead of `allFilled`), with a new `RatingBarOrEmpty` helper showing "–" for any still-empty unit instead of a misleading 0. Reroll pips added alongside the existing count. Tap-anywhere turned out to be partially built already too — `DrawReel.tsx` already had a Space-bar keydown listener wired end-to-end (missed in the initial audit because the earlier grep only checked `DraftPage.tsx`, not its child components); added the missing "tap the reel" half as a click handler on the reel box specifically (not wrapping the "Make the Draw" button, to avoid a double-fire-on-bubble hazard — verified with a dedicated regression test). Pre-season odds now show all 5 bands (win/top4/top6/top10/relegation) reusing the same continuous rank-distribution math, monotonicity guaranteed by construction. Pre-filtering the spin pool (vs. the existing post-hoc auto-reroll) was assessed and intentionally deferred — the current mechanism already delivers 38-0's "never truly stuck" outcome, so it didn't meet the bar for this phase.

New/extended tests: `DraftPage.odds.test.ts` (+4 assertions, +2 new tests for top6/top10 extremes), `DrawReel.test.tsx` (+3 tests: tap-the-reel spins, no double-fire when the button's click bubbles, inert while spinning/disabled), `DraftPage.liveRatings.test.tsx` (new file: panel absent at zero picks, present with correct partial values after the first pick). All 13 web test files / 53 tests green; full monorepo typecheck clean across all 10 packages.



**Goal**: our `/draft` matches 38-0 §4 beat for beat.
**Why here**: the draft is the most-used screen and the most directly comparable; several later phases (Daily, One-Club) reuse these components.

**⚠️ Correction from a direct code audit (2026-07-22), done at the start of Phase 0**: `DraftPage.tsx` already implements far more of this phase than the original research-only pass assumed (that pass worked from CLAUDE.md's prose summary, not the file itself). Confirmed already built and working, with tests green:
- ✅ **Live squad-ratings computation** exists (`squadRatings` useMemo → `RatingBar` rows for Attack/Midfield/Defence/Goalkeeping) — **but it's gated behind `allFilled && config.showRatings`**, i.e. it only renders once the *entire* squad is done, not progressively after each pick like 38-0. This is the one real remaining gap in this item.
- ✅ **"Move a player"** is fully built: a `moveMode`/`moveSourceIndex` state machine, a toggle button ("⇄ Move a player" / "Cancel move"), pitch-click-to-pick-up/drop-in flow, `canPlayPosition`-gated, with its own empty-state copy. Nothing to build here.
- ✅ **Player-pool SORT control** is fully built: `SortMode` state (rating/position/surname), a 3-way button row above the pool, `sortPlayers()` helper. Nothing to build here.
- ✅ **Reroll display** exists as a plain number (`Redraws: {rerollsRemaining}` in the header stat tile), not 38-0's dot/pip row. Cosmetic gap only.
- ✅ **"No dead spin"** already has a safety net: `doSpin()` recursively auto-rerolls (up to `MAX_AUTO_REROLL_ATTEMPTS`) past any drawn club with nobody eligible for the target slot, silently and at no cost to the user's redraw budget (tested in `DraftPage.deadlock.test.tsx`). This is 38-0's *outcome* (you never get stuck on a dead squad) via a different mechanism (post-hoc reroll vs. their claimed pre-filter) — functionally equivalent from the player's seat. Not a blocking gap.
- ❌ **Tap-anywhere / Space-to-spin** — confirmed genuinely missing (no keyboard listener anywhere in `DraftPage.tsx`). Real gap, small fix.
- ❌ **Top-6 / Top-10 odds bands** — confirmed genuinely missing; `computePreseasonOdds` only returns `winPct`/`top4Pct`/`relegationPct`. Real gap.

Given this, Phase 1's actual scope is much smaller than originally drafted:

**Work items**
- `web` — **Make the squad-ratings panel live/progressive**: remove the `allFilled` gate so `RatingBar`s render (with "–"/0 for empty units) from the very first pick onward, not just at squad-complete. Reuse the existing `squadRatings`/`RatingBar` wiring — this is a rendering-condition change, not new plumbing.
- `web` — **Reroll pip indicator**: add a dot row (mint/plum filled pip per remaining reroll) alongside the existing "Redraws: N" tile — additive, don't remove the number.
- `web` — **Tap-anywhere / Space-to-spin**: a `keydown` listener (Space) plus a click handler on the idle spin panel, both calling the same `doSpin()` path already wired to the button; guard so it's inert while `spinning`, while a `pendingPlayer`/pool is open, or while `moveMode` is active.
- `web` — **Pre-season odds: add Top-6 and Top-10 bands**, colored distinctly (win=amber, top4=mint, top6=teal, top10=plum, relegation=crimson). Extend `computePreseasonOdds` + `DraftPage.odds.test.ts`, preserving its existing monotonicity/consistency assertions and adding the two new bands to them.
- `web`(optional, low priority) — **Pre-filter the spin pool** instead of relying purely on post-hoc reroll, if a cheap client-side filter is feasible against the fetched `pool`. Not required for parity (the current mechanism already delivers 38-0's "never truly stuck" outcome) — demote to a nice-to-have unless profiling shows the auto-reroll firing often enough to be visibly janky.
- `test` — Update the odds test for the 2 new bands; add a small test asserting the ratings panel renders after the first pick (not just at completion); add a Space-to-spin test alongside the existing `SlotReel`/`DrawReel` tests.

**Acceptance criteria**
- Squad-ratings panel visibly updates after every single pick, not just the last one.
- Reroll pips shown alongside the existing count.
- Space and a full-panel tap both trigger a spin when idle, inert otherwise.
- Pre-season odds show 5 bands (win/top4/top6/top10/relegation).
- All existing draft tests (`DraftPage.deadlock.test.tsx`, `SlotReel.test.tsx`, `DrawReel.test.tsx`, `DraftPage.odds.test.ts`) still pass.

**Top-5 notes**: if Decision B's "All Top-5" is enabled, the pool fetch (already league-filtered via `config.leagueIds`) needs a union-of-five-leagues path; SORT and eligibility logic are already league-agnostic.

---

## 7. PHASE 2 — Season reveal revamp (continuous feed) — ✅ COMPLETE (2026-07-22)

Rewrote `MatchPopupReel.tsx` from a one-card-at-a-time replace/exit component (old card animates out, new one animates in, `AnimatePresence mode="wait"`) into a genuinely accumulating feed: cards pile up newest-first as they reveal, nothing ever exits, and a live `StatStrip` (Won/Drawn/Lost/Pts + GF·GA·GD) recomputes after every reveal from the accumulated matches so far. The card format itself was also brought in line with 38-0 (§5a) and, not coincidentally, with our own existing `MatchLog.tsx` (the post-season "full match log" component, which turned out to already implement almost exactly this visual language — W/D/L badge, `GW<n>`, opponent + (H)/(A), score, own-goals-only scorer line): factored the shared "reframe a match from one club's perspective" logic that both components need into a new `apps/web/src/lib/matchResult.ts` (`summarizeForClub`, `accumulateRecord`), and refactored `MatchLog.tsx` to use it too instead of duplicating the same W/D/L/goal-filter logic in two places.

Because `AnimatePresence` is no longer used at all in this component (nothing exits mid-reveal), the `forwardRef` requirement from CLAUDE.md's original gotcha no longer applies here — `FeedCard` is a plain function component now, one less footgun. Completion logic simplified accordingly: no more waiting on an exit-animation callback, `onComplete` fires directly once every match has revealed (or immediately on "Skip ahead," which the component now shows as a small header link, not just an ending fallback).

All 3 `SeasonPage.tsx` call sites (domestic-replay, europe-league-replay, europe-knockout-replay) updated to pass the new required `userClubId` prop (`userClub?.id`) needed to compute the per-club perspective.

**Tests**: rewrote `MatchPopupReel.test.tsx` (6 tests: cycling + completion, skip-ahead, empty-list, **accumulation** (all revealed cards stay visible, newest-first ordering), and the **stat strip's cumulative math** verified against a hand-computed 1W/1D/1L example). Full web suite (13 files / 56 tests) and full monorepo typecheck (10 packages) green, including `SeasonPage.test.tsx`'s existing pipeline-integration tests exercising the new component through all three real call sites unmodified.

**Not done**: a live browser visual check of the actual rendered feed. Reaching it requires driving the full stack (API + Redis + sim-worker + a real drafted squad + a simulated season), and another session already owns this folder's dev server, so standing up a second, possibly port-conflicting instance for a spot-check felt like the wrong tradeoff given the component's behavior and exact rendered text are already pinned by 6 passing tests plus the unmodified full-pipeline `SeasonPage.test.tsx` suite. Flagging this explicitly rather than silently skipping it — say the word if you want a live visual pass.



**Goal**: replace/augment the discrete popup reel with 38-0's continuous newest-first scrolling result feed + persistent skip control (38-0 §5a).
**Why here**: the January window (Phase 3) pauses *inside* this reveal, so the reveal must be restructured first.

**Work items**
- `web` — Refactor `SeasonPage.tsx`'s reveal so completed fixtures stream into a **single vertical feed** of result cards (newest at top, sliding in via framer-motion), with the running stat strip (WON/DRAWN/LOST/PTS + GF·GA·GD) pinned below — instead of / in addition to the one-card-at-a-time `MatchPopupReel`. Keep `MatchCard` as `forwardRef` (AnimatePresence requirement, per CLAUDE.md).
- `web` — **Persistent "Skip" control** that advances to the next checkpoint (January, or end) — reframe our existing "Skip ahead" as an always-visible header link matching "Skip to January →" / "Skip all →".
- `web` — Card format parity: GW badge, W/D/L pill, opponent + (H)/(A), large result-colored score, `⚽ Scorer 54′` one-line-per-goal (no "x2" aggregation).
- `web` — Keep the "own fixtures only" filter (`onlyMine()`), still correct and necessary for our bigger leagues (38-0's league is one campaign; ours is 20 clubs).
- `test` — Update `MatchPopupReel.test.tsx` / add `SeasonFeed.test.tsx`: feed renders newest-first, stat strip accumulates correctly, skip jumps to checkpoint, `onComplete` fires.

**New files**: possibly `components/SeasonFeed.tsx` (may absorb `MatchPopupReel`).

**Acceptance criteria**: reveal reads as one continuous feed with a live-updating stat strip and a persistent skip; existing `SeasonPage.test.tsx` invariants (no stray "Continue" buttons in knockout stages) preserved.

**Top-5 notes**: none beyond copy.

---

## 8. PHASE 3 — January Transfer Window (the flagship new mechanic) — ✅ COMPLETE (2026-07-22)

Implemented per the design below with one simplification: the "forced sale" negative-event variant described in the original Event-variety work item was scoped down to "a downgrade replacement" rather than "remove a player with no replacement" — this keeps the lineup always at 11 starters (required for `buildSquad`/`simulate()` to run), and still delivers a genuine can-hurt-you outcome via a negative OVR delta.

**Schema**: added `JanuaryEvent` model + `JanuaryEventType` enum (`packages/db/prisma/schema.prisma`, migration `20260722082536_add_january_event`) rather than overloading `Transfer` — `Transfer` models a single player moving between two `WorldClub`s, which doesn't fit a catalog-sourced OUT+IN pair, and `Transfer` has no room for event type/delta/idempotency. `@@unique([seasonId, clubId])` on `JanuaryEvent` is the idempotency guard (a club's window resolves once per season). A `Transfer` row is still written for the incoming leg, per the original "audit" ask.

**Engine-pipeline change (the one flagged as architecturally risky)**: `packages/domain/src/jobs.ts`'s `seasonSimJob` gained an optional `throughMatchday`; `apps/sim-worker/src/process-season.ts`'s matchday loop now stops early via a small pure `shouldSimulateMatchday()` helper (unit-tested) rather than the originally-considered "split into two Season rows" approach — one `Season`/`Fixture` set throughout, so standings/stats code needed zero changes. The frontend computes the midpoint client-side from the already-generated fixture list (`Math.floor(maxMatchday / 2)`), calls `simulateSeason` with `{throughMatchday}` for the first half, polls a new `pollUntilMatchdayComplete`, then calls it again with no cutoff for the back half — reusing the existing single-`Season` completion semantics untouched.

**Backend**: new `apps/api/src/january/` module (`january.service.ts` + a Prisma-free `january.logic.ts` for the testable pieces — weighted event-type roll, weakest-occupied-slot detection, candidate-pool biasing — following the `lineup.ts`/`round-robin.ts` pattern of extracting pure logic out of Prisma-coupled services). `POST /worlds/:worldId/january/:seasonId/resolve` finds the user's weakest lineup slot, rolls POSITIVE/NEUTRAL/NEGATIVE (35/40/25), draws a replacement `RefPlayerSeason` scoped to the world's era + the club's own league (falling back to the unbiased pool if the biased slice is empty), instantiates a `WorldPlayer` (same field mapping as `instantiate-world-club.ts`), and patches the lineup slot — all in one transaction.

**Frontend**: `SeasonPage.tsx`'s `runSeasonPipeline` branches on `(settings.januaryWindow ?? true) && userClub && 0 < mid < total`; when enabled it reveals the first-half matches through the existing `MatchPopupReel` (remounted via a `domesticReelHalf` key), pauses on a new `"january"` phase rendering the new `JanuaryWindow.tsx` component (recap tiles + on-pace projection + gamble/stick choice, reusing `DrawReel`/`SlotReel` for the CLUB × SEASON spin exactly as the plan asked, danger-styled via the existing crimson/mint conventions rather than importing 38-0's palette), then resumes for the back half. `januaryOutcome` is threaded into `CachedStatsHub` for Phase 4 to consume, though nothing renders it yet.

**Tests**: `january.logic.test.ts` (9 tests), `process-season.test.ts` (3, the matchday-cutoff boundary), `round-robin.test.ts` (+2, locking the 19-of-38 / 17-of-34 midpoint math against the real league sizes), `JanuaryWindow.test.tsx` (4, recap/decline/gamble+diff/error-retry), `SeasonPage.test.tsx` (+2, the pause-then-resume integration and the setting-off no-op). Full monorepo `pnpm typecheck` and `pnpm test` green across all 10 packages (91 tests total). Not done: a live pass against a running API+worker+Redis stack — this environment has no Docker/Redis available to stand one up; the previous phases' live-verification precedent should be repeated in a session where that infra is reachable.

**Goal**: full parity with 38-0 §5b — a halfway pause with recap, an opt-in gamble, a wheel-driven resolution, and an OUT→IN "Done Deal".
**Why here**: depends on the restructured reveal (Phase 2); its outcome text feeds the Phase-4 narrative.

**Work items**
- `engine`/`api` — Decide *when* halfway is. Domestic season is a double round-robin (38 games for 20 clubs). The window triggers at the **exact midpoint matchday** (matchday 19 of 38 for a 20-club league; 17 of 34 for an 18-club league — derive, don't hardcode).
- `api` — **Backend event resolution.** New endpoint on `seasons` (or a new `january` module): given a world at its midpoint, compute the user club's **weakest-rated occupied slot**, draw a random source `RefClubSeason` (reuse catalog roll logic + era/league scope from the world's settings), pick an eligible replacement player, and produce an OUT/IN diff (old overall → new overall, delta). Persist:
  - a `Transfer` row (`schema.prisma:517` — `fromClubId`/`toClubId`/`playerId`/`type: PERMANENT`) for audit,
  - a new `WorldPlayer` for the incoming player (two-phase copy-on-write per `instantiate-world-club.ts` — new id, then patch the `WorldClub.lineup` slot to reference it),
  - and mark the outgoing `WorldPlayer` as departed (soft flag or move off lineup).
- `api` — **Event variety** (38-0 setup copy: "can help or hurt"). Model a small event pool, not just "Bargain Buy": at minimum a **positive** (upgrade-biased draw), a **neutral/random** (any draw, can downgrade), and a **negative** (forced sale / injury to a key player). Encode as a typed enum + weighted roll. Store the drawn event type on the `Transfer` (or a small `JanuaryEvent` record if we want richer history).
- `api` — **Gate on the `januaryWindow` world setting** (wired in Phase 0). Off ⇒ no pause, no endpoint call.
- `web` — **Recap panel** at the midpoint pause (38-0 §5b step 1): "JANUARY TRANSFER WINDOW / Halfway there", W-D-L / Points / GD tiles, and the dynamically-templated on-pace sentence.
- `web` — **Choice** (step 2): "Enter the transfer market" (crimson/amber "risky" styling per Decision A) vs "Stick with your XI".
- `web` — **Gamble resolution** (steps 3-5): reuse `DrawReel`/`SlotReel` to spin CLUB × SEASON, then show the **"DONE DEAL · <POS>"** OUT→IN card with the delta verdict, then "Continue the season" resumes the feed. Distinct danger visual language for the whole event.
- `web` — Thread the January outcome (in/out players, delta, event type) through the season pipeline state so Phase 4's narrative and the results "IN" flag can use it (mind the stale-closure discipline in `SeasonPage`'s `runKnockoutRound` — return values, don't read state late).
- `test` — `api`: weakest-slot detection, transfer persistence + lineup repatch, event-type weighting, gating by setting. `web`: recap renders correct on-pace text; declining resumes unchanged; accepting spins and shows a correct OUT→IN diff.

**New files**: `apps/api/src/january/*` (module/service/schemas), `apps/web/src/components/JanuaryWindow.tsx` (+ tests). Possibly `JanuaryEvent` model in `schema.prisma`.

**Acceptance criteria**
- With January on, the reveal pauses at the derived midpoint; declining resumes cleanly; accepting resolves via the wheel into a persisted transfer and an updated lineup that the *rest of the simulated season already reflects* (the second half must be simulated with the post-transfer squad — confirm the sim ordering: the worker must simulate first-half → pause is a *reveal* pause, so either (a) the whole season is simulated post-choice, or (b) the season is simulated in two halves around the choice). **Design note**: since our worker simulates the whole season as one batch (CLAUDE.md), Phase 3 must split domestic simulation into two batches (matchdays 1..mid, then mid+1..end) so a January transfer can actually affect second-half results. This is the one real engine-pipeline change in the plan — scope it explicitly.
- Event variety demonstrably includes a downgrade/negative outcome.

**Top-5 notes**: the January draw respects the world's league/era scope (per-league or All-Top-5), so an EPL save draws EPL replacements, an All-Top-5 save can draw from anywhere.

---

## 9. PHASE 4 — End-of-season results overhaul (their richest screen) — ✅ COMPLETE (2026-07-22)

Implemented per the design below, with the "full match log" item turning out to already exist from Phase 2 (`MatchLog.tsx`, already wired into the stats-hub under "Season Results"/"Campaign Results") — nothing to build there, confirmed and left as-is.

**Narrative engine** (`apps/web/src/lib/seasonNarrative.ts`, pure, + `components/SeasonNarrative.tsx`): every signal from the spec implemented — verdict tag (recomputes a "projected finish" from the squad's overall via `computePreseasonOdds`, rather than persisting the pre-season projection anywhere, since it's a pure function of overall alone), unit word-tiers + composition sentence (grouped via `lib/formations.ts`'s existing `POSITION_GROUP`, fed by a new `summary.squad`/`summary.squadOverall` the backend now returns), finish-position flavor paragraph (bracket computed proportionally from `seasonSize`, not hardcoded to 20, so an 18-club league gets a correctly-sized relegation zone), January recap lines (from the already-cached `januaryOutcome`), standout-player quote (from existing `teamStats.topScorer`/`topAssist`), manager closing line (from the new `getManagerStats` endpoint's `manager.philosophy`). Deliberately **not** given its own cache slot — it's cheap and pure, recomputed inline in `SeasonPage`'s render from data that's already in `CachedStatsHub`.

**Refactor along the way**: `computePreseasonOdds` moved out of `DraftPage.tsx` into a new `lib/preseasonOdds.ts` — the narrative engine needed it too, and a `lib/` file importing from a `pages/` file would have been a backwards dependency. `DraftPage.odds.test.ts` now imports from the new location; its own tests are untouched otherwise.

**Awards** (`getCompetitionStats` extended): Playmaker (top assister, mirrors the existing Golden Boot pattern) and Golden Glove — attributed to a **named goalkeeper**, not just the club, by parsing the GK slot's `playerId` out of each clean sheet's `Match.setup` JSON (`findGoalkeeperId`, in the new `apps/api/src/seasons/season-stats.logic.ts`) so all four awards read consistently as "a player won this." Awards are computed **live on every read**, same as the existing Golden Boot/MVP — not persisted as `Award` rows despite the original work-item wording, since `Award` has no unique constraint (duplicate-row risk on a second read) and Phase 5 already owns wiring `Award`/`Achievement`/`WorldRecord` together at "season completion," which would need reworking this persistence anyway.

**Manager stat card** (new `getManagerStats` endpoint + `components/ManagerStatCard.tsx`): Clean Sheets / Longest Win Streak / Biggest Win / Highest-Scoring match, walked in matchday order via a new pure `computeManagerStats` (same `season-stats.logic.ts`) so "longest streak" is a genuine consecutive-run count. Scoped to the **domestic league only** (no Europe variant) — matches 38-0's own single-league scope and keeps this from doubling in size for a v1.

**Squad-tier flavor names** (`lib/squadRatings.ts`, new): Galácticos/Elite/Strong/Mid-table/Budget/Minnows bands, surfaced on both the draft-complete screen (`DraftPage.tsx`'s squad-ratings panel + pre-season-projection footer) and the results screen (a badge above `ShareCard`).

**Two-way share**: new `components/JanuaryShareCard.tsx` ("Share your January"), rendered alongside the existing `ShareCard` ("Share your season") only when a January transfer happened this run.

**Tests**: `season-stats.logic.test.ts` (8, goalkeeper-finding + streak/biggest-win/highest-scoring boundaries), `seasonNarrative.test.ts` (21, every signal + bracket boundaries + full/degraded-input assembly), `squadRatings.test.ts` (3, tier boundaries + monotonicity). Extended `SeasonPage.test.tsx` with a real-data render check for the narrative + manager card. Full monorepo `pnpm typecheck` and `pnpm test` green across all 10 packages (web 87 tests, api 32 tests). Not done: a live pass against a running API+worker+Redis stack — same Docker/Redis-unavailable constraint as Phase 3.



**Goal**: parity with 38-0 §6 — the auto-generated narrative, expanded awards, manager card, totals, full log, squad tiers.
**Why here**: consumes January outcome (Phase 3) and the restructured reveal (Phase 2); it's the emotional payoff screen and the biggest single UX gap.

**Work items**
- `web`/`api` — **Auto-generated season narrative engine** (38-0 §6b — the highest-leverage item). Build a **template bank keyed by signals**, no LLM:
  - *Verdict tag*: finished-vs-projected delta → phrase + color (e.g. "OVERACHIEVED"/mint, "AS EXPECTED"/smoke, "FLATTERED TO DECEIVE"/crimson).
  - *Unit word-tiers*: per-unit overall → {Elite/Excellent/Strong/Very good/Solid/Shaky} band labels.
  - *Composition sentence*: names strongest + weakest unit.
  - *Finish-position flavor paragraph*: bracket (champion / top-4 / Europa / mid-table / relegation-scrap / relegated) → templated paragraph with slots for points total and the actual biggest-win fixture+scoreline.
  - *January recap lines* (if gambled): one for the arrival, one for the departure (from Phase 3 outcome).
  - *Standout-player pundit quote*: top performer → bold line + italic "🎙️" aside.
  - *Manager closing line*: echoes the manager's philosophy blurb + the season's shape.
  - Implement as `apps/web/src/lib/seasonNarrative.ts` (pure, unit-testable) fed by a stats bundle; the API just needs to expose the raw signals (most already exist in `getCompetitionStats`/`getTeamStats`). New component `components/SeasonNarrative.tsx`.
- `api` — **Expand awards** (38-0 §6e). In `getCompetitionStats`:
  - **Playmaker** (top assister) — assists already in `PlayerMatchStat`; just aggregate.
  - **Golden Glove** (most clean sheets) — derive per-GK/defence from matches with 0 goals conceded by their club; needs a clean-sheet aggregation query.
  - Keep Golden Boot + MVP.
  - Persist final awards as `Award` rows (`schema.prisma:534`) for history/leaderboard reuse.
- `web`/`api` — **Manager stat card** (38-0 §6f): Clean Sheets / Longest Win Streak / Biggest Win (scoreline+opponent) / Highest-Scoring match, attributed to the world club's manager. New aggregation in `seasons.service.ts`; render in a `components/ManagerStatCard.tsx`.
- `web` — **Season totals strip** (38-0 §6d): W/D/L/Pts/GF/GA as six headline numbers (data already available).
- `web` — **Full match log view** (38-0 §6a): an expandable "view full season" list of all the user's fixtures newest-first (reuse `MatchLog.tsx`).
- `web` — **Squad-tier flavor names** (38-0 §9): map squad overall → {Galácticos/Elite/Strong/Mid-table/Budget/Minnows} in `lib/squadRatings.ts`; surface on results + draft-complete.
- `web` — **Two-way share** (38-0 §6g): the existing `ShareCard` becomes "Share your season"; add a second "Share your January" card summarizing the OUT→IN beat (only if a January transfer happened).
- `web` — Fold this into `SeasonPage`'s existing `"stats-hub"` phase and the `localStorage` stats-hub cache (`saveStatsHubCache`) so the narrative + awards survive reloads.
- `test` — `seasonNarrative.ts` pure tests (each signal → expected phrase family; bracket boundaries; template slot-filling with real fixtures). API tests for Playmaker/Golden Glove/manager aggregations. Extend `SeasonPage.test.tsx`.

**New files**: `lib/seasonNarrative.ts`, `components/SeasonNarrative.tsx`, `components/ManagerStatCard.tsx` (+ tests).

**Acceptance criteria**: results screen renders a full narrative block that correctly references the actual season (biggest win, standout player, manager style, January outcome); four awards present; manager card populated; totals + full log + squad tier shown; two share CTAs when applicable; all cached and reload-safe.

**Top-5 notes**: bracket flavor copy should be league-aware where natural (e.g. "you're going to the Bundesliga's European nights"), but a generic top-5 tone is fine for v1.

---

## 10. PHASE 5 — Persistence, trophies, history, sharing polish — ✅ COMPLETE (2026-07-22)

Implemented per the design below, with the completion-hook question the Phase 4 note left open now resolved: **the frontend, not the worker, calls finalize** (`POST /worlds/:worldId/seasons/:seasonId/finalize`, called from `SeasonPage.tsx` right where `saveStatsHubCache` already fires) — a `Competition` can span several `Season` rows (Europe's league-phase/QF/SF/Final), so only the caller who knows the whole pipeline has actually finished can safely persist. This also means Phase 4's Golden Boot/MVP/Playmaker/Golden Glove — computed live on every `getCompetitionStats` read — now get a durable `Award` row the first time a run is finalized.

**Schema**: added `@@unique` constraints to `Achievement` (`[worldId,userId,key]`), `Award` (`[worldId,seasonId,name]`), and `WorldRecord` (`[worldId,name]`) — all three tables were still empty (confirmed before migrating), so this was a zero-risk migration. Combined with `createMany({ skipDuplicates: true })`, this makes `finalizeRun` safely callable more than once (e.g. a reload mid-stats-hub) without duplicate rows — the exact gap Phase 4's note flagged as needing Phase 5's constraints.

**Trophy catalog split**: `packages/domain/src/trophies.ts`'s `TrophyKey` enum is the shared source of truth for *what* can be unlocked; `apps/api/src/seasons/trophy-evaluation.ts` (pure, unit-tested) decides *whether* a given run unlocked each one; `apps/web/src/lib/trophies.ts` hand-mirrors the same key strings (per apps/web's zero-workspace-deps convention, same as `JanuaryEventType` before it) into a purely-*display* catalog (name/description/icon/color) for `TrophyCabinet.tsx`. Seven trophies: Invincible (won every match) and Unbeaten (no losses, but at least one draw) are mutually exclusive — a perfect record earns the rarer one, not both — plus Champions, and one each for Golden Boot/Playmaker/Golden Glove/MVP when the user's own club holds that award (a richer set than the plan's four illustrative examples, since Phase 4 already computes all four awards and leaving three without a matching trophy would've been an odd asymmetry).

**History page**: `GET /worlds/history` (must be registered before the existing `GET /worlds/:worldId` route — Nest/Express match by registration order) returns each world's club name/formation (already on `WorldClub`, no extra query) plus a `pointsTotal` (read from the `WorldRecord` finalize persists) and `trophies` (from `Achievement`) — a world whose run was never finalized just shows "In progress" rather than a result.

**Guest-persistence prompt**: new `GuestPersistPrompt.tsx`, shown inline in the stats hub for guest users — reuses the existing `SaveProgressModal` (and its `upgradeAccount` call) rather than duplicating the email/password form; it turns out `SaveProgressModal` already existed as an always-visible header button (`SiteHeader`'s "Save your progress"), so this phase's contribution is specifically the *peak-moment, results-screen* reinforcement the plan asked for, not a new upgrade flow.

**Tests**: `trophy-evaluation.test.ts` (8, including the mutually-exclusive Invincible/Unbeaten boundary), `trophies.test.ts` (2, catalog completeness), `HistoryPage.test.tsx` (5), extended `SeasonPage.test.tsx` (+3: finalize-run call + trophy render, guest prompt shown/hidden). `getHistory`/`finalizeRun` themselves follow the established convention of not being directly unit-tested (Prisma-coupled orchestration, same as `aggregateTeamStats`/`getCompetitionStats` before them) — their real logic (`evaluateTrophies`) is what's tested. Full monorepo `pnpm typecheck` and `pnpm test` green across all 10 packages (web 97 tests, api 40 tests). Not done: a live pass against a running API+worker+Redis stack — same constraint noted in Phases 3-4, though this dev environment did have a local Redis/API running for parts of this session (see below).



**Goal**: 38-0's account layer — runs saved forever, trophies, per-user history, and the peak-moment guest-persistence prompt (38-0 §6g, §7b trophies).
**Why here**: leaderboard (Phase 6) needs saved, attributable runs; trophies need a home.

**Work items**
- `api`/`db` — **Persist completed runs as durable records.** Wire `Achievement` (trophies like "The Invincible" 38-0-0, "Unbeaten", "Champions", "Golden Boot"), `WorldRecord` (biggest win, longest streak, points record), and `Award` (season awards from Phase 4). Define a trophy catalog (key → name/description/condition) and evaluate it at season completion in the worker or a post-completion hook.
- `web` — **"Your history" page** (`/history` or profile): list a user's past worlds/runs with result, formation, overall, trophies. New `pages/HistoryPage.tsx` + an API `GET /worlds?owner=me` summary.
- `web` — **End-of-season guest-persistence prompt** (38-0 §6g): a second, softer "Don't lose this season — sign in to keep it forever" panel on the results screen for guest users (distinct from the existing squad-confirm `GuestGateModal`). Reinforces at peak investment.
- `web` — **Trophy display**: a cabinet component; show unlocked trophies on results + history.
- `test`: trophy-evaluation unit tests (38-0-0 unlocks Invincible, etc.); history summary API test.

**New files**: `pages/HistoryPage.tsx`, `components/TrophyCabinet.tsx`, a `lib/trophies.ts` catalog (+ tests), API history summary.

**Acceptance criteria**: completing a run persists trophies/records/awards; a signed-in user sees prior runs at `/history`; guests get a compelling end-of-season save prompt.

**Top-5 notes**: trophy conditions are league-agnostic; "beat your club's record" style trophies belong to Phase 7 (One-Club), which has the historical benchmarks.

---

## 11. PHASE 6 — Leaderboard (global, filtered, verified, handle-gated) — ✅ COMPLETE (2026-07-22)

Implemented per the design below, with a few deliberate scope calls made along the way.

**Schema**: `LeaderboardEntry` (`packages/db/prisma/schema.prisma`, migration `20260722133038_add_leaderboard_entry`) follows the Award/WorldRecord/Achievement convention of plain `worldId`/`userId` string fields with no declared Prisma relation (not JanuaryEvent's relation style) — same "still-empty table, cheap to shape" reasoning. `worldId` is `@unique`: one entry per world, so resubmitting a run (revisiting the stats hub, or after a re-simulated season) **upserts in place** rather than accumulating duplicates — the same idempotency discipline Phase 5's `finalizeRun` established. `mode` defaults to `"solo"`, the only mode that exists before Phases 7-8 (One-Club/Daily) add others. `verified` defaults to `true` and is never conditionally set false anywhere in this codebase, since there is no client-side simulation path (see CLAUDE.md's engine contract) — every run's matches were produced by the sim-worker, so anti-tamper is structural, not a per-submission check. A `reportCount Int` column (not a separate model) backs the "⚐ Report a name" moderation entry point.

**Trust boundary** (`apps/api/src/leaderboard/leaderboard.service.ts`'s `submitRun`): only `handle`/`difficulty`/`ratingsMode` come from the client body — the backend has no other record of Setup/Draft config (`DraftContext` is client-only). Everything competitively meaningful (formation, standings W-D-L/GD/points, squad overall) is **re-derived server-side** by reusing `SeasonsService.getSummary` (already computes exactly this for the results screen), not trusted from the request, so the RESULT a leaderboard viewer sees can't be spoofed by a crafted call. **League filter derivation** (a genuine top-5-over-38-0 addition per the original plan): since every AI-filled opponent in a league-accurate season shares one real league (`fillAiClubsFromLeague`), `submitRun` recovers that league's name by looking up any other club's `refClubSeasonId` — falling back to the user's own club for the rarer squad-first-draft case, and to `null` ("Mixed" in the UI) for a fantasy-only/multiplayer world with no real-club AI-fill at all. Deliberately **dropped the "Club" filter axis** from 38-0's original spec — our fantasy XIs don't reliably map to one real club identity the way a squad-first draft of a single club-season does, so it would have been misleading more often than useful; League fills a similar role and is the one axis 38-0 doesn't have at all.

**Pure logic** (`leaderboard.logic.ts`, tested, same factoring convention as `lineup.ts`/`january.logic.ts`): `resolveTimeWindowCutoff` (today/week/all → a `createdAt` lower bound) and `formatLeaderboardResult` (the app's own "{wins}-0 ✨" namesake line for a true perfect record — won === played, which forces drawn/lost to 0 — vs. a generic sign-prefixed `W-D-L±GD` string otherwise; **the sign prefix on GD is unconditional, including "+0"**, not just positive values — without it a 0 goal difference glued onto the preceding digit with no separator, e.g. `"0-0-0"` + `"0"` → the ambiguous `"0-0-00"`, caught by a dedicated boundary test). `apps/web/src/lib/leaderboardResult.ts` hand-mirrors the same formatter client-side, per the zero-workspace-deps convention `lib/trophies.ts`/`JanuaryEventType` already established.

**Squad tier stays client-side-only** (no backend column): `lib/squadRatings.ts`'s `squadTierName` thresholds already exist; `LeaderboardPage` filters the fetched page by tier in a `useMemo` rather than round-tripping the same bucketing to the API as a query param.

**Endpoints**: submission (`POST /worlds/:worldId/seasons/:seasonId/leaderboard`) sits behind `JwtAuthGuard` like every other worlds-scoped route (ownership-checked via `WorldsService.getWorld`); listing (`GET /leaderboard`) and reporting (`POST /leaderboard/:entryId/report`) are **unguarded**, on a separate top-level `LeaderboardController`, matching the catalog module's "openly browsable" convention — a leaderboard that required sign-in to view would defeat the point.

**Frontend**: `LeaderboardFilters.tsx` renders every axis (time window, difficulty, ratings mode, league, squad tier, formation) as `Chip` toggle rows rather than `<select>` elements — this codebase has no `<select>` usage anywhere, everything is button-based (`SegmentedControl`/`Chip`), so a filter bar followed that existing idiom instead of introducing a new control type. `LeaderboardPage.tsx`'s Friends tab stubs to "needs a friend graph, which doesn't exist yet" **regardless of auth state** (not just for guests), since there genuinely is no friend graph in this codebase at all yet, unlike 38-0 where it's presumably account-linked. `LeaderboardSubmitBlock.tsx` (rendered on `SeasonPage`'s stats hub, next to `ShareCard`) needed the domestic season's id at that point in the render — `SeasonPage` previously only held it as a local variable inside `runSeasonPipeline`'s closure, so a new `domesticSeasonId` state field was added (and threaded through `CachedStatsHub`/`saveStatsHubCache`/`loadStatsHubCache`, optional for backward compat with pre-Phase-6 cache entries) alongside the existing `trophies`/`januaryOutcome` fields that solved the identical "the pipeline computed this, the render needs it" problem in earlier phases.

**Live-verified against the real stack** (not just mocked tests — API + sim-worker + real Neon Postgres + local Redis, all reachable in this session unlike Phases 3-5's environment): a scripted end-to-end pass (guest auth → world → squad-first draft of AFC Bournemouth 2016 → a real 380-fixture Premier League season → simulate → submit) confirmed (1) the submitted entry's standings/points/GD exactly matched the real `/standings` response, (2) **re-submitting reused the same row id** with updated fields (the upsert-by-`worldId` idempotency working against a real unique constraint, not just Prisma's type system), (3) `leagueName` correctly resolved to `"Premier League"` from the AI-filled clubs' `refClubSeason`, (4) the public `/leaderboard` list and a `difficulty=hard&ratingsMode=prime` filtered query both returned the entry correctly, (5) the report endpoint incremented `reportCount`. A live browser pass at `/leaderboard` against this same real data confirmed the League filter populated with all 5 real league names (fetched dynamically via `listLeagues`, not hardcoded), the row rendered the exact submitted data (handle, verified ✓, difficulty tag, club/formation/tier/ratings-mode/league caption, RESULT string, points), and clicking the "Easy" difficulty chip correctly filtered the Hard-difficulty entry out to the empty state.

**Tests**: `leaderboard.logic.test.ts` (7, including the GD-separator boundary), `leaderboardResult.test.ts` (4, the client-side mirror), `LeaderboardPage.test.tsx` (5: ranked row rendering, the perfect-record namesake line, empty-state, Friends-tab stub, fetch-error handling). Full monorepo `pnpm typecheck` and `pnpm test` green across all 10 packages (web 106 tests, api 47 tests). `submitRun`/`list`/`report` themselves follow the established convention of not being directly unit-tested (Prisma-coupled orchestration, same as `getHistory`/`finalizeRun` before them) — their real logic (`resolveTimeWindowCutoff`/`formatLeaderboardResult`) is what's tested, backed by the live end-to-end pass above for the orchestration itself.

**Not done**: no rate-limiting on submission or reporting (both endpoints are cheap to call repeatedly — acceptable for a v1 feature with no real user base yet, but worth flagging before this ships to actual traffic); the "⚐ Report a name" control only increments a counter with no moderation queue/threshold behavior on top of it, matching the plan's "moderation entry point exists" bar rather than a full moderation system.

**Goal**: parity with 38-0 §9.
**Why here**: needs saved/attributable runs (Phase 5); high virality payoff.

**Work items**
- `db`/`api` — **Leaderboard submission**: a `LeaderboardEntry` model (handle, userId?, worldId, mode, difficulty, formation, squadOverall, ratingsMode, result W-D-L+GD, points, verified, createdAt). Endpoint to submit a completed run under a chosen **handle** (lighter than full auth, per 38-0). Endpoint to query with filters.
- `api` — **Verified-run flag**: mark server-simulated runs as verified (anti-tamper signal). Since our simulation is already server-side (worker), most runs are inherently verifiable — set verified when the run's matches were produced by our worker for that world.
- `web` — **`/leaderboard` page**: Global / Friends tabs (Friends can stub to "sign in to add friends" until a friend graph exists), a filter panel (League/club, time window, formation, **squad tier** names from Phase 4, difficulty, ratings mode), and the row anatomy (rank, handle + ✓, difficulty tag, formation·overall·ratings caption, RESULT `38-0 ✨` or `W-D-L+GD`, PTS/114). "Report a name" moderation control.
- `web` — **"Add this run to the leaderboard"** submission block on the results screen (handle input + Submit).
- `test`: submission validation, filter query correctness, verified-flag logic.

**New files**: `pages/LeaderboardPage.tsx`, `components/LeaderboardFilters.tsx`, API `leaderboard` module, `LeaderboardEntry` model.

**Acceptance criteria**: a finished run submits under a handle and appears filtered correctly; verified badge shows for server-simulated runs; moderation entry point exists.

**Top-5 notes**: the club filter enumerates top-5 clubs; add a **League** filter axis (PL/LaLiga/Serie A/Bundesliga/Ligue 1/All-Top-5) that 38-0 doesn't need — a genuine top-5 addition. Points ceiling stays 114 (38 games).

---

## 12. PHASE 7 — One-Club XI mode — ✅ COMPLETE (2026-07-22)

Implemented per the design below, with one scope correction discovered mid-phase and one architectural finding that turned out to make the mechanic *better* than originally scoped.

**Scope correction — no real historical benchmarks exist to compare against.** The original plan item ("derive each club's real best-ever/worst-ever top-flight points total from `RefClubSeason` history") assumed real season-by-season standings data was available somewhere in the schema. It isn't — `RefClubSeason` carries only `clubId`/`seasonYear`/`leagueId`/`reputation`, no points/table data at all (confirmed by reading the model directly), and sourcing real historical tables for 173 clubs across 13 seasons would be its own ETL project, out of scope here (same "defer to a standing backlog item" call as Phase 0's dataset-depth note). **"Club Record Breaker"/"Club Worst Ever" are instead benchmarked against prior *simulated* runs** for the same real club within this game — the best/worst `LeaderboardEntry.points` ever submitted for that `refClubId` under `mode="one-club"` — which turns out to be a natural extension of Phase 6's leaderboard rather than a separate benchmark system, exactly as Phase 6's own completion note anticipated ("`mode="one-club"` + a club filter is the natural extension point, not a parallel system"). `packages/domain/src/trophies.ts`'s `TrophyKey` enum gained both keys with a comment explaining why they're evaluated differently (at leaderboard-submission time, not `finalizeRun`'s per-run evaluation) — the very first submission for a club earns neither trophy (nothing to compare against yet), and a tie with the existing best/worst earns neither either.

**Schema**: `LeaderboardEntry.refClubId String?` (migration `20260722140052_add_leaderboard_refclubid`) — a stronger, collision-proof identity than `clubName` (a fantasy XI's free-text name could coincidentally match a real club's name) for scoping the per-club leaderboard and the club-record comparisons. `World.settings` gained `oneClubClubId?: string`, set once at world-creation time by the frontend's `ClubsDirectoryPage` flow; `LeaderboardService.submitRun` derives `mode`/`refClubId` from this server-side — never from the submission body — continuing Phase 6's "everything competitively meaningful is re-derived, not trusted from the client" principle.

**The mixed-era mechanic falls out of existing architecture almost for free.** All interactive human drafting already goes through `draftFantasy` (individual `RefPlayerSeason` picks), never the whole-XI `draftClub` shortcut — confirmed by reading `DraftPage.tsx`'s `doConfirm()`. So scoping `DraftPage`'s pool-fetch effect to one `clubId` (via a new `clubId` filter on `clubSeasonFilterSchema`/`listClubSeasons`, instead of `leagueIds`) was the *entire* backend change needed for "each spin draws a different season of the same club, and the final XI can genuinely mix a 2015 player with a 2019 player" — no changes to `doSpin`, `loadPlayersFor`'s fetch shape, or `buildLineup` were required. Live-verified: a real drafted squad mixed 6 players from one season with 5 from another and simulated correctly.

**Formation-fillability check** (`lib/oneClubValidation.ts`'s `checkFormationFillable`, tested): a coverage heuristic, not full bipartite matching — for every formation slot, is there at least one position in the club's ever-recorded position set (new `GET /catalog/clubs/:clubId/positions`, flattened server-side since Postgres has no simple distinct-array-element query) that's eligible via the same `canPlayPosition` versatility graph the draft UI already enforces. Deliberately not a full one-player-per-slot matching (a real club's multi-season history is deep enough that the gap doesn't matter in practice); `DraftPage`'s existing auto-reroll deadlock guard remains the real backstop against a genuinely dead pick, same reasoning as Phase 1's "pre-filter the spin pool" scope-down.

**`SetupPage` adapts rather than forking**: when `config.lockedClubId` is set (by `ClubsDirectoryPage`'s card click), the League section is replaced with a One-Club banner (name + "pick a different club" + "draft a full league instead," which clears the lock inline) and the Player Ratings section is replaced with a forced-Season notice — both real conditional branches in the same component, not a separate one-club Setup page. The "Enter the Draft Room" CTA disables (with the missing-position list surfaced) while the fillability check is pending or fails.

**Live-verified end-to-end against the real API/worker/Neon DB** (Redis was reachable this session, unlike Phase 3-5's environment): a scripted run confirmed `/catalog/clubs` (173 real clubs), `/catalog/clubs/:id/positions`, `World.settings.oneClubClubId` round-tripping, a club-locked pool returning a club's full 8-season history, a genuinely mixed-era squad drafting and simulating successfully, `mode`/`refClubId` correctly derived server-side (not client-supplied), a first submission earning no club-record trophy, a second (higher-scoring) submission for the same club correctly earning `club-record-breaker`, the per-club leaderboard filter returning both runs ranked by points, and `mode=solo` correctly excluding both one-club entries. A live browser pass confirmed `/clubs`'s searchable directory (173 cards, initials fallback, "View leaderboard" deep link) and the leaderboard's Mode filter + club-context chip rendering the exact submitted data. **One check the environment blocked**: clicking a club card and following the `/clubs` → `/setup` client-side transition hung on the outgoing page — the same documented `document.hidden`/`AnimatePresence` backgrounded-tab quirk from the Phase 0-2 live pass, not an app bug. Compensated with a dedicated `SetupPage.oneClub.test.tsx` (4 tests, jsdom) covering the banner, hidden sections, and both fillability outcomes, per CLAUDE.md's own guidance to treat the jsdom suite as authoritative for transition-blocked checks.

**Tests**: `leaderboard.logic.test.ts` (+6: `evaluateClubRecordTrophies`), `oneClubValidation.test.ts` (5), `SetupPage.oneClub.test.tsx` (4). Full monorepo `pnpm typecheck` and `pnpm test` green across all 10 packages (web 115 tests, api 53 tests). `listClubs`/`getClubPositionCoverage`/`submitRun`'s trophy-persistence step follow the established convention of not being directly unit-tested (Prisma-coupled orchestration) — backed by the live end-to-end pass above.

**Not done**: rate-limiting on submission/reporting (flagged already in Phase 6, still true); a full one-player-per-slot fillability matching (the coverage heuristic above is the deliberate, documented trade-off); "Nations Trophy"-style nationality filtering, which is explicitly Phase 10's job, not this one.

**Goal**: parity with 38-0 §7b, scaled to top-5 clubs.
**Why here**: reuses the Phase-1 draft components and Phase-5 persistence; self-contained.

**Work items**
- `web` — **`/clubs` directory page**: all top-5 clubs (from catalog) as cards routing into a club-locked draft.
- `web`/`api` — **Club-locked draft**: the wheel/pool draws only players who appeared for that club (needs a catalog query "all `RefPlayerSeason`s whose `RefClubSeason.clubId` = X across all seasons"). **Force Season ratings** (Prime disabled — a career-best row could be at another club). Validate formation is fillable from the club's history.
- `api` — **Historical benchmarks**: derive each club's real best-ever / worst-ever top-flight points total from `RefClubSeason` history (or store during ETL) to power the record trophies.
- `web`/`api` — **Club-specific trophies** (Phase-5 trophy system): "The Invincible", "Club Record Breaker" (beat real best points), "Club Worst Ever". Wire into `Achievement`.
- `web`/`api` — **Per-club leaderboards**: reuse Phase-6 leaderboard filtered/partitioned by club (mode = one-club, club = X).
- `test`: club-locked pool correctness; Prime disabled; benchmark derivation; trophy conditions.

**New files**: `pages/ClubsDirectoryPage.tsx`, one-club draft config path, benchmark util.

**Acceptance criteria**: picking a club yields a draft restricted to that club's real history, Season-only; club trophies + per-club board work.

**Top-5 notes**: ~2× the club count of 38-0; benchmarks derived per real league's points system (identical 3-1-0). Bundesliga/Ligue 1 clubs have 34-game historical seasons in reality but our sim is always 38 — keep the *record comparison* on points, and note the game-count mismatch in copy (or normalize to points-per-game).

---

## 13. PHASE 8 — Daily Challenge mode — ✅ COMPLETE (2026-07-22)

Built largely as scoped, with a few corrected-scope decisions made during implementation. `DailyChallenge` generation is a pure function of the date (`apps/api/src/daily/daily.logic.ts`'s `generateChallenge`), lazily created on the first `/daily/today` request of a UTC calendar date and cached in the DB from then on (idempotent `upsert` on `date`, unique) — no cron job needed for "everyone sees the same puzzle." Themes: birthday (real `RefPlayer.dateOfBirth` month/day match, only offered when one exists for that date), nationality, and club-history, chosen deterministically among whichever are feasible that day; the anchor's own attributes derive both a primary ("2 other X") and secondary ("1 other Y") constraint, one from each dimension, rather than a variable-length constraint list — this consistently reproduces 38-0's observed 2-plus-1 compound-brief shape regardless of which theme wins. Constraints are checked against a player's *drafted club-season* (not full career history) since that's what's actually available without an extra career-spanning join — documented as a deliberate, honest simplification rather than 38-0's "past or present" framing.

Scoring (`computeScore`) diverges from 38-0's opaque "11/11" display in favor of a clean, testable formula: each constraint awards 10 pts/match up to its requirement (so exactly meeting every requirement scores `maxScore`), plus 2 pts/match beyond it with no cap — so overshooting a requirement pushes score *above* `maxScore`, which is the "bonus scoring" the plan called for, just via whole numbers instead of a mystery percentage. The attempt economy (5 attempts/day) is enforced server-side on `DailyChallengeEntry.attemptsUsed` (best score kept across attempts, `@@unique([dailyChallengeId, userId])`); the in-draft reroll budget is a small client-only constant (3), mirroring `DraftContext`'s reroll pattern but without needing a matching backend concept. Live "COMPLETION ODDS %" (`apps/web/src/lib/dailyOdds.ts`) is a binomial-complement estimate — P(at least *k* more matches in *n* open slots, given the constraint's eligible-pool fraction) — combined across constraints by treating them as independent; not a literal reimplementation of whatever 38-0 uses internally, but monotonic in all the right directions (more slots, bigger pool, fewer still-needed matches → higher odds), which is what the checklist actually needed.

`/daily` (`DailyChallengePage.tsx`) reuses `DrawReel`/`SlotReel`/`PitchView`/`PlayerPickCard` unmodified — the anchor is pre-placed into the first pitch slot its position is compatible with, locked from removal, and the rest of the draft follows the same spin→pick→assign flow as `DraftPage`'s squad-first mode (deliberately *not* wired through `DraftContext`, since a daily run never creates a `World`/season — it's scored standalone). `RequirementsTracker` is a new small component (checklist + odds bar) rather than reusing the squad-ratings panel, since the two show fundamentally different things (constraint progress vs. per-unit overall). The daily leaderboard is its own `DailyChallengeEntry` table rather than a `mode="daily"` row on the existing `LeaderboardEntry` — that model's `won`/`drawn`/`lost`/`points` shape is season-result-specific and doesn't fit a scored draft with no season behind it; the *pattern* (list/rank/report-style unguarded reads, auth-gated submit) carries over even though the table doesn't.

**Live-browser verification note**: the actual spin animation could not be click-verified in this session's automated Browser pane — `document.hidden` was `true` for the whole session (the documented tab-visibility gotcha in this doc's own "Live-browser-testing" section, which turned out to also freeze framer-motion's in-page `requestAnimationFrame`-driven reel animation, not just the route-level `AnimatePresence` case that gotcha was originally written for). Verified instead via: (1) direct HTTP calls to the real API against the real dataset — generation, idempotent caching, full submit/score pipeline with real Bayern Munich/Poland picks (scored 30/30 as expected), the 5-attempt cap (6th attempt correctly rejected), and duplicate-pick rejection, all against production data; and (2) a new jsdom-based component test (`DailyChallengePage.test.tsx`, rAF ticks normally in jsdom) that drives a real spin, a real pick, and confirms the requirements tracker's live count updates — the same category of coverage `DrawReel.test.tsx`/`SlotReel.test.tsx` already provide for the reused reel components. `pnpm typecheck` and `pnpm test` both green across all 10 packages (124 web tests, 65 api tests).

---

## 13a. PHASE 8 — Daily Challenge mode (original scope, for reference)

**Goal**: parity with 38-0 §7c — themed daily constraint puzzle with completion odds.
**Why here**: reuses Phase-1 draft components; standalone; high retention/virality.

**Work items**
- `api`/`db` — **Daily puzzle generation**: a deterministic-per-date puzzle (server clock, fixed refresh time). A `DailyChallenge` model (date, theme, anchorPlayerId, constraints[], fixedFormation). Themes: player-birthday (real DOB from `RefPlayer.dateOfBirth`, which we store!), nationality/tournament, club-history. Constraints as typed rules (N players from club X, N of nationality Y, etc.).
- `web` — **`/daily` page**: themed header + countdown, mandatory anchor player pre-seeded, requirements checklist (progress fractions + status dots), **live "COMPLETION ODDS %"** recomputed per pick, fixed formation, attempt economy (**5 attempts/day + a smaller reroll budget**), bonus scoring (exceeding minimums improves score), yesterday's top-score recap.
- `web` — **Completion-odds calculator**: given remaining open slots and unmet constraints, estimate P(all constraints satisfiable) from remaining eligible pool. Pure fn in `lib/dailyOdds.ts`.
- `api` — **Daily leaderboard**: today's scores (reuse Phase-6 infra, mode = daily).
- `test`: puzzle determinism per date; constraint tracking; odds monotonicity; attempt/reroll limits.

**New files**: `pages/DailyChallengePage.tsx`, `lib/dailyOdds.ts`, `components/RequirementsTracker.tsx`, API `daily` module + `DailyChallenge` model.

**Acceptance criteria**: everyone sees the same puzzle for a given date; constraints + live odds + attempt economy behave per 38-0; scored and rankable.

**Top-5 notes**: constraints draw on top-5 clubs/nationalities — a *richer* puzzle space than 38-0's single country (e.g. "3 players who played in Serie A", "2 Brazilians", cross-league themes). Real differentiator.

---

## 14. PHASE 9 — Multiplayer revamp

**Goal**: parity with 38-0 §7e — async **Leagues** first, then **Live Draft**.
**Why here**: biggest surface area, benefits from everything above; 38-0 shipped async before live (their timeline) — we copy that ordering.

**Phase 9a — ✅ COMPLETE (2026-07-22)**, built with two corrections from the original scope. First, the old pass-and-play Head-to-Head mode was fully replaced rather than kept alongside the new hub (confirmed with the user before starting — it's a real product removal, not an addition). Second, `WorldType.LEAGUE` was **not** reused (it stays vestigial/unused, same as before) — a league member's world is an ordinary `type: SINGLE` solo world, tagged via `World.settings.multiplayerLeagueId` (same "derive from settings, never trust the client" pattern `oneClubClubId` already established), and the completely-unused `LeagueMembership` model was repurposed from its original shared-world shape (`{worldId, userId, clubId, role}`) to `{leagueId, userId, worldId?, joinedAt}` pointing at a new `MultiplayerLeague` model (name/creatorId/inviteCode/rules Json/createdAt). This follows the research doc's own conclusion that 38-0's actual model is N *independent* solo seasons ranked by points, not shared fixtures — there was never really a "shared World" to reuse.

Standings deliberately do **not** duplicate season-result storage: `LeaguesService.getStandings` joins `LeagueMembership` to the existing `LeaderboardEntry` table by `worldId` — a league standing genuinely IS a public leaderboard entry (same `won`/`drawn`/`lost`/`points`/`formation`/`squadOverall` shape), just also visible to a private group of invited members. The only new behavior needed was making league members' runs **auto-submit** to the leaderboard (`SeasonPage.tsx`, right where `finalizeRun` already fires) instead of requiring the existing manual "Submit to leaderboard" click — a league's whole point is comparing everyone's result, so it can't depend on each member remembering an opt-in step; solo (non-league) runs are unaffected and still submit manually. This is the inverse of Phase 8's Daily Challenge lesson (documented in memory as "check first whether the shape actually fits before assuming reuse is/isn't appropriate") — here it genuinely did fit.

New surface: `apps/api/src/leagues/` (schemas/logic/service/two controllers — public invite-preview vs auth-gated create/join/mine/standings), `MultiplayerLeague` + reshaped `LeagueMembership` models + migration, `WorldsService.createWorld` auto-attaching a member's `LeagueMembership.worldId` (implicitly joining if the caller hadn't already — harmless, matches the guest-first low-friction philosophy), `DraftConfig` gaining `multiplayerLeagueId`/`multiplayerLeagueName`/`multiplayerFormationLocked` (mirrors `lockedClubId`'s One-Club XI lock pattern exactly — `SetupPage` hides League/Difficulty pickers and optionally Formation behind static "locked by league rules" banners), and three frontend pages: `MultiplayerPage` reworked into the Leagues hub (My Leagues + create-league form + join-by-code box), `LeagueJoinPage` (public rules preview from an invite link, join + hydrate + route to `/setup`), `LeagueDetailPage` (standings table + shareable invite link + contextual "Draft Your XI"/"Continue My Season" CTA for the viewer's own row).

`leagues.logic.ts`'s `rankStandings` never assigns a fake rank to a member with no result yet — it distinguishes "in-progress" (drafted, `worldId` set, no result submitted) from "not-started" (never drafted), both `rank: null`, so a standings table can't misleadingly imply a still-drafting member is tied for last. 7 new unit tests (invite-code formatting/ambiguous-character exclusion, standings ranking/tiebreak/status). Full end-to-end pipeline (create league → invite preview → join → draft → league-accurate AI-filled season → simulate → auto-submit → standings showing the completed member ranked #1 while another member still shows "not-started") verified against the real API+sim-worker+Neon Postgres+Redis stack via direct HTTP calls — the automated Browser pane's click-through UI verification remains blocked by the `document.hidden`/rAF-freeze environment limitation documented in Phase 8's notes, so this phase leaned on the same API-level verification strategy plus `pnpm typecheck`/`pnpm test` green across all 10 packages (72 api tests, 124 web tests).

Phase 9b (Live Draft) has not been started — still scoped as its own separate, larger sub-project per the original plan (WebSocket transport, draft-turn state machine, claim-locking), not attempted alongside 9a.

**Work items (9a — async Leagues, ship first)**
- `web`/`api` — Rework our current fixed 2-club head-to-head (`MultiplayerPage`) into **N-player async leagues**: creator sets shared rules once (era/league/difficulty/formation-freedom), generates an **invite link**, each participant independently drafts + simulates **their own season**, ranked by points. This matches 38-0's model and is simpler than shared fixtures.
- `db`/`api` — Reuse `World` (`WorldType.LEAGUE`), `LeagueMembership`, and per-member `Season`s; a league standings view aggregates each member's points.
- `web` — Create-league flow, join-by-link flow, league standings page.
- `test`: rule-locking across members; independent seasons; standings aggregation.

**Work items (9b — Live Draft, second)** — ✅ COMPLETE (2026-07-22)

Three product-shape decisions were confirmed with the user before starting, since each fundamentally changes the architecture: **turn-based snake order** (not free-for-all racing — no claim-lock race conditions, one active picker at a time), **invite-link + host-starts lobby** (not an auto-start countdown), and **timer + auto-pick** on turn timeout (not skip-turn). All three shipped as scoped.

The key architectural decision, beyond those three: a Live Draft Room is **backed by a `MultiplayerLeague`**, created alongside it with `formationFreedom: false` (one shared formation is what makes the snake-order turn math well-defined for everyone). The room (`LiveDraftRoom`/`LiveDraftParticipant`/`LiveDraftPick`, new models) only orchestrates the synchronized *picking* phase — no slot/position tracking during live picks at all, unlike the old removed shared-World multiplayer model. The moment picking finishes, `live-draft.gateway.ts`'s `finalizeRoom` submits every participant's flat pick list through the **exact same `DraftService.draftFantasy`** path a solo or async-league draft already uses (its existing `buildLineup` greedy algorithm does slot-fitting, not the live-draft code), tagged with the backing league's id — so simulation and standings are 100% reused Phase 9a infrastructure from that point on. This made Phase 9b's actual new surface area much smaller than "the largest single lift in the plan" implied: a NestJS WebSocket gateway (`@nestjs/websockets` + `socket.io`, connection-time JWT auth off the handshake since there's no Passport/Guard pipeline for a socket), a small pure turn-engine (`live-draft.logic.ts`: snake-order `seatForPick`, `pickAutoSelection` for the timeout fallback — 9 unit tests), and a REST layer mirroring `leagues.controller.ts`'s public/guarded split almost exactly.

Deliberately **not** implemented, as documented scope cuts consistent with the "reasonable v1" bar the rest of this plan already sets: no position-legality validation during live picks (mirrors the existing solo draft's own trust boundary — a participant who drafts an unfillable position spread finds out at `finalizeRoom`, reported as an error for *them specifically*, not a whole-room failure); no reconnect/presence UI (a disconnected participant's turn just times out and auto-picks, same as going idle); the spin doesn't reuse `DrawReel`/`SlotReel`'s slot-machine animation (those assume the client already knows the winner and animates toward it locally — doesn't fit a server-decided, live-broadcast spin — so live draft uses a plain, immediate reveal instead); and a page reload mid-draft shows already-drafted-but-never-personally-witnessed picks (e.g. auto-picked while this client wasn't watching) as a generic "Drafted player" placeholder rather than fetching full details, since player display info is only ever populated client-side from `draft:spinResult` broadcasts, not a dedicated lookup endpoint.

**Two real bugs hit and fixed during live-browser verification** (both live in the codebase now, not just caught-and-reverted): (1) `LiveDraftService.listMine`'s Prisma query included `league` but not `participants` in its nested `include`, while the frontend's `LiveDraftRoomDto` type (and every OTHER endpoint returning that type) assumes `.participants` is always present — crashed `MultiplayerPage` with `Cannot read properties of undefined` the moment a real room existed to list. (2) Joining a room happens over plain REST (`POST /live-draft/invite/:code/join`), which has no socket of its own to broadcast from — participants already sitting in the lobby never saw a new arrival until they manually refreshed. Fixed by making `LiveDraftGateway.broadcastState` public and having `LiveDraftController`'s join handler call it directly after a successful join. Both were caught only by actually clicking through the real UI against the real backend, not by typecheck or the unit tests, which is exactly the class of bug live verification exists to catch.

**Verification**: `pnpm typecheck`/`pnpm test` green across all 10 packages (124 web tests, 81 api tests). Full engine correctness proven via a Node script driving two real WebSocket clients through an entire room lifecycle (create → join → start → alternating spin/pick through all 22 picks with correct snake-order turn alternation, including the round-boundary double-pick — matches the unit-tested logic exactly → automatic completion → both participants' `World`s created successfully via real `draftFantasy` calls, no errors). Separately, the actual browser UI was click-verified end-to-end against the real stack (unlike Phase 8's/9a's animation-blocked passes) — the Live Draft page has no `requestAnimationFrame`-driven spin animation to get stuck on, so lobby → live roster updates via a second real join (proving the WebSocket push genuinely worked, not just REST) → start → spin → pick → turn advancement → squad/draft-order/recent-picks feed, all confirmed rendering correctly in a real, running browser tab.

**Acceptance criteria (9a)**: a link-shared league where each player drafts independently and the best points total tops the table.
**Acceptance criteria (9b)**: up to 4 players draft live in turn order from a shared, narrowing pool, with a working timeout/auto-pick fallback, and land on the exact same simulate-your-own-season flow 9a already built.

**Top-5 notes**: rule-locking includes the chosen league / All-Top-5 scope so every member drafts from the same pool.

---

## 15. PHASE 10 — Nations Trophy, content pages, and platform polish

**Goal**: remaining 38-0 surfaces + the marketing/SEO pages + PWA/app considerations.

**Work items**
- `web`/`api` — **Nations Trophy** (38-0 §7d): a limited-time tournament building a **nation's XI** (draft filtered to one nationality across top-5 clubs — `RefPlayer.nationality` already stored). Sign-in-gated, exclusive trophy via `Achievement`. Reuses the draft + season pipeline with a nationality-locked pool.
- `web` — **Content/SEO pages** (all net-new, copy adapted to top-5): `/how-it-works`, `/how-to-play`, `/best-xi` (Greatest top-5 XI, our editorial shortlist), `/story`, plus FAQ on the landing page. Match 38-0's structure (38-0 §5 static pages in research).
- `web` — **Landing page mode cards**: surface all modes (Classic, Multiplayer, One-Club, Daily, Nations) like 38-0's landing.
- `web`/stretch — **"True multi-league European Nights"**: the top-5 upgrade over 38-0 — pool qualifiers across all five leagues into one real continental competition. Explicit stretch beyond parity.
- Platform: PWA/installability, share-image rendering quality, meta/OG tags per mode.

**Acceptance criteria**: all 38-0 modes have an analogue; content pages live and top-5-worded; landing surfaces every mode.

**Top-5 notes**: Nations Trophy is *stronger* on top-5 (a nation's players are spread across five leagues, not one) — lean into it.

---

## 16. Feature parity matrix (38-0 → Futbol phase)

| 38-0 feature | Research § | Phase |
|---|---|---|
| 12 formations | §3 | 0 |
| Wire Europe/January toggles | §3 | 0 |
| Live per-unit OVERALL during draft | §4.4 | 1 |
| Reroll pips + progress bar | §4.1 | 1 |
| Player-pool sort | §4.6 | 1 |
| Move-a-player reposition | §4.3 | 1 |
| Tap/Space to spin | §4.5 | 1 |
| Pre-filtered "no dead spin" | §2 | 1 |
| Top-6/Top-10 odds bands | §4 | 1 |
| Continuous season feed + skip | §5a | 2 |
| **January Transfer Window** | §5b | 3 |
| Two-half sim split (enables January) | §5b | 3 |
| Auto-generated season narrative | §6b | 4 |
| Playmaker + Golden Glove awards | §6e | 4 |
| Manager stat card | §6f | 4 |
| Season totals / full log / squad tiers | §6a,d, §9 | 4 |
| Two-way share (season + January) | §6g | 4 |
| Trophies / records / history | §7b, §6g | 5 |
| End-of-season guest prompt | §6g | 5 |
| Leaderboard (global, filtered, verified) | §9 | 6 |
| One-Club XI + club trophies + per-club boards | §7b | 7 |
| Daily Challenge + completion odds | §7c | 8 |
| Async Leagues multiplayer | §7e | 9a |
| Live Draft multiplayer | §7e | 9b |
| Nations Trophy | §7d | 10 |
| Content/SEO pages | static pages | 10 |
| True multi-league Europe (top-5 upgrade) | §4 top-5 note | 10 (stretch) |

---

## 17. Sequencing summary & effort shape

- **Phases 0–5 = "make the solo game exactly like 38-0, on top-5."** This is the core ask and the bulk of the value. Phase 3 (January) and Phase 4 (narrative) are the two headline new experiences; Phase 3 carries the only real engine-pipeline change (two-half simulation).
- **Phases 6–8** are each self-contained, mostly reusing Phase-1 draft components + Phase-5 persistence — parallelizable once the core is done.
- **Phase 9b (Live Draft)** is the single biggest lift (realtime infra) — isolate it.
- **Phase 10** is breadth/polish + the one place we can *exceed* 38-0 (true multi-league Europe, richer Nations/Daily on five leagues).

**Biggest risks to flag now**
1. **Two-half simulation split** (Phase 3) touches the worker's batch pipeline — the one place CLAUDE.md warns about performance regressions. Budget for re-measuring the 380-fixture season timing.
2. **Dataset depth** (Phase 0): our top-5 data is 2012-2024; 38-0's "feel" comes from 34 seasons. If "All-time" feels thin, the ETL era extension is a prerequisite for the mode to land as well as 38-0's.
3. **Narrative quality** (Phase 4): the template bank is what makes or breaks the "so much better" feeling — invest in breadth of phrasing, keyed carefully to signals.

---

## 18. Live verification pass (2026-07-22) — Phases 0–2 confirmed working against the real stack

After Phases 0–2 landed (all unit/integration tests green, full monorepo typecheck clean), a full live pass was run against the real running stack — API (NestJS) + sim-worker (BullMQ) + the actual remote Neon Postgres + local Redis — not just mocked tests. Two methods were used:

**Method A — direct HTTP calls against the real API** (the more decisive check, since it exercises real DB writes/reads and a real BullMQ job, none of which the mocked unit tests touch):
1. `POST /auth/guest` → real JWT.
2. `POST /worlds` with `settings: { europeanNights: false, januaryWindow: true }` → **the response round-tripped those exact values from a real Postgres write** (`{"settings":{"januaryWindow":true,"europeanNights":false}}`), and a follow-up `GET /worlds/:id` confirmed the read path too. This is the decisive proof that Phase 0's `World.settings` migration + wiring works end-to-end, not just in a mocked test.
3. `POST /worlds/:id/draft/fantasy` with `"formation": "4-1-2-1-2"` and 11 real Manchester City 2023/24 player-season ids (Rodri, Foden, Haaland, Gvardiol, Álvarez, Akanji, Bernardo Silva, Aké, Ederson, Dias, De Bruyne) → **the real backend's `buildLineup()` correctly filled all 11 slots** in exactly the position order coded in Phase 0 (GK/LB/CB/CB/RB/CDM/CM/CM/CAM/ST/ST) — proof the new formation is recognized end-to-end through the real domain-schema validation, not just in `lineup.test.ts`.
4. `POST /worlds/:id/seasons` (leagueId=Premier League) → AI-filled a real 20-club, 380-fixture season.
5. `POST .../simulate` → real BullMQ job, watched complete via the sim-worker's own log ("Season sim job N ... completed") and by polling `GET .../seasons/:id` until `COMPLETED` — took well under a minute for 380 fixtures, consistent with CLAUDE.md's documented ~60-90s figure.
6. `GET .../matches` → real match/goal data, e.g. `{"scorerName":"Tyrick Mitchell","assistName":"Ismaïla Sarr", ...}` — confirmed 353/380 fixtures had at least one goal (a realistic distribution), and our own club's 38 fixtures produced a sane record (13W-10D-15L, 49pts) that matched `GET .../standings` exactly.
7. `GET .../europe/status` → correctly reported `qualified:false` (13th place, need top 8) — confirming the backend computes real qualification status unconditionally, and Phase 0's `europeanNights` gate is (by design) a frontend-only decision not to call/show it, not a backend behavior change.

**Method B — the actual React frontend in a live browser**, using the results from Method A (set `futbol_token`/`futbol_user`/`futbol_world_id` into `localStorage` to attach the browser tab to that same real world, sidestepping a UI limitation described below):
- Loading `/season` and clicking "Simulate Season" (which created and simulated a **second** season for the same world/competition) drove the **real, unmocked Phase 2 `MatchPopupReel` rewrite** through its full reveal — confirmed newest-first accumulation (`GW32` at the top counting down to `GW1`), the exact card format (W/D/L badge, `GW<n> Opponent (H/A)`, own-goals-only scorer line, score), and a correct live stat strip (`9 WON / 10 DRAWN / 13 LOST / 37 PTS`, `GF 32 · GA 46 · GD -14` at the 32/38 mark) — with real scorers (Kevin De Bruyne, Bernardo Silva, Rúben Dias, Julián Álvarez, Nathan Aké, Erling Haaland) and real AI-filled opponents (Nottingham Forest, West Ham, Liverpool, Everton, ...).
- The pipeline then ran unattended all the way to the **stats hub** — final standings table, season-totals strip, top-scorer/top-assist awards, per-player G/A table, and the full `MatchLog` (also refactored in Phase 2 to share `summarizeForClub`) — all rendering correctly with zero console errors the entire time.

**A real environment limitation was found and worked around, not an app bug**: this Browser pane's tab reports `document.hidden = true` / `visibilityState: "hidden"` to the page — i.e. the browser engine treats it as a backgrounded tab for automation purposes. Real browsers throttle `requestAnimationFrame` and slow down `setTimeout`/`setInterval` in backgrounded tabs (a standard power-saving behavior). Two concrete symptoms traced to this:
1. `App.tsx`'s route-transition wrapper (`<AnimatePresence mode="wait">` keyed on `location.pathname`, wrapping `<Routes>`) never completes its exit animation in this environment, so a client-side `navigate()` between top-level pages (e.g. Setup → Draft) updates the URL (history API, unaffected) but the new page's DOM never mounts — it sits frozen on the outgoing page indefinitely. **This blocked clicking through Setup → Draft → Season directly in the browser** and is why Method A (direct API calls) was used for the deep pipeline checks, with Method B entered directly at `/season` via a hard load + localStorage to bypass the stuck cross-page transition (in-page phase changes within `SeasonPage` are plain conditional renders, not gated by this wrapper, so they animated/updated fine once reached).
2. The BullMQ-completion poll and the reveal's per-card hold timers both run noticeably slower in real wall-clock time than their configured intervals while the tab is "hidden," due to the same background-tab timer throttling — expect real waits, not the configured `intervalMs`, when live-testing this app's animated flows in an automated/headless browser context.

**Takeaway for future sessions**: this is a testing-environment quirk, not a product bug — a real user's focused, visible tab is never "hidden" and would see normal-speed transitions. If a future session needs to live-browser-test a route transition specifically (not just in-page state), expect this same freeze and either (a) test via direct hard-loads per page + localStorage token/world-id injection (as done here), or (b) accept the automated test suite's coverage (which uses jsdom, where `requestAnimationFrame` is never throttled) as the reliable source of truth for transition-animation correctness, and use live-browser passes only for in-page behavior and real-backend integration.

Also cleaned up after this pass: the two dev-server background processes started for testing (API on port 4000, sim-worker) were stopped; the guest test user/world/seasons created during this pass were left in the dev database (harmless test data, not worth a destructive cleanup step).

---

## 19. Immediate next step

Phases 0-9 are complete, automated-test-verified, and (for Phases 6-9) live/API-verified against the real API/worker/DB stack. Phases 0-5 closed out the "make the solo game exactly like 38-0" core loop (§17's framing); Phase 6 shipped the Leaderboard; Phase 7 shipped One-Club XI, reusing the Leaderboard's `mode`/`refClubId` infrastructure for per-club boards and comparative trophies rather than building a parallel system; Phase 8 shipped the Daily Challenge puzzle mode (its own `DailyChallengeEntry` table rather than folding into `LeaderboardEntry` — see §13); Phase 9a shipped async multiplayer Leagues, genuinely reusing `LeaderboardEntry` for standings this time (joined by worldId, auto-submitted for league worlds); Phase 9b shipped real-time turn-based Live Draft (WebSocket gateway, snake-order turns, timer/auto-pick), deliberately backed by a `MultiplayerLeague` so it hands off to 9a's own simulate/standings pipeline the moment picking finishes rather than building a parallel one — see §14's completion notes for both. The full multiplayer surface from the plan (§7e) is now built. Start **Phase 10 — Nations Trophy, content pages, and platform polish** next. Read §15 in full before starting.
