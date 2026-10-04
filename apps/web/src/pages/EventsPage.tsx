import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { WeeklyEventDto } from "../api/types";
import { CountryFlag } from "../components/CountryFlag";
import { SiteFooter } from "../components/SiteFooter";
import { Button } from "../components/ui/Button";
import { timeLeft } from "../lib/events";
import { leagueTheme } from "../lib/leagueTheme";
import { useT } from "../lib/i18n/context";

/** This week's public events, one per league: same locked rules for everyone, best season wins. */
export function EventsPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [events, setEvents] = useState<WeeklyEventDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void api
      .getWeeklyEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this week's events"));
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-smoke-600">{t("events.every")}</p>
          <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-wide text-paper">{t("events.title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-smoke-400">
            {t("events.intro")}
          </p>
        </div>

        {error && <p className="text-center text-sm text-crimson-400">{error}</p>}
        {!events && !error && <p className="animate-mint-pulse text-center text-sm text-smoke-500">{t("events.loading")}</p>}

        <div className="space-y-4">
          {events?.map((event) => {
            const theme = leagueTheme(event.leagueId);
            return (
              <article key={event.key} className="notch space-y-3 border border-ink-800 bg-ink-900/50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-smoke-500">
                      <CountryFlag country={theme?.country} />
                      {theme?.name}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-paper">{event.name}</h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-amber-300">
                    {timeLeft(event.endsAt, now)}
                  </span>
                </div>

                <p className="text-sm text-smoke-300">{event.twist}</p>

                <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-smoke-400">
                  <span className="rounded-full border border-ink-700 px-2 py-0.5 capitalize">{event.difficulty}</span>
                  <span className="rounded-full border border-ink-700 px-2 py-0.5">{event.formation ?? t("events.anyFormation")}</span>
                  <span className="rounded-full border border-ink-700 px-2 py-0.5">
                    {event.memberCount} {event.memberCount === 1 ? "player" : "players"}
                  </span>
                </div>

                {event.top.length > 0 && (
                  <ol className="space-y-1 text-sm">
                    {event.top.map((row) => (
                      <li key={row.rank} className="flex items-center gap-2 text-smoke-300">
                        <span className="w-5 text-center font-display text-xs text-smoke-500">{row.rank}</span>
                        <span className="min-w-0 flex-1 truncate">{row.handle}</span>
                        <span className="font-bold text-mint-400">{row.points} pts</span>
                      </li>
                    ))}
                  </ol>
                )}

                <Button size="sm" onClick={() => navigate(`/multiplayer/join/${event.inviteCode}`)}>
                  {t("events.join")} &rarr;
                </Button>
              </article>
            );
          })}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
