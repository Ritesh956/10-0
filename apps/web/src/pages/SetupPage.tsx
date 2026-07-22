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
import { isRealCountry } from "../lib/leagues";
import { checkFormationFillable } from "../lib/oneClubValidation";
import { useDraft, type Difficulty, type DraftMode, type PlayerRatingsMode } from "../state/DraftContext";

type SectionAccent = "mint" | "teal" | "plum" | "crimson";

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
};

const SECTION_ACCENT_BORDER: Record<SectionAccent, string> = {
  mint: "border-mint-500/30",
  teal: "border-teal-500/30",
  plum: "border-plum-500/30",
  crimson: "border-crimson-500/30",
};

function Section({ title, children, right, accent = "mint" }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className={`flex items-center justify-between border-b pb-2 ${SECTION_ACCENT_BORDER[accent]}`}>
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
  const navigate = useNavigate();
  const { config, setConfig, resetDraft } = useDraft();

  const [eras, setEras] = useState<EraDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(true);

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
        if (config.leagueIds.length === 0 && real.length > 0) {
          const sorted = [...real].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
          setConfig({ leagueIds: [sorted[0]!.id] });
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
  const yearMin = activeEra?.startYear ?? 1992;
  const yearMax = activeEra?.endYear ?? new Date().getFullYear();

  if (loading) {
    return <p className="px-6 py-16 text-center text-smoke-500">Loading...</p>;
  }

  return (
    <>
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-paper">Set the Rules</h1>
        <p className="mt-2 text-sm text-smoke-500">Configure the draft before you pull a single name.</p>
      </div>

      {error && <p className="text-center text-sm text-crimson-400">{error}</p>}

      {config.multiplayerLeagueId ? (
        <Section title="League" accent="mint">
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
        <Section title="League" accent="mint">
          <LeaguePicker
            leagues={leagues}
            selectedIds={config.leagueIds}
            onChange={(leagueIds) => setConfig({ leagueIds })}
            singleSelect
          />
        </Section>
      )}

      <Section title="Formation" accent="teal">
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

      <Section title="Difficulty" accent="crimson">
        {config.multiplayerLeagueId ? (
          <p className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center text-xs text-smoke-500">
            Locked to <span className="font-semibold capitalize text-paper">{config.difficulty}</span> by this league&apos;s rules.
          </p>
        ) : (
          <SegmentedControl<Difficulty>
            accent="crimson"
            columns={3}
            value={config.difficulty}
            onChange={(difficulty) =>
              setConfig({ difficulty, showRatings: difficulty === "hard" ? false : config.showRatings })
            }
            options={[
              { value: "easy", label: "Easy", description: "3 redraws available" },
              { value: "normal", label: "Normal", description: "1 redraw available" },
              { value: "hard", label: "Hard", description: "No redraws · ratings hidden" },
            ]}
          />
        )}
      </Section>

      <Section title="Show Ratings" accent="plum">
        <SegmentedControl<"on" | "off">
          accent="plum"
          columns={2}
          value={config.showRatings ? "on" : "off"}
          onChange={(v) => setConfig({ showRatings: v === "on" })}
          options={[
            { value: "on", label: "On", description: "Player overalls visible" },
            { value: "off", label: "Off", description: "Blind mode: trust your gut" },
          ]}
        />
      </Section>

      <Section title="Draft Mode" accent="mint">
        <SegmentedControl<DraftMode>
          accent="mint"
          columns={2}
          value={config.draftMode}
          onChange={(draftMode) => setConfig({ draftMode })}
          options={[
            {
              value: "squad-first",
              label: "Squad First",
              description: "Draw a club, pick any player, choose their position",
            },
            {
              value: "position-first",
              label: "Position First",
              description: "Pick a slot, then draw a club to fill it",
            },
          ]}
        />
      </Section>

      {config.lockedClubId ? (
        <Section title="Player Ratings" accent="teal">
          <p className="notch-sm border border-ink-800 bg-ink-900/40 px-3 py-2 text-center text-xs text-smoke-500">
            Forced to <span className="font-semibold text-paper">Season</span> for One-Club XI — a career-best
            &quot;Prime&quot; row could belong to a different club.
          </p>
        </Section>
      ) : (
        <Section title="Player Ratings" accent="teal">
          <SegmentedControl<PlayerRatingsMode>
            accent="teal"
            columns={2}
            value={config.playerRatings}
            onChange={(playerRatings) => setConfig({ playerRatings })}
            options={[
              { value: "season", label: "Season", description: "Players rated as they were that exact season" },
              { value: "prime", label: "Prime", description: "Every player drafted at their career-best rating" },
            ]}
          />
        </Section>
      )}

      <Section title="Era" accent="plum">
        <div className="flex flex-wrap gap-2">
          {ERA_PRESETS.map((preset) => (
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
        />
        <p className="text-center text-xs text-ink-600">
          Only club-seasons in this range can be drawn — narrow it to draft from an era you know.
        </p>
      </Section>

      <Section
        title="Advanced"
        accent="crimson"
        right={
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-xs text-smoke-600 hover:text-smoke-400"
          >
            {advancedOpen ? "Hide" : "Show"}
          </button>
        }
      >
        {advancedOpen && (
          <div className="space-y-3">
            <Toggle
              accent="mint"
              label="Managers (Gaffers)"
              description="After the draft, appoint a gaffer for the story. Off = no manager."
              checked={config.managers}
              onChange={(managers) => setConfig({ managers })}
            />
            <Toggle
              accent="teal"
              label="European Nights"
              description="Finish in the top four and your XI plays on in Europe. Off = just the league."
              checked={config.europeanNights}
              onChange={(europeanNights) => setConfig({ europeanNights })}
            />
            <Toggle
              accent="crimson"
              label="January Transfer Window"
              description="At halfway, gamble on one January event. It can help or hurt. No undo."
              checked={config.januaryWindow}
              onChange={(januaryWindow) => setConfig({ januaryWindow })}
            />
          </div>
        )}
      </Section>

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
    <SiteFooter />
    </>
  );
}
