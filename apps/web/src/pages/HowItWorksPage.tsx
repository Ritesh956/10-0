import { useNavigate } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";

interface Step {
  title: string;
  body: string;
  accent: "mint" | "teal" | "plum" | "crimson";
}

const STEPS: Step[] = [
  {
    title: "1. Set the rules",
    body:
      "Pick a real league from the top-5 (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1), a formation, a difficulty (which sets your redraw budget), and whether you want managers, European Nights, and the January Transfer Window switched on.",
    accent: "mint",
  },
  {
    title: "2. Draw a name",
    body:
      "Spin the wheel to land on a random real club-season from that league's history — any year on file. Pick any player out of that exact squad, then choose which of your 11 shirts they take.",
    accent: "teal",
  },
  {
    title: "3. Fill the shirt",
    body:
      "Repeat until all 11 spots are taken. A player who doesn't fit anywhere left is marked unusable so you don't waste a pick; redraw a name if it isn't working out (redraw budget depends on difficulty).",
    accent: "plum",
  },
  {
    title: "4. Appoint a gaffer",
    body:
      "Once your XI is complete, optionally draw a real manager. Their tactical identity — mentality, tempo, width, pressing, passing style — genuinely changes how your team plays and what it's projected to achieve.",
    accent: "crimson",
  },
  {
    title: "5. Kick off",
    body:
      "Simulate a full league season, minute-by-minute, against a league-accurate AI-filled division. Watch results roll in as a live feed, then dig into the standings, top scorers, and your full match log.",
    accent: "mint",
  },
  {
    title: "6. Survive January",
    body:
      "At the halfway point, gamble on a January transfer event for your weakest starter — it can upgrade or downgrade the shirt, no undo. Then the back half of the season plays out with whoever's left in that slot.",
    accent: "teal",
  },
  {
    title: "7. Chase Europe",
    body:
      "Finish in the top 4 and your XI carries on into a scaled-down Champions League: a league phase, then quarter-final, semi-final, and a single neutral-venue final.",
    accent: "plum",
  },
  {
    title: "8. Chase the unbeaten record",
    body:
      "Go the whole season without losing and you earn Unbeaten. Win every single match — the true 38-0 record — and you earn the rarer Invincible trophy instead. Trophies, records, and your world's history persist to your account.",
    accent: "crimson",
  },
];

const ACCENT: Record<Step["accent"], { border: string; bg: string; text: string }> = {
  mint: { border: "border-mint-500/40", bg: "bg-mint-500/10", text: "text-mint-400" },
  teal: { border: "border-teal-500/40", bg: "bg-teal-500/10", text: "text-teal-400" },
  plum: { border: "border-plum-500/40", bg: "bg-plum-500/10", text: "text-plum-400" },
  crimson: { border: "border-crimson-500/40", bg: "bg-crimson-500/10", text: "text-crimson-400" },
};

export function HowItWorksPage() {
  const navigate = useNavigate();

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-16">
        <div className="text-center">
          <span className="notch-sm inline-flex items-center gap-2 border-2 border-mint-500/30 bg-mint-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
            How it works
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-tight tracking-tight text-paper">
            One draw at a time,
            <br />
            one whole season on the line.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-smoke-500">
            Futbol builds a fantasy XI out of real club-seasons from the top-5 European leagues, then simulates a
            full campaign to see how far it gets. Here's exactly what happens, start to finish.
          </p>
        </div>

        <ol className="space-y-3">
          {STEPS.map((step) => {
            const a = ACCENT[step.accent];
            return (
              <li key={step.title} className={`notch border ${a.border} bg-ink-900/40 p-5`}>
                <p className={`font-display text-sm font-bold uppercase tracking-wide ${a.text}`}>{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-smoke-400">{step.body}</p>
              </li>
            );
          })}
        </ol>

        <div className="text-center">
          <Button size="lg" onClick={() => navigate("/setup")}>
            Start a draft &rarr;
          </Button>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
