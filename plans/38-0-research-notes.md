# 38-0.app — Raw Research Notes (scratch, being compiled into final doc)

## Landing page (https://38-0.app/)

Title: "38-0 | Build the Ultimate English Top-Flight Team"
Tagline: "Build an All-Time English Top-Flight XI"
Badge: "UNOFFICIAL FAN DRAFT GAME"

Nav: Home | Play | Multiplayer | How to Play | Greatest XI | How It Works | Leaderboard | Story | Get the App
Top-right: "Create an account or sign in" (auth is NOT required to start — guest-first like our own app), "Play 38-0" CTA -> /game?new=true, "Continue Draft" -> /game (persisted in-progress draft)

Modes surfaced on landing:
- Multiplayer: "Same rules, your XI vs theirs. Most points wins." -> /multiplayer
- One-Club XI: "Build one club's greatest unbeaten XI from its own history."
- Daily Challenge: "Today's puzzle: one go, fresh every day."
- Nations Trophy (LIMITED TIME): "Build a nation's XI and win the Nations Trophy unbeaten."
- "Other ways to get 38-0" (more link)

Scale stats: 49 English top-flight clubs, 4,000+ player seasons, seasons 1992-2026 (i.e. every PL season since inception 1992-93)

"How to play" (4 steps):
1. Spin the wheel — lands on a real English top-flight club from a specific season
2. Draft a player — pick a player from that squad, slot into formation
3. Build your XI — repeat until all 11 positions filled
4. Simulate the season — play out all 38 games, chase unbeaten 38-0

Popular challenges (quick presets/goals):
- Go a full 38-game season unbeaten
- Chase a perfect 38-0-0
- Win the league title
- Build a modern-era XI (2016 onwards)
- Draft an all-time XI from every era
- Win it on Hard Mode with ratings hidden  <- NOTE: "Hard mode" hides ratings during draft

Social proof numbers: 11,609,594 seasons simulated; 5.4M+ players; 46M+ impressions on X; "1992 Every season since"

FAQ headers (collapsed, need to open): What is 38-0? / How do you play? / Which players and clubs included? / Is it free? / Is it fantasy football? / Affiliated with any league? / Where do ratings come from? / Why called 38-0?

Explore links: Football draft game / All-time XI builder / Greatest all-time XI / Season simulator / How to play 38-0

Legal/disclaimer footer: fan-made, not affiliated with any club/league/governing body/publisher/ratings provider. No official logos/crests/images. Player/club names & stats used for "informational, descriptive and editorial purposes."

## FAQ full text (pulled from DOM, <details>/<summary> accordion)

- **What is 38-0?** — "38-0 is an English top-flight draft game where you build an all-time XI from players across every era of English top-flight history. Once your team is complete, you simulate a full 38-game season to see how your squad performs."
- **How do you play 38-0?** — "Spin the wheel to land on an English top-flight club and season, draft a player from that squad, and add them to your team. Repeat until your XI is complete, then simulate the season and see how many points your team can earn."
- **Which players and clubs are included?** — "38-0 includes more than 4,000 player seasons from 49 English top-flight clubs, covering every season from 1992-93 to the present day. You can combine players from different eras to build your dream team."
- **Is 38-0 free to play?** — "Yes. 38-0 is completely free and works in any modern web browser."
- **Is 38-0 a fantasy football game?** — "No. Fantasy football games are based on current players and real-world gameweeks. 38-0 is a nostalgia game where you build an all-time team from any era and simulate an entire season instantly."
- **Is 38-0 affiliated with any league?** — "No. 38-0 is an independent game created by football fans... References to clubs, players, and historical seasons are used descriptively to power the game and do not imply any official association."
- **Where do the player ratings come from?** — "38-0's player ratings are an independent interpretation based on publicly available data and are used for descriptive purposes only, they may differ from any official source. 38-0 is not affiliated with, endorsed by, or sponsored by any game, publisher, or ratings provider." (same "our own derived rating from public data" posture as our own `RefPlayer.overall`)
- **Why is it called 38-0?** — "The aim of the game is to build a team capable of winning every match in an English top-flight season... a perfect season would be 38 wins, 0 draws, and 0 defeats."

Implementation note: FAQ uses native `<details name="faq">` elements (radio-group behavior — opening one closes others since they share `name="faq"`), not custom JS accordion state.

## The Draft screen (/game after Start Draft) — deep dive

Clicking "Start Draft" locks in formation client-side and moves into the draft UI (URL stays `/game?new=true` — SPA, no route change per step).

### Layout (top to bottom)
1. **Header bar**: Formation name + "Locked · restart to change", a "Rerolls:" indicator (amber dot pips, one per remaining reroll — NOT a number, a row of colored dots) placed next to a separate "**N**/11" draft-progress counter (picks made / 11 total slots) in emerald, a thin progress bar underneath (`width: N/11 * 100%`, emerald-500 fill on white/8 track, `transition-all duration-500`), and a "↺ Restart" button (restarts the whole run, title="Start a new run").
   - DOM confirms these are two genuinely different counters sharing one row: reroll budget (dots) vs squad-fill progress (fraction + bar). Good pattern to consider adopting — our own DraftPage shows reroll count as text only, no dot/pip indicator or progress bar.
2. **Pitch view**: full graphical formation preview with all 11 slots as dashed circles positioned per formation, each showing position code (e.g. "CM") + sub-label ("Central") beneath. Legend: 🟠 Keeper / 🔵 Defence / 🟢 Midfield / 🔴 Attack / ⚪ Can't play there — note their position-group color mapping (amber/blue/green/red) differs from ours (amber/teal/mint/crimson) but the same 4-way split (GK/DEF/MID/ATT) with a 5th neutral "ineligible" state.
   - Once a slot is filled, its label switches from the generic sub-label (e.g. "Central") to the drafted player's surname (e.g. "Fàbregas"), and the slot's dashed outline presumably becomes solid/filled (colored dot at top-left of the pitch marks GK slot as filled first — small colored dot appeared above the GK circle even before GK was drafted, worth re-checking, may just be a decorative pitch-spot marker unrelated to fill state).
3. **"⇄ Move a player" button** — "Reposition a drafted player to open up a slot." Appears once at least one player is drafted. This is a distinct mechanic we don't have: lets you relocate an already-placed player to a different eligible slot mid-draft (e.g. if a later spin only fits a slot that's already taken by a versatile player, you can bump them elsewhere first). Worth considering for our own DraftPage.
4. **OVERALL panel**: a running live squad-quality readout — headline `OVERALL` number (89 after 1 pick) plus a per-unit breakdown with icons: ⚡ Attack / 🌀 Midfield / 🛡️ Defence / 🥅 GK, each showing either a rating number or "–" (em dash) if no player yet slotted into that unit, with a horizontal bar/track per row. This updates live after every pick — a continuous feedback loop on squad strength as you draft, unit by unit. **We have nothing equivalent during our own draft** — our `computePreseasonOdds` logic only fires once the squad is complete, on DraftPage's confirm/preview step, not incrementally per pick. Strong idea to borrow.
5. **"SPIN FOR A SQUAD" section**: "N positions left to fill" headline, then a CLUB × SEASON dual-reel display (two side-by-side boxes joined by "×"), a big green "🎰 Spin the Wheel" button, and helper text "or tap anywhere, or press Space" — i.e. the whole page area is clickable and Space is a keyboard shortcut to spin. We only support clicking our explicit button.
6. **Player pool** (after a spin lands): "SQUAD SPUN" badge + a second badge that read **"PRIME"** in this run (need to double check meaning — possibly denotes this specific club-season is tagged as a notable/"prime era" squad for that club rather than literally our ratingsMode; TODO verify against How It Works page) + "N slots left", club name (with colored dot matching the eligible-position color of a highlighted slot?) and season year, a "🔄 Re-roll (N left)" button scoped to just this spin (consumes the run's shared reroll budget), instruction text "Pick any player, then choose which open position to slot them into.", and a **SORT** control with three tabs: **Rating** (default) / **Position** / **Surname A–Z** — sorting the player pool list. We don't currently offer any sort control on our player pool.
7. **Player rows**: overall badge (colored by position group) + name + nationality, with up to 3 position-eligibility chips on the right (e.g. Fàbregas: CM / CAM / CDM) showing their versatility, matching our own multi-position eligibility concept. Clicking a row expands an inline **"PLACE IN (N)"** panel directly below that row (not a modal) listing exactly the currently-open slots this player is eligible for as big tappable pills (e.g. three "Central Mid (CM)" pills since a 4-3-3 has 3 CM slots) — clicking one instantly assigns the player to that slot, decrements "positions left", advances progress bar, and returns to the spin-again state.

### Confirmed mechanics from playing pick #1
- Difficulty=Normal really does mean **1 reroll for the entire 11-pick draft** (a shared/global budget), not 1-per-spin — confirms our reading of the setup screen copy.
- The reroll button appears both generically (in the header dot indicator) and contextually (next to the currently-spun club, "Re-roll (1 left)") — clicking either presumably re-spins the same slot's club without spending a "pick."
- A drafted player's slot on the pitch shows their **surname only** (not full name) as the label.

## Full draft playthrough — squad drafted (4-3-3, Normal, Squad First, Prime[?] ratings, All-time era)

Spun through 11 clubs one pick each (confirmed: exactly one pick per spin, same as our app):
1. Arsenal 2007/08 → Cesc Fàbregas (89, CM)
2. Liverpool 2007/08 → Sami Hyypiä (88, CB)
3. Sheffield United 2023/24 → Mason Holgate (77, RB)
4. Fulham 2022/23 → Willian (85, RW)
5. West Ham United 2001/02 → David James (86, GK)
6. Manchester City 2007/08 → Martin Petrov (81, LW)
7. Birmingham City 2010/11 → Kevin Phillips (88, ST)
8. Manchester City 2021/22 → Kevin De Bruyne (93, CM)
9. Charlton Athletic 2005/06 → Chris Powell (79, LB)
10. Everton 2007/08 → Joleon Lescott (82, CB)
11. Tottenham Hotspur 2007/08 → Tom Huddlestone (81, CM)

Final squad OVERALL = 85 (Attack 85 / Midfield 88 / Defence 82 / GK 86 — the four unit numbers averaged/weighted into one headline figure).

**"SQUAD SPUN" badge showed "PRIME" on literally every single spin** regardless of club quality (even a weak 2023/24 Sheffield United relegation squad) — this confirms the badge reflects the **run-level PLAYER RATINGS setting** (Season vs Prime), displayed redundantly on every spin panel as a reminder of which mode you're in, not a per-squad "this is a peak/notable season" tag as I first guessed. (Also implies my default click on "Start Draft" landed on Prime rather than Season — worth re-testing which pill is actually pre-selected by default if precision matters later.)

### Draft-complete screen ("Your XI")
Once all 11 slots fill, the pitch view switches from dashed placeholder circles to solid colored player tokens (initials avatar + overall-rating badge top-right of the circle + surname label below), color-coded by position group (GK=amber, DEF=blue, MID=green(mint/emerald), ATT=red) — same legend as during drafting. Below the pitch, a **"Your XI" list**: "4-3-3 · Overall 85" header, then every player as a row: position code, full name, 3-letter club code (e.g. MCI, ARS, TOT, WHU), season, overall badge. This list is the flat/textual counterpart to the pitch graphic — good pairing pattern (visual + scannable list) worth matching in our own post-draft summary.

### Manager step ("OPTIONAL — Add a manager?")
"A manager changes the style of your season, not your odds of going 38-0." — an explicit, reassuring line of UX copy clarifying managers are flavor/style, not a power stat. Two choices: "🎲 Spin for a gaffer" or "No manager (classic)" — directly mirrors our own post-draft manager roll step (`POST /catalog/roll-manager`, decline = `DEFAULT_TACTICS`). Good validation that our design converged on the same pattern independently.

## /story — "Our Story" page (their feature-launch history — useful as a de facto roadmap reference)

Marketing/about page, but the **feature timeline is genuinely useful competitive intel** — shows the order they shipped features in, starting from a single-weekend MVP:
- **4 Jun 2026** — first version live (solo draft + simulate only, presumably)
- **6 Jun** — went viral (traffic context, not a feature)
- **14 Jun** — Daily Challenge ships
- **15 Jun** — Leagues + (async) Multiplayer ship
- **16 Jun** — Nations Trophy opens
- **21 Jun** — Managers arrive in Solo mode
- **27 Jun** — iOS App Store launch
- **5 Jul** — January transfer window ships (mid-season squad update)
- **9 Jul** — Live multiplayer (real-time head-to-head draft) ships
- **14 Jul** — 10M seasons simulated milestone
- **16 Jul** — European Nights ships

Notable sequencing: they shipped **Managers before the January window before European Nights** — we already have Managers-equivalent and Europe-equivalent, but nothing matching January Transfer Window or any Multiplayer. Also notable: **async "Leagues"/Multiplayer shipped before live/real-time multiplayer** — i.e. they built a simpler asynchronous "everyone plays the same draft on their own time, compare results" mode first, then added true live drafting later. If we ever build multiplayer, that ordering (async-compare first, live-draft second) is a reasonable phasing to copy.

Scale stats (as of 18 Jul 2026): 5.4M+ unique visitors, 46M+ impressions on X, 10.9M+ seasons simulated. "Now on iOS. Charting #4 in UK Trivia and #7 in UK Sport on the App Store." Built by "a small group of football fans, not a studio," heavy social-proof section (Max Verstappen, Miniminter, Sam Allardyce, NickRTFM played it on video/social; Currys and Specsavers referenced it; The Anfield Wrap and Pitchside podcasts discussed it; Man Utd/Crystal Palace/Southampton posted their own all-time XIs; Brentford FC engaged with a post) — pure marketing content, not mechanically relevant, noted only for completeness.

## /nations-trophy — Nations Trophy mode (gated behind account sign-in — not played through)

"Win the Nations Trophy. Keep the trophy." A **limited-time tournament mode for signed-in players only** — drafting builds a nation's XI (per the landing-page description: "Build a nation's XI and win the Nations Trophy unbeaten") rather than a club-history-agnostic all-time XI or a single-club XI. Rewards: an exclusive "very-gold" **Nations Trophy Winner** trophy, permanently saved to account. Framed explicitly as optional/bonus content: *"Classic 38-0 is still free to play. This tournament is an optional extra for players who want the trophy."*

Sign-in is **passwordless, Apple/Google OAuth only** ("Continue with Apple" / "Continue with Google") — no email/password option shown on this gate, with copy stressing "38-0 never sees or stores a password." Minimum age 13. Optional marketing-email opt-in checkbox. This gate stopped further exploration here (creating an account is out of scope for this session) — the actual nations-draft UI/rules beyond the landing blurb are unconfirmed.

## /multiplayer + /multiplayer/leagues — Multiplayer modes (async details; Live Draft is behind sign-in, not explored)

Landing page for multiplayer splits into two distinct products:
- **Live Draft** — "🔴 LIVE NOW" — "Draft in real time with up to 4 players. Everyone's online at once, racing to build the best XI." (button, not a plain link — requires sign-in, not explored further since it needs an authenticated multi-user session we can't simulate solo.)
- **Leagues** — "🕑 PLAY ANYTIME" — "You and your mates each build a team and play a season whenever you want. No need to be online together, and the best team tops the table." Links to `/multiplayer/leagues`, a dedicated explainer page:
  - "Create a league" CTA + "Got a link from a mate? Just open it to join." — invite-link-based joining, no explicit friend/account graph required to join (though presumably needed to create/save).
  - Three numbered steps: **1. You set the rules** (settings picked once — eras, difficulty, etc. — locked identically for every participant, "so it's a fair fight"), **2. Everyone builds a team** (each player independently drafts their own XI from any club/era), **3. Best team wins** (each XI gets its own full season simulated independently, ranked by points, "Share the link and see who comes out on top").
  - This is structurally identical to our own `MultiplayerPage` concept (`createSeason(world.id, "Head-to-Head", { size: 2 })`) but generalized beyond a fixed 2-club head-to-head to an arbitrary N-player async league ranked by each player's independently-simulated season points, not a shared fixture list between the human players. Worth reconsidering whether our own Multiplayer should evolve from "2 clubs sharing one season" to "N independent solo seasons ranked by points," which is simpler to reason about and matches what a competitor validated at scale.

## /clubs — One-Club XI mode

"Pick a club and build its greatest unbeaten 38-0 XI, drawn only from that club's history." Key rule differences from the classic mode:
- Draft pool restricted to players who **actually played for that one club** across its whole top-flight history (still one-player-per-season-instance, same underlying data).
- **"Prime (career-best ratings) isn't available in this mode"** — Season ratings only, since "everyone's rated by the season they actually played for the club" (a career-best row might come from a different club, which would break the one-club constraint).
- Formation must be one "that club can genuinely field" — implies formation choice may be restricted/validated per club (unclear if literally limited, or just flavor text).

**A dedicated trophy set for this mode** (on top of the standard trophies, which still apply):
- 🏆 **The Invincible** — go the whole season unbeaten (38-0) — same as the core game's headline goal.
- 🏅 **Club Record Breaker** — beat your club's real best-ever top-flight points total. **Implies they store real historical season records (points totals) per club as benchmark data.**
- 🪦 **Club Worst Ever** — finish below your club's real lowest-ever top-flight season ("for the brave") — a comedic/self-deprecating achievement, deliberately framed as something to laugh about rather than avoid.

**Per-club leaderboards**: "you're only ranked against other people who picked the same club" — each of the 49 clubs gets its own isolated leaderboard, not one global mixed pool. Sign-in required to save runs/climb boards. Explicitly "not available in multiplayer yet — solo mode for now."

The page itself is just a big directory of all 49 clubs as link cards (each "ONE-CLUB XI · <Club Name> →"), presumably routing into the same draft UI with the club pre-locked.

**Idea worth borrowing**: real historical-record-based trophies ("beat your club's actual best/worst top-flight season") is a clever way to plug real football history into an otherwise fictional-composite game, and gives replayability/goals beyond just "go unbeaten." We already store real `RefClubSeason` data (points, standings would need deriving or don't exist yet) — could be a lightweight addition once/if we build a one-club draft variant.

## /daily — Daily Challenge mode (the other standout mechanic we have nothing like — a constraint-satisfaction puzzle layered on the same draft engine)

Distinct from the classic mode in almost every way except reusing the same spin-the-wheel/pitch/draft UI shell:

### Theming and cadence
- A **themed daily puzzle tied to a real-world date/event**, e.g. our playthrough hit **"🎂 HAPPY BIRTHDAY, ERLING HAALAND 🤖"** (Haaland's real birthday) with flavor text "Happy Birthday to Premier League goal machine Erling Haaland." Yesterday's theme was **"WORLD CHAMPIONS: SPAIN"** (a nationality-themed puzzle) — confirms the theme pool includes both player-birthday puzzles and country/tournament-themed puzzles, likely more variety beyond these two samples.
- **Countdown + fixed refresh time**: "⏳ Refreshes in 9h 0m · next challenge at 12:30 PM" — one puzzle globally per day, same for everyone, refreshing at a fixed clock time (implies server-side, timezone-fixed reset, not per-user midnight).
- Yesterday's result is shown collapsed above today's puzzle: "YESTERDAY · WORLD CHAMPIONS: SPAIN — Top score 11/11 · maxed in 1" — shows the community high score and how few attempts it took to max it out, plus a dismiss (✕) control.

### Puzzle structure — compound constraints, not just "fill a formation"
- **A mandatory anchor player**: "⭐ Erling Haaland starts in your XI" — pre-seeded/forced into the squad (not drafted by the player).
- **Additional required constraints ("THEN FIELD:")**, each a small chip with a 🟢 status dot: e.g. "2 other Manchester City players (past or present)" and "🇳🇴 1 other Norwegian" — compound club-history + nationality constraints, independently tracked.
- Rules clarification footer: *"A club counts any player who represented that club in the Premier League from the 1992/93 season onwards."* — defines "past or present" precisely for club-affiliation constraints.
- **Bonus scoring**: *"more players who fit the brief improve your challenge score"* — going beyond the minimum required count for a constraint still helps your score, i.e. this is a scored puzzle (out of some max, e.g. "11/11" seen in yesterday's recap — likely one point per squad slot that satisfies some brief-relevant condition), not just pass/fail.

### Attempt economy (distinct from classic mode's reroll system)
- **"ATTEMPT 1/5"** — only 5 full draft attempts allowed per day, shown as a counter (distinct from in-draft rerolls).
- **"RE-ROLLS REMAINING: 1"** — a separate, smaller reroll budget within a single attempt.
- **"COMPLETION ODDS: 85%"** — a live, continuously-recalculated probability estimate of successfully meeting every hard requirement given your picks so far, shown prominently at the top of the draft panel AND restated inline next to the requirements checklist. Caption: *"Your odds of meeting every requirement, they move as you pick."* — genuinely novel meta-mechanic: as you draft, the game tells you your live odds of completing the puzzle, presumably computed from how many eligible players remain in the pool for each unmet constraint given remaining open slots.
- **Formation is fixed for the day** (not player-selectable, e.g. our run was locked to 4-4-2) — removes one whole axis of player agency compared to classic mode, keeping the puzzle's difficulty controlled/comparable across all players that day.

### Requirements tracker panel (live, during draft)
A dedicated checklist mirroring the OVERALL panel's position: **"REQUIRED"** header, then per-constraint rows showing progress fraction + an empty/filled status circle, e.g. `0/2 · 2 other Manchester City players (past or present) · ○` and `0/1 · 🇳🇴 1 other Norwegian · ○`, plus an aggregate `1/11 challenge players` line (how many of the 11 drafted so far count toward *any* brief requirement) and the same `COMPLETION ODDS: 85%` repeated here.

**This whole mode is a second standout idea we have nothing resembling** — a daily rotating constraint puzzle (anchor player + compound club/nationality briefs + bonus scoring + a live completion-odds readout) built as a thin ruleset layered on the exact same wheel/draft/pitch components as the core game. If we ever wanted a low-cost high-replayability addition, a "Daily Challenge" mode reusing our existing `DraftPage`/`DrawReel` machinery with an added constraint-checklist sidebar and a fixed formation-of-the-day would be a natural fit — the live "completion odds" readout in particular is a nice piece of UX that make an otherwise abstract constraint feel tangible turn-by-turn.

## Static content pages (/how-it-works, /how-to-play, /leaderboard)

### /how-it-works
Framing copy, not new mechanics, but confirms several things precisely:
- "The wheel only ever lands on a club and season **that can fill a position you still need, so you never get a dead spin.**" — CONFIRMS their wheel is pre-filtered at the source to only ever offer spins with at least one eligible player for an open slot. This is a *stronger* guarantee than our own approach (`DraftPage`'s auto-reroll-after-the-fact deadlock guard, capped at `MAX_AUTO_REROLL_ATTEMPTS`) — they never even show you a dead squad, we detect-and-silently-redraw after landing on one. Worth considering pre-filtering the spin pool itself rather than post-hoc rerolling, if feasible against our data shape.
- "Once your eleven is set, the engine plays out all 38 fixtures... It looks at how strong your side is and, just as much, **how balanced it is** across the keeper, the defence, the midfield and the attack." — confirms per-unit balance (not just aggregate overall) meaningfully affects sim outcome, same philosophy as our own `computeUnitRatings()` + `POSITION_UNIT_WEIGHTS`.
- "Run the same XI more than once and the season can play out differently" — confirms per-run randomness/non-determinism from the player's perspective (a fresh random seed each simulate, same as our `simulate(setup, seed)` contract where sim-worker generates a fresh seed per match — deterministic per-seed, but the player never controls the seed so every "Simulate Season" click effectively looks random to them).

### /how-to-play
"The game in six steps": Spin the wheel → Draft a player → Build your formation → Complete your XI → Simulate the season → Chase 38-0. Notable exact-rules confirmations:
- **Scoring**: standard 3pts win / 1pt draw, 38 games → max possible = **114 points** for a perfect 38-0-0.
- **"Once a real player is in your team they cannot be picked again, even from a different club or season."** — confirms duplicate-player prevention is a first-class rule they state explicitly (we enforce this client-side via `draftedIds`, same rule).
- Strategy tips section (flavor/marketing copy, but useful for tone): "Balance beats stars", "Draft the slot, not the badge", "Know when to gamble", "Every era is in play".
- Brief mentions of One-Club mode and Daily Challenge as alternate ways to play (covered separately below).

### /leaderboard
"Best all-time top-flight XIs · Normal Difficulty · ranked by points." Two top-level tabs: **Global** / **Friends** (implies a friends-graph feature tied to accounts — we have no equivalent social layer). A **Filters** panel (expandable, "Filters ▾") with five independent filter axes:
1. **Club** — "All clubs (open)" + explicit list of all **49** English top-flight clubs (matches the landing-page stat exactly) — "(open)" suggests this default option means "any club drafted at all," i.e. you could filter the leaderboard to only runs that included a specific club's players.
2. **Time window** — All time / This week / Today
3. **Formation** — Any formation + all 12 formations
4. **Squad tier** — "Any squad tier" + **Galácticos / Elite / Strong / Mid-table / Budget / Minnows** — a named-tier bucketing of squad overall rating (flavorful naming, not raw numbers) we don't have anywhere; worth adopting similar tiering for squad-strength display instead of (or alongside) a bare number.
5. **Difficulty** — Normal (default) / Hard / Easy / All difficulties
6. (separate, not in the "Filters" list but shown per-row) **Ratings mode** — Season ratings / Prime ratings — also filterable ("Any ratings" option).

**Leaderboard row anatomy**: rank # / handle (+ optional ✓ verified-run badge — likely marks runs the server can attest weren't tampered with client-side, an anti-cheat signal) / difficulty tag / formation · squad overall · ratings-mode caption / **RESULT** column showing either a literal scoreline+sparkle for a perfect run (`38-0 ✨`) or a `W-D-L+GD` compact string for near-misses (e.g. `37-1-0+89` = 37 wins, 1 draw, 0 losses, +89 goal difference) / **PTS** column (114 max). A "⚐ Report a name" moderation control sits below the table (handle content moderation, since handles are free-text and public).

Notable: every single row in the top 20 we saw was **Prime ratings** + **Normal** difficulty — strongly suggests the competitive meta favors Prime (higher achievable overalls) at the safer difficulty tier (some rerolls, ratings visible) rather than Hard mode's blind/no-reroll variant, despite Hard presumably being the "harder" flex.

## END-OF-SEASON RESULTS SCREEN — the single richest screen in the whole app (huge gap vs our stats-hub)

Reached via a **"Skip all →"** link (top-right of the matchweek-reveal header, appears once you're past the January event) that instantly resolves every remaining fixture and jumps to the full results screen — analogous to our "Skip ahead," but theirs is offered mid-reveal as a persistent link, not a separate control.

### Full match log
"SEASON RESULTS" — literally all 38 fixtures listed newest-first (GW38 → GW1), same card format as the live reveal (GW badge, W/D/L, opponent + H/A, score, scorers+minutes). Unlike our app (which filters replay to "your fixtures only" across a big multi-club league), theirs is trivially just "your 38 games" since the whole "league" here is scaled to exactly your one campaign — no other clubs' fixtures exist to filter out. Not directly comparable to our filtering problem, but confirms full-season-log-on-one-screen is a viable end-state pattern worth having available (e.g. behind a "view full log" expander) even in our bigger-league context.

### Auto-generated season narrative (THE standout feature — we have nothing like this)
A whole block of **procedurally-generated prose** reacting to the specific season that happened, not just stat tiles:
- **FINISHED 5th / PROJECTED 3rd / verdict tag** — a short colored verdict phrase comparing actual vs projected finish, e.g. we got **"FLATTERED TO DECEIVE"** (red-colored — finished worse than projected). Implies a small table of verdict phrases keyed off finished-vs-projected delta (over-performed / met expectations / under-performed), each with its own tag text and color.
- **Unit-quality labels**: ATTACK Strong / MIDFIELD Excellent / DEFENCE Very good / GOALKEEPER Strong — qualitative tiers (Strong/Excellent/Very good/etc.) derived from the same per-unit overalls shown during drafting, mapped to word-bands rather than shown as raw numbers here.
- **A composition sentence**: *"Built around the midfield, and strong right across; the defence the most understated part of a good side."* — dynamically identifies your strongest unit ("Built around the X") and comments on the weakest/most surprising one.
- **A finish-position flavor headline + paragraph**, keyed to where you actually finished — ours was **"EUROPE, THE TINPOT END"** (5th place, i.e. Europa-adjacent but not Champions League) with body text: *"5th on 75 points. Europe, but the Thursday-night kind. Huffed and puffed, never got out of second gear. 75 points. They'll take that, all day long. [Biggest win] got taken to the cleaners, 4-0, on the afternoon it all clicked."* — auto-references your actual biggest win (team + scoreline) inside the prose. Strongly implies a bank of flavor headlines/paragraphs keyed by final-position bracket (title / top-4 / "tinpot Europe" / mid-table / relegation-battle / relegated etc.), each with templated slots for points total and biggest-win fixture.
- **January-event outcome recap** (only appears if you gambled): *"You found a January bargain. Aaron Wan-Bissaka gave the XI more security."* then *"Mason Holgate made way in January. The season finished much as it would have anyway."* — two short verdict lines, one for the player who arrived, one for the player who left, each independently commenting on impact.
- **A standout-player callout**: *"Petrov was the heartbeat of the whole thing."* (bold/emerald) followed by an italic, amber, quote-styled aside with a 🎙️ mic icon: *"Martin Petrov quietly top-scored with 20 goals. He's answered his critics, first name on the teamsheet by the end."* — styled visually like a pundit soundbite, distinct from the rest of the narrative block.
- **A manager-specific closing line**, tying the result back to the manager's own style blurb from the draft step: *"George Graham kept it as tight as ever, but with so little at the other end the clean sheets only bought so many points."* — directly echoes his earlier "Hard to beat. Fewer goals at both ends and a clean-sheet habit." description, i.e. the manager's flavor text and the season recap draw from the same underlying trait data.

**This entire narrative block is the single biggest gap between 38-0 and our own `CompetitionStatsPanel`/stats-hub.** We show numbers (standings, top scorers, MVP) but generate zero prose. Even a lightweight version — a templated headline + 1-2 sentences reacting to finish position, standout unit, and top performer — would close a lot of this gap without needing an LLM call (just banked templates keyed by finish-bracket/stat-delta, same as they appear to be doing).

### Player stats table ("YOUR XI")
Header "4-3-3 · OVERALL 85" with two view tabs: **Stats** / **XI**. In Stats view, one row per player: position, name, **G / A / CS / OVR** columns (Goals / Assists / Clean Sheets / Overall) — CS only populated for defenders/GK (e.g. Powell 2G 6A 17CS; James -G -A 17CS). A second synchronized row per player shows their **source club badge + season** (e.g. "MCI 2007/08") with a "Swipe for club & season →" hint — implies on mobile this is a horizontal swipe-between-two-views-per-row interaction, not two rows.
- The January-signed player's row is flagged **"IN"**, with a line below the table: "January: signed Aaron Wan-Bissaka" / "Tap a JAN row to see who made way" (interactive — presumably reveals Holgate as a comparison).

### Season totals strip
Wins / Draws / Losses / Points / Goals For / Goals Against as 6 big numbers (23 / 6 / 9 / 75 / 69 / 35 in our run).

### SEASON AWARDS (their Golden Boot/MVP hub — direct comparison point)
- ⚽ **GOLDEN BOOT** — top scorer + goal count (matches our concept exactly)
- 🎯 **PLAYMAKER** — top assister + assist count (**we don't have an assists award at all**)
- 🧤 **GOLDEN GLOVE** — most clean sheets (GK/keeper-focused) + count (**we don't have this**)
- 🏆 **PLAYER OF THE SEASON** — name + "20G · 4A" combined line (their MVP, similar to our own MVP but simpler: no minimum-appearance qualifier mentioned, may just be highest combined G+A)

### Manager stat card
Manager name + 4 stat tiles attributed specifically to their tenure: **Clean Sheets** (17), **Longest Win Streak** (7), **Biggest Win** ("4-0 vs Wolves"), **Highest-Scoring** match ("3-4 vs Manchester United") — a manager-specific stats box we don't have (our `WorldClub.refManager` is tactics-only, no stat attribution).

### Sharing / persistence / meta CTAs
- "📸 Share your season" and a separate "Share your January" — **two distinct shareable-image CTAs**, one for the whole season, one specifically for the January-window story beat. We only have one generic share point (implicit at end of pipeline); worth considering a dedicated shareable card for a single stand-out moment, not just the whole run.
- Guest-persistence pitch, placed at the exact moment of maximum investment (end of a full season): **"🏆 Don't lose this season — This run is only saved on this device. Sign in free and every season you play counts forever: trophies, streaks and records, on any device."** CTA "Sign in & keep my history." This is a much stronger/more specific loss-aversion pitch than we currently make anywhere — our `GuestGateModal` only appears earlier, at squad-confirm time, not reinforced again after a big payoff moment. Worth considering a second, softer prompt at end-of-season for guest users.
- "🏆 Your 38-0 History" (presumably a per-user archive of past runs) and "☕ Buy me a coffee" (a donation link — indie/solo-dev monetization signal, not directly relevant to our build but useful context on how this competitor sustains itself with zero ads/paywall visible anywhere in the flow).
- **"Add this run to the leaderboard — Pick a handle and compare your XI against everyone else."** + Submit — global leaderboard submission gated behind picking a display handle (not full auth) — lighter-weight than a full sign-in, worth studying their /leaderboard page separately.
- Collapsed **"FINAL LEAGUE TABLE"** (▼ expandable — confirmed by expanding it): it IS a full simulated 20-club table, columns `# / CLUB / GD / PTS` only (no W/D/L/GF/GA columns in this condensed view). Our run: 1 Man City +35/80, 2 Tottenham +39/78, 3 Arsenal +40/76, 4 Chelsea +25/76, **5 "Your XI" +34/75** (highlighted as our row, plain text label "Your XI" rather than the drafted squad name), 6 Man Utd, 7 Liverpool, 8 Wolves, 9 Bournemouth, 10 Brighton, 11 Fulham, 12 Brentford, 13 West Ham, 14 Crystal Palace, 15 Everton, 16 Aston Villa, 17 Newcastle, 18 Leeds, 19 Nottm Forest, 20 Burnley. **This confirms the AI-filled opposition is exactly the 20 current Premier League clubs** (generic present-day identity, not tied to any specific season) — direct validation of our own `fillAiClubsFromLeague` concept (one real league's current clubs, sized to that league's actual club count). They don't show an explicit "(You)" tag on their row — just the literal string "Your XI" substituted for a club name, simpler than our `highlightClubId` + "(You)" badge approach but achieving the same goal.
- Final actions: "📸 Share" (general) and "New Run" (restart).

## Season simulation UI — matchweek reveal + January Transfer Window (THIS IS THE BIG FEATURE WE DON'T HAVE)

Clicking "Simulate Season →" does NOT show a loading screen for the whole 38 games at once — it immediately starts an animated reveal that begins mid-season (opened already at "MATCHWEEK 10 / 38" within a couple seconds), i.e. **matches are revealed progressively, most-recent-first, in a scrolling card feed**, extremely similar in spirit to our own `MatchPopupReel`/`SeasonPage` matchday-by-matchday reveal — except theirs is a single continuous vertical feed of result cards (newest at top, sliding in), not one full-screen popup per match. Each card:
- `GW<n>` badge + result badge (W/D/L, colored pill: green=W) + opponent name + `(H)`/`(A)` + score (large, colored to match result) + a line of goal-scorers with minutes (`⚽ Petrov 54′ Petrov 68′`), comma/space separated, repeated scorer shown per goal (not "Petrov x2").
- A running **stat strip** below the feed: WON / DRAWN / LOST / PTS (4 big numbers, color-coded: green/white/red/gold) + a `GF n · GA n · GD +n` summary line underneath.
- Top-right of the matchweek header: a **"Skip to January →"** link — implies you CAN fast-forward through the reveal animation to the next major checkpoint instead of watching all individual cards, similar to our "Skip ahead" bypass.

### THE JANUARY TRANSFER WINDOW EVENT (confirmed, played through live) — a mechanic we do not have at all
Triggers automatically at **matchweek 19/38 (exactly halfway)**, pausing the reveal with a distinct panel:
- Header **"JANUARY TRANSFER WINDOW"** / subheader **"Halfway there"**
- A stat recap: **W-D-L** (e.g. "12-2-5"), **POINTS** (38), **GD** (+18) — three stat tiles
- Narrative line: *"19 games played, 38 scored and 20 conceded. On this pace you are on course for [Nth]. Stick with your XI, or gamble on one move. There is no undo."* — dynamically inserts your actual current pace/projected finish into the sentence.
- Two choices: **"Enter the transfer market"** (gamble) or **"Stick with your XI"** (decline, presumably just resumes the reveal unchanged).

Choosing to gamble draws a **random event card** (drafted via the same visual language as a big warning/alert panel, amber-orange bordered, distinct from the emerald "safe" color used everywhere else in the app — a deliberate risk cue):
- Observed variant: **"DEADLINE DAY — Bargain Buy"** — *"A scout swears he has found a gem. One blind signing for your weakest spot, no questions asked."* CTA: "Confirm the move" (solid amber button, contrasts with the app's usual emerald CTA color — reinforces "this is a gamble, not a safe default action").
- Confirming re-uses the **exact same spin-the-wheel widget** (CLUB × SEASON reel + "Spin the Wheel" button) as the main draft — a nice bit of mechanic reuse: the January event doesn't invent new UI, it just re-enters the club/season roulette to determine the transfer's source squad.
- Spinning resolves instantly to a **"DONE DEAL"** result screen: `DONE DEAL · <POSITION>` header, **OUT** (old player name + old rating, with a ↓ arrow) → **IN** (new player name + source club/season + new rating), plus a one-line verdict e.g. *"Up 3 rating points in that position."* (would presumably say "Down N points" or similar if the blind signing was a downgrade — it's genuinely a gamble, can backfire). CTA: "Continue the season" resumes the matchweek reveal from where it paused.
- In our playthrough: weakest-rated slot was auto-detected as **RB** (Mason Holgate, 77 — our lowest overall on the pitch) and the blind signing (Aaron Wan-Bissaka, West Ham 2025/26, 80) was swapped in there automatically — confirms "for your weakest spot" is not player choice, the game picks the position, only the club/season (and therefore player) is randomized.
- Since setup screen copy said "It can help or hurt. No undo" — implies other event variants likely exist (a downgrade outcome, maybe different event *types* beyond "Bargain Buy" — e.g. possibly a sale/loss-of-player event, an injury event, etc.) — we only saw one instance in this single playthrough, so the full event pool is unconfirmed; worth another playthrough or checking How It Works / Story pages for a fuller list if we want to replicate this system.

**Design implication for our own app**: this whole system (mid-season pause + narrative recap + optional random gamble event with a distinctive "danger" visual language + reuse of the draft-wheel widget for resolution) is a genuinely novel mechanic we have nothing like. `SeasonPage.tsx`'s pipeline (`runSeasonPipeline`) currently goes straight from domestic season completion to stats-hub with no engineered mid-season narrative beat. Worth scoping as a future Phase idea: a single opt-in "mid-season event" at matchweek ~19/38, reusing our own `DrawReel`/`SlotReel` component for resolution, gated behind a Setup toggle exactly like their "January Transfer Window" toggle.

## Manager roll + Pre-season odds screen

"🎲 Spin for a gaffer" produced: **George Graham** — "YOUR GAFFER" panel, name, one-line style blurb: *"Hard to beat. Fewer goals at both ends and a clean-sheet habit."* — CTA "Continue with Graham →". Exactly the same shape as our own manager roll (real name + a short tactical-philosophy blurb), good independent validation of that pattern.

After confirming the manager: **"🏆 Squad Complete"** screen — "Here's what the pundits make of your XI. Simulate the season and chase the impossible." Then a **PRE-SEASON ODDS** panel — direct analogue of our `computePreseasonOdds`/`DraftPage` odds panel:
- PROJECTED FINISH: "3rd" (big number)
- EXPECTED POINTS: "77" (big number, top right)
- Then 5 stacked labeled progress bars, each a probability: **Win the league 11.8%** (amber/gold bar), **Top 4 74.2%** (emerald/teal bar), **Top 6 94%** (blue bar), **Top 10 99.3%** (purple bar), **Relegation 0%** (red bar, cut off in viewport but present)
- Footer caption: *"What your Overall 85 rating should produce. Simulate to see if you beat it."* — framed explicitly as a baseline/prediction to be beaten, not just flavor text.
- CTA: "Simulate Season →"

This maps almost 1:1 onto our `DraftPage.odds.test.ts` scenario (winPct/top4Pct/relegationPct/projectedFinish all derived from one continuous rank) — confirms that general shape (single projected-finish-driven distribution across multiple bars) is the right one; differences: they add "Top 6" and "Top 10" bands (we only track top4/relegation/win), and they use 5 distinct colors per band (gold/emerald/blue/purple/red) rather than one accent color — worth considering for visual differentiation.

## /game?new=true — Setup/Draft-config screen

Header persists across the whole app: ⌂ Home | 👤 Sign in (top right) — auth optional, guest play by default (same posture as our own app).

Title: "38-0" / "Draft your greatest all-time English top-flight XI"

### FORMATION (12 options, single-select, big rounded pill buttons, selected = mint-green outline+text)
4-3-3 (default, selected) | 4-4-2 | 4-2-3-1 | 4-5-1 | 3-4-3 | 3-5-2 | 5-4-1 | 4-1-2-1-2 | 4-4-1-1 | 5-3-2 | 3-4-1-2 | 4-2-2-2
- Each formation shows a one-line flavor caption below the grid when selected, e.g. 4-3-3: "Attacking with width. Three forwards create constant threat."
- More formations than our app currently supports (we should check apps/web/src/lib/formations.ts coverage vs this list — 12 formations here).
- Below formation grid: a positions list appears (GK, RB, CB, CB, LB, CM, CM, CM, RW, ST, LW for 4-3-3) — presumably preview of slots to fill.

### DIFFICULTY (3-way select)
- Easy — "3 rerolls available"
- Normal — "1 reroll available"
- Hard — "No rerolls · ratings hidden"  <- Hard mode combines zero rerolls AND blind ratings simultaneously (a single difficulty axis controls two mechanics at once). We treat rerolls and rating-visibility as separate independent settings; they've coupled them into one difficulty ladder.

### SHOW RATINGS (on/off toggle, separate from difficulty but Hard forces it off)
- On — "Player overalls visible"
- Off — "Blind mode: trust your gut"

### DRAFT MODE (2-way select) — direct analogue to our own two draft flows
- Squad First — "Spin a club, pick any player, choose their position" (this is exactly our current DraftPage flow: spin wheel -> club -> pick any eligible player -> assign to a slot)
- Position First — "Pick a slot, then spin for a club to fill it" (inverse order: choose the empty slot first, THEN spin — the spin/pool is presumably filtered/relevant to that slot). We do not have this mode — worth considering as a variant.

### PLAYER RATINGS (2-way select) — same concept & even same naming as our ratingsMode
- Season — "Players rated as they were that exact season" (== our "season" mode)
- Prime — "Every player at their career-best rating" (== our "prime" mode, exact same idea: swap in career-best row)

### ERA (4 quick-select buttons + a range control)
- All-time | 2000s+ | 2010s+ | Modern (2016+)
- Below that: "34 of 34 seasons" label with a range slider from "1992/93" to "2025/26" — i.e. a dual-handle year-range slider, not just discrete buttons. The quick buttons presumably just set the slider's lower bound. Caption: "Only club-seasons in this range can be spun, narrow it to draft from an era you know."
- This is more granular than our era filter — we don't currently expose a year-range slider in SetupPage, only fixed era/league selection.

### ADVANCED (toggles, off by default presumably)
- Managers (Gaffers) — "After the draft, appoint a gaffer for the story. Off = no manager." (matches our own post-draft manager roll feature)
- European Nights — "Finish in the top four and your XI plays on in Europe. Off = just the league." (matches our own Champions League/Europe feature — top-4 qualification framing, though ours qualifies top 8 of a scaled-down league via EuropeService.QUALIFIER_COUNT — theirs sounds like literal top-4 like real UCL qualification)
- January Transfer Window — "At halfway, gamble on one January event. It can help or hurt. No undo." <- WE DO NOT HAVE THIS. A mid-season random event/gamble mechanic. Worth exploring further once inside a season.

CTA: "Start Draft →"

Interactive elements on landing:
- link "Play 38-0" -> /game?new=true
- link "How it works" -> #how-to-play (anchor)
- link "Continue Draft" -> /game
- link -> /multiplayer
