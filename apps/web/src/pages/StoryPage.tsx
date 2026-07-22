import { useNavigate } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";

export function StoryPage() {
  const navigate = useNavigate();

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
        <div className="text-center">
          <span className="notch-sm inline-flex items-center gap-2 border-2 border-crimson-500/30 bg-crimson-500/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-smoke-400">
            Our story
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-tight tracking-tight text-paper">
            Why we built this.
          </h1>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-smoke-400">
          <p>
            Every football fan has run the same argument in their head at some point: what if you took a player from
            one era and dropped them into a team from another? What would a defence built out of 2012 and 2023 both
            actually look like? Would it hold up?
          </p>
          <p>
            Futbol started as an answer to that argument. Instead of guessing, we built a draft: spin a wheel, land
            on a real club from a real season, pick a real player out of that exact squad, and repeat until you've
            built something that could never have existed — an XI assembled entirely by chance, from across the
            top-5 European leagues and more than a decade of seasons.
          </p>
          <p>
            Then we built a simulator underneath it, so that squad doesn't just sit on a page. It plays a full
            season — every match, every card, every injury — against a league genuinely filled with its own current
            clubs. You get to find out, for real, whether your random draw can go the whole way unbeaten.
          </p>
          <p>
            Everything downstream of that idea — the January gamble, the run to Europe, the trophies and the
            history that follows you between worlds — exists because the core question never got old: how far can
            this squad actually go?
          </p>
          <p>
            We're not affiliated with any league, club, or player. The data is real and factual; the ratings, the
            tactics, and every match result are entirely our own calculation. What you build with it is yours.
          </p>
        </div>

        <div className="text-center">
          <Button size="lg" onClick={() => navigate("/setup")}>
            Build your own XI &rarr;
          </Button>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
