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
import { isFormation } from "../lib/formations";
import { useDraft, type Difficulty, type DraftMode, type PlayerRatingsMode } from "../state/DraftContext";

interface SectionProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}

function Section({ title, children, right }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-ink-800 pb-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-smoke-600">{title}</h2>
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
    void api.listLeagues(config.eraId).then(setLeagues).catch(() => setLeagues([]));
  }, [config.eraId]);

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

      <Section title="League">
        <LeaguePicker
          leagues={leagues}
          selectedIds={config.leagueIds}
          onChange={(leagueIds) => setConfig({ leagueIds })}
        />
      </Section>

      <Section title="Formation">
        <FormationPicker
          value={config.formation}
          onChange={(formation) => isFormation(formation) && setConfig({ formation })}
        />
      </Section>

      <Section title="Difficulty">
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
      </Section>

      <Section title="Show Ratings">
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

      <Section title="Draft Mode">
        <SegmentedControl<DraftMode>
          accent="gold"
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

      <Section title="Player Ratings">
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

      <Section title="Era">
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
              accent="gold"
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
