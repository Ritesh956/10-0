import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { CabinetEntryDto, ProfileDto, ProfileRunDto, TrophyCategory, TrophyKey } from "../api/types";
import { CountryFlag } from "../components/CountryFlag";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { useAuth } from "../lib/auth-context";
import { leagueCountry, leagueLabel } from "../lib/leagues";
import { formatRunDate, ordinal, sortCabinet, weeklyTrophy, type CabinetSort } from "../lib/profile";
import { hasStatsHubCache } from "../lib/statsHubCache";
import { CATEGORY_LABELS, TIER_META, TROPHY_CATALOG } from "../lib/trophies";
import { useDraft } from "../state/DraftContext";

const CATEGORY_ORDER: TrophyCategory[] = ["season", "awards", "squad", "career", "europe", "modes", "fun"];

const CATALOGUE_ORDER = Object.keys(TROPHY_CATALOG) as TrophyKey[];

const SORT_LABELS: Record<CabinetSort, string> = {
  catalogue: "Catalogue",
  rarest: "Rarest first",
  earned: "Earned first",
};

const MODE_LABELS: Record<ProfileRunDto["mode"], string | null> = {
  solo: null,
  "one-club": "One-Club",
  nations: "Nations",
  league: "League",
};

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="notch border border-ink-800 bg-ink-900/50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-smoke-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-paper">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-smoke-500">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-paper">{children}</h2>
      {aside && <span className="text-xs text-smoke-500">{aside}</span>}
    </div>
  );
}

function TrophyCard({ entry }: { entry: CabinetEntryDto }) {
  const meta = TROPHY_CATALOG[entry.key];
  const tier = TIER_META[entry.tier];
  const earned = entry.count > 0;
  return (
    <div
      className={`notch flex flex-col gap-1 border p-3 ${
        earned ? `bg-ink-900/60 ${meta.colorClass}` : "border-ink-800 bg-ink-950/40"
      }`}
      data-testid={`trophy-${entry.key}`}
      data-earned={earned}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-2xl ${earned ? "" : "opacity-40 grayscale"}`} aria-hidden>
          {meta.icon}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${tier.className}`}>
          {tier.label}
          {entry.count > 1 && <span className="ml-1 text-paper">×{entry.count}</span>}
        </span>
      </div>
      <p className={`font-display text-sm font-bold uppercase tracking-wide ${earned ? "text-paper" : "text-smoke-400"}`}>
        {meta.name}
      </p>
      <p className="text-xs leading-snug text-smoke-500">{meta.description}</p>
      {!earned && entry.progress && (
        <div className="mt-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-mint-500"
              style={{ width: `${Math.round((entry.progress.current / entry.progress.target) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-smoke-500">
            {entry.progress.current} / {entry.progress.target}
          </p>
        </div>
      )}
      <p className="mt-auto pt-1 text-[11px] text-smoke-600">
        {entry.rarityPct === null ? "" : `${entry.rarityPct}% of players`}
        {earned && entry.firstEarnedAt && ` · since ${formatRunDate(entry.firstEarnedAt)}`}
      </p>
    </div>
  );
}

function RunRow({ run, onOpen }: { run: ProfileRunDto; onOpen?: (() => void) | undefined }) {
  const country = leagueCountry(run.leagueId ?? undefined);
  const mode = MODE_LABELS[run.mode];
  const record = run.won !== null && run.drawn !== null && run.lost !== null ? `${run.won}-${run.drawn}-${run.lost}` : null;
  return (
    <div className="notch flex flex-wrap items-center gap-x-4 gap-y-2 border border-ink-800 bg-ink-900/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-display font-bold text-paper">
          <CountryFlag country={country} />
          <span className="truncate">{run.clubName ?? "Unnamed XI"}</span>
          {mode && (
            <span className="notch-sm border border-plum-500/40 px-1.5 py-0.5 text-[10px] uppercase text-plum-300">{mode}</span>
          )}
        </p>
        <p className="text-xs text-smoke-500">
          {[leagueLabel(run.leagueId ?? undefined), run.formation, formatRunDate(run.createdAt)].filter(Boolean).join(" · ")}
        </p>
      </div>
      {run.finished ? (
        <div className="flex items-center gap-4 text-right">
          {run.position !== null && (
            <div>
              <p className="font-display text-lg font-bold text-paper">{ordinal(run.position)}</p>
              {run.leagueSize !== null && <p className="text-[11px] text-smoke-500">of {run.leagueSize}</p>}
            </div>
          )}
          {record && (
            <div>
              <p className="font-display text-lg font-bold text-paper">{record}</p>
              <p className="text-[11px] text-smoke-500">W-D-L</p>
            </div>
          )}
          <div>
            <p className="font-display text-lg font-bold text-mint-400">{run.points}</p>
            <p className="text-[11px] text-smoke-500">pts</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-smoke-500">In progress</p>
      )}
      {(run.trophies.length > 0 || onOpen) && (
        <div className="flex w-full items-center justify-between gap-2">
          <p className="flex flex-wrap gap-1 text-lg" aria-label="Trophies">
            {[...run.trophies].sort((a, b) => CATALOGUE_ORDER.indexOf(a) - CATALOGUE_ORDER.indexOf(b)).map((key) => (
              <span key={key} title={TROPHY_CATALOG[key]?.name ?? key}>
                {TROPHY_CATALOG[key]?.icon ?? "🏆"}
              </span>
            ))}
          </p>
          {onOpen && (
            <button onClick={onOpen} className="shrink-0 text-xs font-semibold uppercase tracking-wide text-mint-400 hover:text-mint-300">
              View season →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Career stats, streaks, the trophy cabinet (earned and locked) and every run — the retention
    page 38-0 calls /profile. Replaced the old /history list. */
export function ProfilePage() {
  const { isAuthenticated } = useAuth();
  const { setWorldId } = useDraft();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<TrophyCategory | "all">("all");
  const [sort, setSort] = useState<CabinetSort>("catalogue");

  useEffect(() => {
    if (!isAuthenticated) return;
    void api
      .getProfile()
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load your profile"));
  }, [isAuthenticated]);

  const cabinet = useMemo(() => {
    if (!profile) return [];
    const filtered = category === "all" ? profile.cabinet : profile.cabinet.filter((c) => c.category === category);
    return sortCabinet(filtered, sort);
  }, [profile, category, sort]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Your profile</h1>
        <p className="text-sm text-smoke-400">
          Finish a season and your stats, streaks and trophy cabinet start here.
        </p>
        <Link to="/setup">
          <Button>Start a run</Button>
        </Link>
      </div>
    );
  }

  if (error) return <p className="px-4 py-16 text-center text-sm text-crimson-400">{error}</p>;
  if (!profile) return <p className="px-4 py-16 text-center text-sm text-smoke-500">Loading your profile…</p>;

  const { stats, streaks, user } = profile;
  const earnedCount = profile.cabinet.filter((c) => c.count > 0).length;
  const highlight = weeklyTrophy(profile.cabinet, new Date());
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
  const streakSub = (best: number) => `best ${best}`;

  function openRun(worldId: string) {
    setWorldId(worldId);
    navigate("/season");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">{user.displayName}</h1>
          <p className="text-sm text-smoke-500">
            {user.isGuest ? "Guest" : "Member"} since {formatRunDate(user.memberSince)} · {earnedCount} of{" "}
            {profile.cabinet.length} trophies
          </p>
        </div>
      </header>

      {stats.seasonsStarted === 0 ? (
        <div className="notch space-y-3 border border-ink-800 bg-ink-900/50 p-6 text-center">
          <p className="text-sm text-smoke-400">No seasons yet. Your first finished run starts the cabinet.</p>
          <Link to="/setup">
            <Button>Start a run</Button>
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle aside={`${stats.seasonsFinished} finished · ${stats.seasonsStarted} started`}>Career</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Titles" value={stats.titles} sub={`${stats.topFours} top-four finishes`} />
              <StatTile label="Win rate" value={pct(stats.winRate)} sub={`${stats.matchesPlayed} matches`} />
              <StatTile
                label="Best points"
                value={stats.bestPoints?.value ?? "—"}
                sub={stats.bestPoints?.clubName ?? undefined}
              />
              <StatTile
                label="Best record"
                value={stats.bestRecord ? `${stats.bestRecord.won}-${stats.bestRecord.drawn}-${stats.bestRecord.lost}` : "—"}
                sub={stats.bestRecord?.clubName ?? undefined}
              />
              <StatTile
                label="Top-rated XI"
                value={stats.topRatedXi?.value ?? "—"}
                sub={stats.topRatedXi?.clubName ?? undefined}
              />
              <StatTile
                label="Average finish"
                value={stats.averageFinish === null ? "—" : stats.averageFinish.toFixed(1)}
              />
              <StatTile label="Goals scored" value={stats.goalsScored} />
              <StatTile label="Best win streak" value={stats.bestWinStreak ?? "—"} sub="in one season" />
              <StatTile label="Favourite formation" value={stats.favouriteFormation ?? "—"} />
              <StatTile
                label="Favourite league"
                value={
                  stats.favouriteLeagueId ? (
                    <span className="flex items-center gap-2 text-base">
                      <CountryFlag country={leagueCountry(stats.favouriteLeagueId)} />
                      {leagueLabel(stats.favouriteLeagueId) || "—"}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <StatTile label="Unbeaten seasons" value={stats.unbeatenSeasons} sub={`${stats.invincibles} invincible`} />
              <StatTile label="European titles" value={stats.europeanTitles} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Streaks</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Title run" value={streaks.titles.current} sub={streakSub(streaks.titles.best)} />
              <StatTile label="Unbeaten run" value={streaks.unbeaten.current} sub={streakSub(streaks.unbeaten.best)} />
              <StatTile label="On the up" value={streaks.onTheUp.current} sub={streakSub(streaks.onTheUp.best)} />
              <StatTile
                label="Days played"
                value={streaks.days.current}
                sub={streakSub(streaks.days.best)}
              />
            </div>
            {profile.daily.played > 0 && (
              <p className="text-xs text-smoke-500">
                Daily Challenge: {profile.daily.played} played · {profile.daily.perfect} perfect · best score{" "}
                {profile.daily.bestScore}
              </p>
            )}
          </section>
        </>
      )}

      {highlight && (
        <section className="notch flex flex-wrap items-center gap-4 border border-amber-400/40 bg-amber-500/5 p-4">
          <span className="text-3xl" aria-hidden>
            {TROPHY_CATALOG[highlight.key].icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Trophy of the week</p>
            <p className="font-display font-bold uppercase text-paper">{TROPHY_CATALOG[highlight.key].name}</p>
            <p className="text-xs text-smoke-400">{TROPHY_CATALOG[highlight.key].description}</p>
          </div>
          <Link to="/setup">
            <Button size="sm">Start a run</Button>
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle aside={`${earnedCount} / ${profile.cabinet.length}`}>Trophy cabinet</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-smoke-500">
          <span>Sort:</span>
          {(Object.keys(SORT_LABELS) as CabinetSort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`uppercase tracking-wide ${sort === s ? "text-mint-400" : "hover:text-paper"}`}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cabinet.map((entry) => (
            <TrophyCard key={entry.key} entry={entry} />
          ))}
        </div>
      </section>

      {profile.runs.length > 0 && (
        <section className="space-y-3">
          <SectionTitle aside={`${profile.runs.length}`}>Your seasons</SectionTitle>
          <div className="space-y-2">
            {profile.runs.map((run) => (
              <RunRow
                key={run.worldId}
                run={run}
                onOpen={run.finished && hasStatsHubCache(run.worldId) ? () => openRun(run.worldId) : undefined}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
