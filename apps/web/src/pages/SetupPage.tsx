import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { EraDto, LeagueDto } from "../api/types";
import { LeaguePicker } from "../components/LeaguePicker";
import { FormationPicker } from "../components/FormationPicker";
import { Button } from "../components/ui/Button";
import { RangeSlider } from "../components/ui/RangeSlider";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { Toggle } from "../components/ui/Toggle";
import { Chip } from "../components/ui/Chip";
import { SiteFooter } from "../components/SiteFooter";
import { isFormation, positionLabel } from "../lib/formations";
import { isRealCountry, playLeagueIdOf } from "../lib/leagues";
import { checkFormationFillable } from "../lib/oneClubValidation";
import { useDraft, type Difficulty, type DraftMode, type PlayerRatingsMode } from "../state/DraftContext";
import { formatSeason } from "../lib/season";
import { useT } from "../lib/i18n/context";

type SectionAccent = "mint" | "teal" | "plum" | "crimson" | "amber";

interface SectionProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  /** Ties each section header back to the accent color its own control below it already uses
      (e.g. Difficulty's SegmentedControl is crimson) — previously every section header was the
      same flat gray, which made a long settings page read as one undifferentiated wall. */
  accent?: SectionAccent;
}

const SECTION_ACCENT_DOT: Record<SectionAccent, string> = {
  mint: "bg-mint-400",
  teal: "bg-teal-400",
  plum: "bg-plum-400",
  crimson: "bg-crimson-400",
  amber: "bg-amber-400",
};

const SECTION_ACCENT_BORDER: Record<SectionAccent, string> = {
  mint: "border-mint-500/30",
  teal: "border-teal-500/30",
  plum: "border-plum-500/30",
  crimson: "border-crimson-500/30",
  amber: "border-amber-500/30",
};

function Section({ title, children, right, accent = "mint" }: SectionProps) {
  return (
    <section className="space-y-2.5">
      <div className={`flex items-center justify-between border-b pb-1.5 ${SECTION_ACCENT_BORDER[accent]}`}>
        <h2 className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-smoke-500">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SECTION_ACCENT_DOT[accent]}`} />
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const ERA_PRESETS: Array<{ label: string; startYear: number }> = [
  { label: "All-time", startYear: 0 },
  { label: "2000s+", startYear: 2000 },
  { label: "2010s+", startYear: 2010 },
  { label: "Modern (2016+)", startYear: 2016 },
];

export function SetupPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { config, setConfig, resetDraft } = useDraft();

  const [eras, setEras] = useState<EraDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Collapsed by default with a one-line summary: these three are on for almost everyone.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eraList = await api.listEras();
        if (cancelled) return;
        setEras(eraList);
        const era = eraList[0];
        if (era) {
          setConfig({
            eraId: config.eraId || era.id,
            eraYearMin: config.eraYearMin ?? era.startYear,
            eraYearMax: config.eraYearMax ?? era.endYear,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load eras");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!config.eraId) return;
    void api
      .listLeagues(config.eraId)
      .then((list) => {
        const real = list.filter((l) => isRealCountry(l.country));
        setLeagues(real);
        // A specific league is required now (no "All Leagues") — AI-fill builds the season out of
        // that league's own current clubs, so default to the first one rather than leave it unset.
        // Default to the Premier League (the most familiar starting point) rather than whatever
        // sorts first alphabetically — that used to make the Bundesliga everyone's default.
        if (config.leagueIds.length === 0 && real.length > 0) {
          const sorted = [...real].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
          const preferred = sorted.find((l) => l.name === "Premier League") ?? sorted[0]!;
          setConfig({ leagueIds: [preferred.id] });
        }
      })
      .catch(() => setLeagues([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.eraId]);

  // One-Club XI (Phase 7): a cheap feasibility check for "can this formation actually be filled
  // from this club's real history" — null while unlocked or still loading, so the CTA only ever
  // gets disabled once we actually know the answer, not by default.
  const [clubPositions, setClubPositions] = useState<string[] | null>(null);
  useEffect(() => {
    if (!config.lockedClubId) {
      setClubPositions(null);
      return;
    }
    let cancelled = false;
    setClubPositions(null);
    void api
      .getClubPositionCoverage(config.lockedClubId, config.eraId)
      .then((positions) => {
        if (!cancelled) setClubPositions(positions);
      })
      .catch(() => {
        if (!cancelled) setClubPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [config.lockedClubId, config.eraId]);

  const checkingFit = Boolean(config.lockedClubId) && clubPositions === null;
  const fillability = config.lockedClubId && clubPositions ? checkFormationFillable(config.formation, clubPositions) : null;

  const activeEra = eras.find((e) => e.id === config.eraId);
  // Bound the era slider by the seasons the chosen league(s) really have, not the era's nominal
  // range — otherwise most of the slider (1992–2011) selects nothing at all.
  const selectedLeagues = leagues.filter((l) => config.leagueIds.includes(l.id));
  const spanMins = selectedLeagues.map((l) => l.minSeasonYear).filter((y): y is number => typeof y === "number");
  const spanMaxes = selectedLeagues.map((l) => l.maxSeasonYear).filter((y): y is number => typeof y === "number");
  const yearMin = spanMins.length ? Math.min(...spanMins) : (activeEra?.startYear ?? 1992);
  const yearMax = spanMaxes.length ? Math.max(...spanMaxes) : (activeEra?.endYear ?? new Date().getFullYear());

  // Keep the chosen range inside the bounds whenever they change (league switch, data loading).
  useEffect(() => {
    const curMin = config.eraYearMin ?? yearMin;
    const curMax = config.eraYearMax ?? yearMax;
    let nextMin = Math.min(Math.max(curMin, yearMin), yearMax);
    let nextMax = Math.min(Math.max(curMax, yearMin), yearMax);
    if (nextMin > nextMax) [nextMin, nextMax] = [yearMin, yearMax];
    if (nextMin !== config.eraYearMin || nextMax !== config.eraYearMax) {
      setConfig({ eraYearMin: nextMin, eraYearMax: nextMax });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMin, yearMax]);

  if (loading) {
    return <p className="px-6 py-16 text-center text-smoke-500">Loading...</p>;
  }

  return (
    <>
    <div className="mx-auto max-w-2xl space-y-7 px-4 pb-4 pt-8 sm:px-6 sm:pt-10">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper sm:text-3xl">{t("setup.title")}</h1>
        <p className="mt-1 text-sm text-smoke-500">{t("setup.sub")}</p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {config.multiplayerLeagueId ? (
        <Section title={t("setup.league")} accent="mint">
          <div className="notch flex flex-wrap items-center justify-between gap-3 border border-mint-500/30 bg-mint-500/5 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-smoke-600">Multiplayer League</p>
              <p className="font-display text-lg font-bold text-paper">{config.multiplayerLeagueName}</p>
              <p className="mt-1 text-xs text-smoke-500">Era, real league(s), and difficulty are locked so every member drafts under the same rules.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig({
                  multiplayerLeagueId: undefined,
                  multiplayerLeagueName: undefined,
                  multiplayerFormationLocked: undefined,
                })
              }
              className="shrink-0 text-xs text-smoke-500 underline hover:text-smoke-400"
            >
              Leave this league draft
            </button>
          </div>
        </Section>
      ) : config.lockedClubId ? (
        <Section title="Club" accent="mint">
          <div className="notch flex flex-wrap items-center justify-between gap-3 border border-mint-500/30 bg-mint-500/5 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-smoke-600">One-Club XI</p>
              <p className="font-display text-lg font-bold text-paper">{config.lockedClubName}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              <button type="button" onClick={() => navigate("/clubs")} className="text-mint-400 underline">
                Pick a different club
              </button>
              <button
                type="button"
                onClick={() => setConfig({ lockedClubId: undefined, lockedClubName: undefined })}
                className="text-smoke-500 underline hover:text-smoke-400"
              >
                Draft a full league instead
              </button>
            </div>
          </div>
        </Section>
      ) : config.lockedNationality ? (
        <Section title="Nation" accent="plum">
          <div className="notch flex flex-wrap items-center justify-between gap-3 border border-plum-500/30 bg-plum-500/5 p-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-smoke-600">Nations Trophy</p>
              <p className="font-display text-lg font-bold text-paper">{config.lockedNationality}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs">
              <button type="button" onClick={() => navigate("/nations")} className="text-plum-400 underline">
                Pick a different nation
              </button>
              <button
                type="button"
                onClick={() => setConfig({ lockedNationality: undefined })}
                className="text-smoke-500 underline hover:text-smoke-400"
              >
                Draft a full league instead
              </button>
            </div>
          </div>
        </Section>
      ) : (
        <Section title={t("setup.league")} accent="mint">
          <LeaguePicker
            leagues={leagues}
            selectedIds={[playLeagueIdOf(config)].filter((id): id is string => Boolean(id))}
            onChange={(ids) =>
              config.draftPool === "all"
                ? setConfig({ playLeagueId: ids[0] })
                : setConfig({ leagueIds: ids, playLeagueId: undefined })
            }
            singleSelect
          />
          <div className="mt-3 space-y-1.5">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-smoke-500">{t("setup.draftFrom")}</p>
            <SegmentedControl<"league" | "all">
              accent="mint"
              columns={2}
              value={config.draftPool ?? "league"}
              onChange={(pool) =>
                pool === "all"
                  ? setConfig({ draftPool: "all", leagueIds: leagues.map((l) => l.id), playLeagueId: playLeagueIdOf(config) })
                  : setConfig({ draftPool: "league", leagueIds: [playLeagueIdOf(config) ?? leagues[0]?.id].filter((id): id is string => Boolean(id)), playLeagueId: undefined })
              }
              options={[
                { value: "league", label: t("setup.thisLeague"), description: t("setup.thisLeagueDesc") },
                {
                  value: "all",
                  label: t("setup.allTop5"),
                  description: t("setup.allTop5Desc"),
                },
              ]}
            />
          </div>
        </Section>
      )}

      <Section title={t("setup.formation")} accent="teal">
        {config.multiplayerFormationLocked ? (
          <p className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center text-xs text-smoke-500">
            Formation locked to <span className="font-semibold text-paper">{config.formation}</span> by this league&apos;s rules.
          </p>
        ) : (
          <FormationPicker
            value={config.formation}
            onChange={(formation) => isFormation(formation) && setConfig({ formation })}
          />
        )}
        {config.lockedClubId && fillability && !fillability.fillable && (
          <p className="notch-sm border border-crimson-500/40 bg-crimson-500/10 p-3 text-center text-xs text-crimson-300">
            {config.lockedClubName}&apos;s recorded history has nobody who can play{" "}
            {fillability.missingPositions.map((p) => positionLabel(p)).join(", ")} — try a different formation.
          </p>
        )}
        {checkingFit && <p className="text-center text-xs text-smoke-600">Checking this club&apos;s history fits this formation...</p>}
      </Section>

      <Section title={t("setup.difficulty")} accent="amber">
        {config.multiplayerLeagueId ? (
          <p className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center text-xs text-smoke-500">
            Locked to <span className="font-semibold capitalize text-paper">{config.difficulty}</span> by this league&apos;s rules.
          </p>
        ) : (
          <SegmentedControl<Difficulty>
            accent="amber"
            columns={3}
            value={config.difficulty}
            onChange={(difficulty) =>
              setConfig({ difficulty, showRatings: difficulty === "hard" ? false : config.showRatings })
            }
            options={[
              { value: "easy", label: t("setup.easy"), description: t("setup.easyDesc") },
              { value: "normal", label: t("setup.normal"), description: t("setup.normalDesc") },
              { value: "hard", label: t("setup.hard"), description: t("setup.hardDesc") },
            ]}
          />
        )}
      </Section>

      <div className="grid gap-7 sm:grid-cols-2 sm:gap-5">
      <Section title={t("setup.showRatings")} accent="plum">
        <SegmentedControl<"on" | "off">
          accent="plum"
          columns={2}
          value={config.showRatings ? "on" : "off"}
          onChange={(v) => setConfig({ showRatings: v === "on" })}
          options={[
            { value: "on", label: t("setup.on"), description: t("setup.ratingsOnDesc") },
            { value: "off", label: t("setup.off"), description: t("setup.ratingsOffDesc") },
          ]}
        />
      </Section>

      <Section title={t("setup.draftMode")} accent="mint">
        <SegmentedControl<DraftMode>
          accent="mint"
          columns={2}
          value={config.draftMode}
          onChange={(draftMode) => setConfig({ draftMode })}
          options={[
            {
              value: "squad-first",
              label: t("setup.squadFirst"),
              description: t("setup.squadFirstDesc"),
            },
            {
              value: "position-first",
              label: t("setup.positionFirst"),
              description: t("setup.positionFirstDesc"),
            },
          ]}
        />
      </Section>

      {config.lockedClubId ? (
        <Section title={t("setup.playerRatings")} accent="teal">
          <p className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center text-xs text-smoke-500">
            Forced to <span className="font-semibold text-paper">Season</span> for One-Club XI — a career-best
            &quot;Prime&quot; row could belong to a different club.
          </p>
        </Section>
      ) : (
        <Section title={t("setup.playerRatings")} accent="teal">
          <SegmentedControl<PlayerRatingsMode>
            accent="teal"
            columns={2}
            value={config.playerRatings}
            onChange={(playerRatings) => setConfig({ playerRatings })}
            options={[
              { value: "prime", label: t("setup.prime"), description: t("setup.primeDesc") },
              { value: "season", label: t("setup.season"), description: t("setup.seasonDesc") },
            ]}
          />
        </Section>
      )}

      </div>

      <Section title={t("setup.era")} accent="plum">
        <div className="flex flex-wrap gap-2">
          {/* Skip presets that start at/before the league's first season — on a 2012+ dataset
              "2000s+" and "2010s+" are just "All-time" again, and all three lit up at once. */}
          {ERA_PRESETS.filter((preset) => preset.startYear === 0 || preset.startYear > yearMin).map((preset) => (
            <Chip
              key={preset.label}
              active={config.eraYearMin === Math.max(preset.startYear, yearMin) && config.eraYearMax === yearMax}
              onClick={() => setConfig({ eraYearMin: Math.max(preset.startYear, yearMin), eraYearMax: yearMax })}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
        <RangeSlider
          min={yearMin}
          max={yearMax}
          valueMin={config.eraYearMin ?? yearMin}
          valueMax={config.eraYearMax ?? yearMax}
          onChange={(min, max) => setConfig({ eraYearMin: min, eraYearMax: max })}
          formatLabel={formatSeason}
        />
        <p className="text-center text-xs text-smoke-500">
          {t("setup.seasonsOf", { n: (config.eraYearMax ?? yearMax) - (config.eraYearMin ?? yearMin) + 1, total: yearMax - yearMin + 1 })}
        </p>
        <p className="text-center text-xs text-ink-600">
          Only club-seasons in this range can be drawn — narrow it to draft from an era you know.
        </p>
      </Section>

      <Section
        title={t("setup.advanced")}
        accent="teal"
        right={
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-xs text-smoke-500 hover:text-paper"
          >
            {advancedOpen ? t("setup.hide") : t("setup.change")}
          </button>
        }
      >
        {!advancedOpen && (
          <p className="text-xs text-smoke-500">
            Managers {config.managers ? "on" : "off"} · European Nights {config.europeanNights ? "on" : "off"} · January window{" "}
            {config.januaryWindow ? "on" : "off"}
          </p>
        )}
        {advancedOpen && (
          <div className="space-y-3">
            <Toggle
              accent="mint"
              label={t("setup.managers")}
              description={t("setup.managersDesc")}
              checked={config.managers}
              onChange={(managers) => setConfig({ managers })}
            />
            <Toggle
              accent="teal"
              label={t("setup.europe")}
              description={t("setup.europeDesc")}
              checked={config.europeanNights}
              onChange={(europeanNights) => setConfig({ europeanNights })}
            />
            <Toggle
              accent="amber"
              label={t("setup.january")}
              description={t("setup.januaryDesc")}
              checked={config.januaryWindow}
              onChange={(januaryWindow) => setConfig({ januaryWindow })}
            />
          </div>
        )}
      </Section>

      {/* Sticky on phones so the primary action is always one tap away, wherever you are. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-ink-800 bg-ink-950/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button
          size="lg"
          fullWidth
          disabled={checkingFit || (fillability !== null && !fillability.fillable)}
          onClick={() => {
            resetDraft();
            navigate("/draft");
          }}
        >
          Enter the Draft Room &rarr;
        </Button>
      </div>
    </div>
    <SiteFooter />
    </>
  );
}
