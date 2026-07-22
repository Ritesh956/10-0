# 38-0.app — Competitor Research Reference

Full playthrough + site audit of [38-0.app](https://38-0.app), a viral fan-made "draft an all-time XI, simulate a 38-game season, chase a perfect unbeaten record" game — the closest direct competitor/inspiration to Futbol. Conducted 2026-07-22: drafted a full XI, appointed a manager, simulated a season (including triggering their January Transfer Window event), read every static/marketing page, and surveyed every game mode reachable without creating an account. Raw session notes (chronological, screen-by-screen) live in [38-0-research-notes.md](38-0-research-notes.md) — this doc is the same material reorganized by topic for reference when building Futbol.

**Scope limit**: Nations Trophy mode and Live Draft multiplayer are gated behind Apple/Google account sign-in. Per this session's operating rules, creating accounts on third-party sites is out of scope, so those two are documented only from their public landing-page copy, not played through.

---

## 1. What it is, at a glance

- **Positioning**: "Unofficial fan draft game," English-top-flight-only (Premier League + relegated-club history back to 1992-93), explicitly *not* fantasy football (no live gameweeks/current squads) — a nostalgia/dream-team/argument-settling game.
- **Scale** (self-reported, as of 2026-07-18): 49 English top-flight clubs, 4,000+ player seasons, seasons 1992-93 through 2025-26, 5.4M+ unique visitors, 46M+ impressions on X, 10.9M+ seasons simulated, live on iOS (charting #4 UK Trivia / #7 UK Sport).
- **Legal posture**: fan-made, unaffiliated with any league/club/publisher/ratings provider; ratings are "our own interpretation" of public data; no official logos/crests/photos used (unlike our own app, which does hotlink real Transfermarkt photos — a deliberate difference worth being aware of, not necessarily a problem, just a different risk posture).
- **Monetization**: none visible in the flow — no ads, no paywall gates on core play. Only a "☕ Buy me a coffee" donation link at end-of-season. Sign-in is used purely for cross-device history/leaderboards, not paid features.
- **Origin story**: built by a small fan group in a single weekend (4 Jun 2026 launch), went viral within days, has been in continuous weekly feature-ship mode since (see §7 timeline).

---

## 2. Core game loop (the "Classic" mode) — rules as stated by the site

1. **Spin the wheel** → lands on one real club + one specific season (e.g. "Arsenal 2007/08"). The wheel is **pre-filtered so it can never land on a club-season with zero eligible players for your still-open slots** — "you never get a dead spin" (stronger guarantee than our own after-the-fact reroll-on-deadlock approach).
2. **Draft a player** from that squad into your XI. Each player is a real person, in that exact season, with a rating reflecting that season's performance. **A real player, once drafted, can never be drafted again even from a different club/season row** — hard dedup rule stated explicitly in their rules copy.
3. **Repeat** until all 11 formation slots are filled — one pick per spin, always (never draft two players off one spin).
4. **Simulate the season**: full 38-fixture campaign resolved instantly; standard scoring, 3pts win / 1pt draw, so a perfect 38-0-0 = **114 points** (max possible).
5. **Chase 38-0**: the entire game's identity is built around this single stretch goal; almost nobody achieves it, which is the point (per their own copy).

**What drives the simulation** (per their /how-it-works page): squad **strength** and, "just as much," squad **balance** across keeper/defence/midfield/attack — i.e. a lopsided attack-heavy XI underperforms its raw overall, same design philosophy as our own `computeUnitRatings()` + `POSITION_UNIT_WEIGHTS`. They also state the same result can differ run-to-run for an identical XI ("the season can play out differently") — i.e. every "Simulate Season" click uses a fresh random outcome from the player's perspective, same practical effect as our own per-match random seed even though our engine is technically deterministic-given-a-seed.

---

## 3. Setup screen — draft configuration (before any spinning starts)

All settings are chosen up front, in one scrollable form, before "Start Draft" locks them in for the run:

| Setting | Options | Notes |
|---|---|---|
| **Formation** | 12 total: 4-3-3 (default), 4-4-2, 4-2-3-1, 4-5-1, 3-4-3, 3-5-2, 5-4-1, 4-1-2-1-2, 4-4-1-1, 5-3-2, 3-4-1-2, 4-2-2-2 | Each shows a 1-line flavor caption on select (e.g. 4-3-3: "Attacking with width. Three forwards create constant threat."). More formations than we currently support — worth checking `apps/web/src/lib/formations.ts` coverage against this list. |
| **Difficulty** | Easy (3 rerolls) / Normal (1 reroll) / Hard (0 rerolls **and** ratings hidden) | Difficulty is a single coupled axis controlling *two* mechanics at once (reroll budget + rating visibility). We treat these as logically separate; they don't. |
| **Show Ratings** | On (overalls visible) / Off ("Blind mode: trust your gut") | Independent toggle, but Hard difficulty forces it off. |
| **Draft Mode** | **Squad First** ("spin a club, pick any player, choose their position" — our current flow) / **Position First** ("pick a slot, then spin for a club to fill it" — inverse order, we don't have this) |
| **Player Ratings** | **Season** (rated as that exact season) / **Prime** (career-best rating) | Identical concept and naming to our own `ratingsMode: "season" \| "prime"`. |
| **Era** | Quick buttons: All-time / 2000s+ / 2010s+ / Modern (2016+), **plus a dual-handle year-range slider** (1992/93–2025/26, live "N of 34 seasons" label) | More granular than our fixed era/league picker — no year-range slider on our SetupPage today. |
| **Advanced toggles** | Managers (Gaffers) / European Nights / **January Transfer Window** | First two match our existing manager-roll and Europe features almost exactly. January Transfer Window is a mechanic we have nothing like — see §5. |

A live formation preview (mini pitch graphic with dots) renders under the formation grid as soon as one is selected.

---

## 4. The draft screen — UI anatomy (deep detail, since this is our most directly comparable screen)

Top to bottom, once "Start Draft" is clicked:

1. **Header bar**: formation name + "Locked · restart to change", a **reroll indicator** (amber dot *pips*, one per remaining reroll — not a number) sitting next to a separate **draft-progress fraction** ("N/11", emerald) with a thin animated progress bar underneath, and a "↺ Restart" button. These are two genuinely distinct counters rendered side by side — worth the pip/dot treatment for reroll count instead of our current plain-text count.
2. **Pitch view**: full graphical formation, 11 dashed circles positioned per formation, each labeled with position code + sub-label (e.g. "CM"/"Central") until filled, then switching to the drafted player's **surname only**. Legend: 🟠 Keeper / 🔵 Defence / 🟢 Midfield / 🔴 Attack / ⚪ Can't play there (same 4-group + "ineligible" split as ours, different specific colors — amber/blue/green/red vs our amber/teal/mint/crimson).
3. **"⇄ Move a player"** button (appears once ≥1 player is drafted): "Reposition a drafted player to open up a slot." — lets you relocate an already-placed player to a different eligible slot mid-draft. **We have no equivalent** — worth considering for cases where a late spin only fits an already-occupied slot held by a versatile player.
4. **Live OVERALL panel**: headline overall number + a per-unit breakdown (⚡ Attack / 🌀 Midfield / 🛡️ Defence / 🥅 GK), each either a number or "–" if that unit has no player yet, updating after **every single pick**. **We have nothing like this during drafting** — our `computePreseasonOdds` only fires once the squad is complete. This is a strong, cheap idea to borrow: a continuously-updating squad-quality readout, unit by unit, live during the draft.
5. **Spin panel**: "N positions left to fill" + a CLUB × SEASON dual-reel display + "🎰 Spin the Wheel" button + "or tap anywhere, or press Space" (the whole page is clickable, plus a keyboard shortcut — we only support the explicit button click).
6. **Player pool** (post-spin): "SQUAD SPUN" badge + a **run-level ratings-mode badge** ("PRIME" or presumably "SEASON", shown redundantly on every single spin regardless of squad quality — confirmed by observing it on both a Man City title-winning squad and a relegated Sheffield United squad) + "N slots left" + club/season + a **spin-scoped "Re-roll (N left)"** button (draws from the same shared run-wide reroll budget) + a **SORT control**: Rating (default) / Position / Surname A–Z tabs. **We don't offer any pool sorting today.**
7. **Player rows**: overall badge + name + nationality + up to 3 position-eligibility chips. Clicking a row expands an **inline "PLACE IN (N)"** panel directly beneath that row (not a modal) listing only the currently-open slots that player is eligible for, as tappable pills — one tap assigns and returns to the spin-again state.

**Confirmed draft rules from playing**: exactly one pick per spin, always. Normal difficulty's "1 reroll" is a **single shared budget for the entire 11-pick draft**, not one-per-spin. A dot/pip indicator plus a contextual "Re-roll (N left)" button both draw from that same pool.

### Draft-complete screen ("Your XI")
Pitch switches from dashed placeholders to solid colored tokens (initials avatar + overall badge + surname), plus a flat scannable list below: position / full name / 3-letter club code / season / overall — a visual+list pairing worth matching in our own post-draft summary.

### Manager step
"OPTIONAL — Add a manager?" — "A manager changes the style of your season, not your odds of going 38-0." Choices: "🎲 Spin for a gaffer" / "No manager (classic)". Spinning returns a real manager name + a one-line tactical-style blurb (e.g. George Graham: "Hard to beat. Fewer goals at both ends and a clean-sheet habit."). **This independently validates our own manager-roll design** (real name + short philosophy blurb, decline = default tactics) — near-identical pattern, arrived at separately.

### Pre-season odds screen ("🏆 Squad Complete")
"Here's what the pundits make of your XI. Simulate the season and chase the impossible." Then a **PRE-SEASON ODDS** panel, directly comparable to our `computePreseasonOdds`/`DraftPage.odds.test.ts`:
- PROJECTED FINISH (e.g. "3rd") + EXPECTED POINTS (e.g. "77") as two headline numbers
- 5 stacked labeled probability bars, each its own color: **Win the league** (gold), **Top 4** (emerald), **Top 6** (blue), **Top 10** (purple), **Relegation** (red)
- Footer: "What your Overall N rating should produce. Simulate to see if you beat it."

Confirms our general shape (one continuous projected-finish distribution feeding multiple bars) is right; differences worth considering: they add Top 6 and Top 10 bands (we only do Top 4/Relegation/Win), and use 5 distinct bar colors rather than one accent color throughout.

---

## 5. Season simulation — the two mechanics we have nothing like

### 5a. Progressive matchweek reveal
Clicking "Simulate Season →" does **not** show one big loading screen — it immediately starts an animated, continuous, **newest-first** scrolling feed of result cards (opened already several matchweeks in within a couple seconds of clicking). Each card: GW badge, W/D/L pill, opponent + H/A, score, scorer+minute line (`⚽ Petrov 54′ Petrov 68′`, one line per goal, not "x2" aggregation). A running stat strip underneath (WON/DRAWN/LOST/PTS + GF·GA·GD). A persistent **"Skip to January →" / later "Skip all →"** link lets you fast-forward past the reveal at any point. Conceptually close to our own `MatchPopupReel`, but implemented as one continuous feed rather than one popup per match.

### 5b. THE JANUARY TRANSFER WINDOW — a full mid-season narrative + gamble event (our biggest single gap)
Triggers automatically and unconditionally at **exactly matchweek 19/38** (halfway), pausing the reveal:

1. **Recap panel**: "JANUARY TRANSFER WINDOW / Halfway there", stat tiles (W-D-L, Points, GD), and a dynamically-templated sentence: *"19 games played, N scored and N conceded. On this pace you are on course for [Nth]. Stick with your XI, or gamble on one move. There is no undo."*
2. **Choice**: "Enter the transfer market" (gamble) vs "Stick with your XI" (decline, resume unchanged).
3. Gambling draws a random **event card**, visually flagged as risky (amber-orange border, contrasts with the app's default emerald "safe" color everywhere else). Observed variant: **"DEADLINE DAY — Bargain Buy"** — *"A scout swears he has found a gem. One blind signing for your weakest spot, no questions asked."*
4. Confirming **re-uses the exact same spin-the-wheel widget** (CLUB × SEASON reel) from the main draft to determine the transfer's source squad — good mechanic reuse, no new UI invented.
5. Resolves to a **"DONE DEAL"** card: `DONE DEAL · <POSITION>`, OUT (old player + rating, ↓) → IN (new player + source club/season + rating), one-line verdict ("Up 3 rating points in that position."). The **position is auto-detected as your current weakest-rated slot** — you don't choose it, only the resulting player (via club/season) is randomized. Setup copy ("can help or hurt, no undo") implies downgrade outcomes and possibly other event *types* exist beyond "Bargain Buy" — unconfirmed, only saw one instance.
6. "Continue the season" resumes the reveal from where it paused.

**Why this matters for us**: `SeasonPage.tsx`'s `runSeasonPipeline` currently goes straight from domestic-season completion to the stats hub with zero engineered mid-season narrative beat. A single opt-in mid-season event (matchweek ~19 of 38, or the analogous point in our season length) — reusing our own `DrawReel`/`SlotReel` for resolution, gated behind a Setup toggle exactly like their "January Transfer Window" switch — is a scoped, buildable Phase idea.

---

## 6. End-of-season results screen — the richest screen in their whole app

Reached via "Skip all →". This is where the gap with our own `CompetitionStatsPanel`/stats-hub is largest. Sections, top to bottom:

### 6a. Full match log
All 38 fixtures, newest-first, same card format as the live reveal. (Not directly comparable to our multi-club filtering problem — their "league" is scaled to exactly one human campaign — but confirms a full-log-on-one-screen view is worth having available even in our bigger-league context, e.g. behind an expander.)

### 6b. Auto-generated season narrative — **the single standout feature we have nothing like**
A block of procedurally-assembled prose, not just stat tiles:
- **Verdict tag**: colored short phrase comparing actual vs projected finish (ours: "FLATTERED TO DECEIVE", red, since we finished worse than projected) — implies a small table of verdict phrases keyed by finish-vs-projection delta.
- **Unit-quality word-tiers**: e.g. "ATTACK Strong / MIDFIELD Excellent / DEFENCE Very good / GOALKEEPER Strong" — same underlying per-unit overalls as during drafting, mapped to qualitative bands instead of raw numbers here.
- **Composition sentence**: dynamically names your strongest unit ("Built around the midfield...") and comments on the weakest.
- **Finish-position flavor headline + paragraph**, keyed to final position bracket (ours: "EUROPE, THE TINPOT END" for 5th place), with templated slots for points total and your actual biggest-win fixture+scoreline inserted into the prose.
- **January-event outcome recap** (only if gambled): one line for the player who arrived, one for the player who left, each independently verdicted.
- **Standout-player callout**: a bold summary line + a separate italic, amber, 🎙️-icon "pundit quote" styled aside about the top performer.
- **Manager-specific closing line**, explicitly echoing the manager's own draft-time style blurb (proving the manager's flavor text and the season recap draw from shared trait data).

**This is the highest-leverage idea in the whole competitor audit.** Even a lightweight, non-LLM version — banked templates keyed by finish-bracket / stat-delta / standout-unit / top-performer, same as they appear to be doing — would meaningfully close the gap between our numeric stats hub and a screen that actually reads like a football recap.

### 6c. Player stats table ("YOUR XI")
Stats/XI view tabs. Per-player row: position, name, **G / A / CS / OVR** columns (clean sheets populated only for DEF/GK). A second synced row shows source club+season badge ("Swipe for club & season →" on mobile). January-signed player flagged "IN"; "Tap a JAN row to see who made way" reveals the outgoing player.

### 6d. Season totals strip
Wins / Draws / Losses / Points / Goals For / Goals Against as 6 headline numbers.

### 6e. Season awards — direct comparison to our Golden Boot/MVP hub
| Award | What it is | Do we have it? |
|---|---|---|
| ⚽ Golden Boot | Top scorer + goals | Yes (matches) |
| 🎯 Playmaker | Top assister + assists | **No — we don't award assists at all** |
| 🧤 Golden Glove | Most clean sheets (GK-focused) | **No** |
| 🏆 Player of the Season | Name + "G · A" combined line, no visible minimum-appearance qualifier | Yes, but ours requires a minimum-match-count qualifier (a quarter of the most-used player's matches) — theirs looks simpler/unqualified |

### 6f. Manager stat card
Manager name + 4 tenure-specific stats: Clean Sheets, Longest Win Streak, Biggest Win (scoreline+opponent), Highest-Scoring match. **We have nothing manager-attributed** — our `WorldClub.refManager` is tactics-only, no stat rollup tied to the manager.

### 6g. Sharing / persistence / meta
- **Two distinct share CTAs**: "📸 Share your season" (whole run) and "Share your January" (just that story beat) — we only have one generic end-of-pipeline share point.
- **Guest-persistence pitch at peak investment**: "🏆 Don't lose this season — This run is only saved on this device. Sign in free and every season you play counts forever." A much stronger, more specific loss-aversion prompt than our `GuestGateModal` (which only fires earlier, at squad-confirm time, never reinforced again after a full season's payoff).
- "🏆 Your 38-0 History" (per-user run archive) + "☕ Buy me a coffee" (monetization signal, not directly actionable for us).
- **"Add this run to the leaderboard"** — gated behind picking a display handle only (lighter than full auth).
- **Collapsed "Final League Table"** (confirmed by expanding it): a genuine **full 20-club simulated table**, columns `# / CLUB / GD / PTS` only. The 20 opponents were exactly the current Premier League's 20 clubs, generic present-day identity — **direct validation of our own `fillAiClubsFromLeague`** (one real league's current club count, no season-specific opponent identity). Their own row is labeled plainly "Your XI" with no distinct visual tag, simpler than our `highlightClubId` + "(You)" badge treatment but the same underlying goal.

---

## 7. Full mode catalog

### 7a. Classic (everything above)
Draw from every club/era, build any-era XI, simulate, chase 38-0.

### 7b. One-Club XI (`/clubs`)
Draft pool restricted to players who **actually played for one chosen club** across its whole top-flight history. **Prime ratings mode is unavailable here** (a career-best row could come from a different club, breaking the constraint — Season ratings only). Formation must be one "that club can genuinely field" (unclear if hard-enforced or flavor text).

Dedicated trophy set (on top of standard trophies):
- 🏆 **The Invincible** — go 38-0 (same headline goal)
- 🏅 **Club Record Breaker** — beat the club's **real historical best-ever top-flight points total** (implies they store real per-club historical season-record benchmark data)
- 🪦 **Club Worst Ever** — finish below the club's real lowest-ever top-flight season, framed as a comedic "for the brave" achievement

Each of the 49 clubs gets its **own isolated leaderboard** ("you're only ranked against other people who picked the same club"). Sign-in required to save/climb. Not available in multiplayer.

**Idea worth borrowing**: real historical-record trophies is a clean way to plug real football history into an otherwise fictional-composite game and adds goals beyond "go unbeaten." Would need per-club historical points-total benchmarks we don't currently derive from `RefClubSeason`.

### 7c. Daily Challenge (`/daily`) — a full constraint-satisfaction puzzle mode, the second standout idea
Reuses the same wheel/pitch/draft UI shell under a completely different ruleset:
- **Themed daily puzzle** tied to a real-world date/event — observed: "🎂 HAPPY BIRTHDAY, ERLING HAALAND" (his real birthday) and, from the prior day, "WORLD CHAMPIONS: SPAIN" (a nationality-themed puzzle) — implies a varied theme pool (player-birthday puzzles, country/tournament puzzles, likely more).
- **Global fixed-time refresh** ("Refreshes in 9h 0m · next challenge at 12:30 PM") — one puzzle for everyone, resets on a server clock, not per-user midnight.
- **Compound constraints**: a mandatory **anchor player** pre-seeded into your squad (not drafted), plus additional required briefs each independently tracked (e.g. "2 other Manchester City players (past or present)", "1 other Norwegian"), with an explicit rules footnote defining "past or present" (any PL appearance for that club from 1992-93 onward).
- **Bonus scoring**: exceeding a constraint's minimum still improves your score (score is out of some max, e.g. "11/11" seen in a past-puzzle recap) — not pass/fail.
- **Separate attempt economy**: "ATTEMPT N/5" (only 5 full draft attempts per day) **plus** a smaller in-draft "RE-ROLLS REMAINING" budget — two distinct limited resources, not one.
- **Live "COMPLETION ODDS: 85%"** readout, recalculated after every pick, shown in two places (top of panel + beside the requirements checklist) — "Your odds of meeting every requirement, they move as you pick." A genuinely novel piece of UX: turning an abstract multi-constraint puzzle into a single live percentage that reacts to each pick.
- **Formation is fixed for the day** — removes formation choice entirely, keeping the puzzle comparable across all players.
- A dedicated **requirements tracker panel** (checklist with progress fractions + status dots), positioned where the OVERALL panel sits in Classic mode.

**Idea worth borrowing**: a low-cost, high-replayability addition reusing 90% of our existing `DraftPage`/`DrawReel` machinery, adding only a constraint-checklist sidebar, a fixed daily formation, and a live completion-odds calculation.

### 7d. Nations Trophy (`/nations-trophy`) — gated, not played
"Build a nation's XI and win the Nations Trophy unbeaten." Explicitly a **limited-time** tournament, sign-in-only (Apple/Google passwordless OAuth, no email/password option on this particular gate), rewards an exclusive permanent-to-account trophy. Framed as strictly optional bonus content ("Classic 38-0 is still free to play"). Rules beyond the landing blurb unconfirmed (would require account creation to see).

### 7e. Multiplayer — Live Draft (gated, not explored) + Leagues (explored)
- **Live Draft** ("🔴 LIVE NOW"): real-time draft with up to 4 players simultaneously online, racing to build the best XI. Behind sign-in, not explored.
- **Leagues** ("🕑 PLAY ANYTIME", `/multiplayer/leagues`): fully async — "Create a league," share an invite link, join by opening it (no account apparently needed just to join). Three-step flow: (1) creator sets shared rules once (era/difficulty/etc., identical for everyone — "so it's a fair fight"), (2) each participant independently drafts their own XI from any club/era, (3) each XI gets its **own independently-simulated season**, ranked by points, "best team tops the table."

  **This is structurally different from our own Multiplayer** (`MultiplayerPage`'s fixed 2-club head-to-head sharing one simulated season/fixture list). Theirs is N independent solo seasons compared by final points, no shared fixtures between the human players at all — simpler to reason about, and validated at scale by a competitor. Worth reconsidering whether our Multiplayer should move toward "N independent seasons ranked by points" rather than "2 clubs playing each other."

---

## 8. Feature-launch history (their de facto roadmap — from `/story`)

| Date (2026) | Feature |
|---|---|
| 4 Jun | First version live (solo draft + simulate) |
| 6 Jun | Went viral |
| 14 Jun | Daily Challenge ships |
| 15 Jun | Leagues + async Multiplayer ship |
| 16 Jun | Nations Trophy opens |
| 21 Jun | Managers arrive in Solo mode |
| 27 Jun | iOS App Store launch |
| 5 Jul | January Transfer Window ships |
| 9 Jul | Live (real-time) multiplayer ships |
| 14 Jul | 10M seasons simulated milestone |
| 16 Jul | European Nights ships |

Notable sequencing: **Managers shipped before the January window, before European Nights.** We already have Managers- and Europe-equivalents but nothing matching the January window or any multiplayer. Also notable: **async Leagues shipped before live/real-time multiplayer** — validates async-first as the cheaper, earlier-value multiplayer investment if we ever build one.

---

## 9. Leaderboard structure (`/leaderboard`)

"Best all-time top-flight XIs · Normal Difficulty · ranked by points." Global / Friends tabs (implies an account-linked friends graph we don't have). Filters: **Club** (all 49, "(open)" = any club appears in the run), **Time window** (All time/This week/Today), **Formation** (any + all 12), **Squad tier** — a named bucketing of squad overall we don't have anywhere: **Galácticos / Elite / Strong / Mid-table / Budget / Minnows** — worth adopting flavorful tier names instead of a bare overall number wherever we surface squad strength. **Difficulty** (Normal default/Hard/Easy/All), **Ratings mode** (Season/Prime/Any).

Row anatomy: rank, handle (+ optional ✓ verified-run badge, likely an anti-tamper signal), difficulty tag, formation·overall·ratings-mode caption, **RESULT** (`38-0 ✨` for perfect runs, or a compact `W-D-L+GD` string for near-misses), **PTS** (114 max). "⚐ Report a name" handle-moderation control. Notable: every top-20 row observed was Prime ratings + Normal difficulty — the competitive meta favors the safer/higher-ceiling combination over Hard mode's blind/no-reroll flex.

---

## 10. Prioritized ideas worth borrowing (highest leverage first)

1. **Auto-generated season narrative** (§6b) — templated prose reacting to finish position, unit strength, standout player, manager style, and (if applicable) a mid-season event outcome. Biggest single gap; buildable without an LLM via banked templates keyed by finish-bracket/stat-deltas.
2. **A January-style mid-season gamble event** (§5b) — one opt-in pause at the season's halfway point, reusing our existing `DrawReel`/`SlotReel`, gated behind a Setup toggle.
3. **Live per-unit OVERALL readout during drafting** (§4.4) — cheap, high-value incremental feedback loop we currently only show once, at squad-complete time.
4. **Daily Challenge mode** (§7c) — constraint-satisfaction puzzle reusing most of our existing draft UI; the live "completion odds" readout is a standout piece of UX.
5. **Assists award ("Playmaker") and clean-sheets award ("Golden Glove")** (§6e) — small additions to our existing awards hub.
6. **Manager-attributed stat card** (§6f) — clean sheets / win streak / biggest win / highest-scoring match tied to the manager, not just tactics.
7. **A second, end-of-season guest-persistence prompt** (§6g) — reinforce the sign-in pitch at peak investment (season complete), not only at squad-confirm time.
8. **"Move a player" mid-draft repositioning** (§4.3) — relocate an already-drafted player to open a slot for a better-fitting later pick.
9. **Player-pool sort control** (Rating/Position/Surname A–Z) during drafting (§4.6).
10. **Pre-filter the spin pool** rather than reroll-after-landing on a dead squad (§2) — stronger guarantee, if feasible against our data shape.
11. **Squad-tier flavor names** (Galácticos/Elite/Strong/Mid-table/Budget/Minnows) (§9) wherever we currently show a bare overall number.
12. **Async "Leagues"-style multiplayer** (N independent solo seasons ranked by points) (§7e) as a simpler, earlier alternative/addition to a live head-to-head format.

---

## Appendix: source notes

Full chronological raw notes (every screen visited, exact copy captured, DOM inspection results) are in [38-0-research-notes.md](38-0-research-notes.md) in this same directory, for anyone who wants primary-source detail beyond this reorganized summary.
