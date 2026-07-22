import { SiteFooter } from "../components/SiteFooter";

interface Legend {
  name: string;
  position: string;
  club: string;
  note: string;
}

/** Our own editorial shortlist (38-0 §5's "Greatest XI" static page), scoped to the same top-5,
    2012-2024 window our real dataset covers — factual names/positions/clubs, our own opinionated
    picks, not sourced from or endorsed by any official body (see SiteFooter's standing disclaimer). */
const LEGENDS: Legend[] = [
  { name: "Manuel Neuer", position: "GK", club: "Bayern Munich", note: "Redefined the sweeper-keeper role for a generation." },
  { name: "Dani Alves", position: "RB", club: "Barcelona", note: "The most decorated full-back of the era, box to box." },
  { name: "Sergio Ramos", position: "CB", club: "Real Madrid", note: "Big-game goals from centre-back, and no shortage of nerve." },
  { name: "Virgil van Dijk", position: "CB", club: "Liverpool", note: "Turned a leaky Liverpool defence into a title-winning wall." },
  { name: "Marcelo", position: "LB", club: "Real Madrid", note: "Attacking full-back play at its most joyful." },
  { name: "N'Golo Kanté", position: "CDM", club: "Leicester City / Chelsea", note: "Won the league with two different clubs in consecutive seasons." },
  { name: "Kevin De Bruyne", position: "CM", club: "Manchester City", note: "The era's most complete creative midfielder." },
  { name: "Luka Modrić", position: "CM", club: "Real Madrid", note: "Metronomic control through the biggest Champions League run of the decade." },
  { name: "Lionel Messi", position: "RW", club: "Barcelona", note: "Four Ballons d'Or inside this window alone." },
  { name: "Robert Lewandowski", position: "ST", club: "Bayern Munich / Borussia Dortmund", note: "The most reliably lethal number 9 in the top-5." },
  { name: "Cristiano Ronaldo", position: "LW", club: "Real Madrid", note: "Three straight Champions League titles, goals in every one." },
];

export function BestXiPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16">
        <div className="text-center">
          <span className="notch-sm inline-flex items-center gap-2 border-2 border-plum-500/30 bg-plum-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
            The archive&apos;s best XI
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-tight tracking-tight text-paper">
            Our greatest top-5 XI, 2012&ndash;2024.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-smoke-500">
            Every one of these names is in the draft pool right now, at the club-seasons that made them legends. Our
            own editorial shortlist, not an official ranking — see what you can draw and build around.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {LEGENDS.map((legend, i) => {
            const tint = [
              { border: "border-mint-500/25", bg: "bg-mint-500/5", text: "text-mint-400" },
              { border: "border-teal-500/25", bg: "bg-teal-500/5", text: "text-teal-400" },
              { border: "border-plum-500/25", bg: "bg-plum-500/5", text: "text-plum-400" },
              { border: "border-crimson-500/25", bg: "bg-crimson-500/5", text: "text-crimson-400" },
            ][i % 4]!;
            return (
              <div key={legend.name} className={`notch flex items-start gap-3 border ${tint.border} bg-ink-900/40 p-4`}>
                <span
                  className={`notch-sm flex h-9 w-9 shrink-0 items-center justify-center border ${tint.border} ${tint.bg} font-display text-xs font-bold ${tint.text}`}
                >
                  {legend.position}
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-paper">{legend.name}</p>
                  <p className="text-xs text-smoke-500">{legend.club}</p>
                  <p className="mt-1 text-xs leading-relaxed text-smoke-600">{legend.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
