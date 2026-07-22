import { SiteFooter } from "../components/SiteFooter";

interface Topic {
  title: string;
  points: string[];
}

const TOPICS: Topic[] = [
  {
    title: "Formations & positions",
    points: [
      "12 formations are selectable, from 4-4-2 to 4-1-2-1-2 and 4-2-2-2 — each defines 11 pitch slots with a required position per slot.",
      "Real positional versatility is modeled: a CAM can also cover ST, a CB can cover full-back, and so on. A player only needs to fit one open slot to stay usable.",
      "Position-first draft mode lets you pick a slot before drawing, instead of drawing a squad and choosing where a player goes.",
    ],
  },
  {
    title: "Difficulty & redraws",
    points: [
      "Easy gives you 3 redraws, Normal gives you 1, Hard gives you none and hides player overalls entirely — blind drafting, trust your gut.",
      "A drawn club with nobody eligible for your remaining slots auto-rerolls for free, up to a small cap — you're never truly stuck.",
    ],
  },
  {
    title: "Season vs Prime ratings",
    points: [
      "Season mode rates every player exactly as they were in the drawn season — a 2015 squad member plays like it's 2015.",
      "Prime mode swaps in each player's career-best season's rating and attributes, while keeping the drawn club-season as context — you still \"found\" them there, but you draft the peak version of who they are.",
    ],
  },
  {
    title: "Managers & tactics",
    points: [
      "After the draft, optionally spin for a real manager. Their mentality, tempo, width, pressing, and passing style all have genuine mechanical effect on how your team performs.",
      "Decline and your club plays with a balanced default tactical profile instead — no manager, no penalty, just less flavor.",
    ],
  },
  {
    title: "The January Transfer Window",
    points: [
      "At the halfway point of the season, gamble on one transfer event for your weakest starting slot — a weighted roll between an upgrade, a lateral swap, and a downgrade.",
      "There's no undo. The back half of your season plays out with whoever ends up in that shirt.",
    ],
  },
  {
    title: "European Nights",
    points: [
      "Finish in the top 4 of your domestic league and your XI qualifies for a scaled-down Champions League: an 8-team league phase, then quarter-final, semi-final, and a single-match neutral-venue final.",
      "Turn it off in Setup and your world stays a pure single-league campaign.",
    ],
  },
  {
    title: "Trophies, awards & records",
    points: [
      "Go unbeaten for Unbeaten, or win every match for the rarer Invincible. Win the league for Champions.",
      "Golden Boot, Playmaker (top assists), Golden Glove, and MVP are awarded live off real match data — your own club's players compete for them alongside every AI club.",
      "Every finished run persists to your account: trophies, competition records, and full world history.",
    ],
  },
];

export function HowToPlayPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16">
        <div className="text-center">
          <span className="notch-sm inline-flex items-center gap-2 border-2 border-teal-500/30 bg-teal-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
            How to play
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-tight tracking-tight text-paper">
            The rules, mechanic by mechanic.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-smoke-500">
            Everything that shapes a run — how the draft works, what each toggle does, and what you're actually
            chasing.
          </p>
        </div>

        <div className="space-y-4">
          {TOPICS.map((topic, i) => {
            const tint = [
              { border: "border-mint-500/20", bg: "bg-mint-500/5" },
              { border: "border-teal-500/20", bg: "bg-teal-500/5" },
              { border: "border-plum-500/20", bg: "bg-plum-500/5" },
              { border: "border-crimson-500/20", bg: "bg-crimson-500/5" },
            ][i % 4]!;
            return (
              <section key={topic.title} className={`notch border-2 ${tint.border} ${tint.bg} p-5`}>
                <h2 className="font-display text-sm font-bold uppercase tracking-widest text-paper">{topic.title}</h2>
                <ul className="mt-3 space-y-2">
                  {topic.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm leading-relaxed text-smoke-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-smoke-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
