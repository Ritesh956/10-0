/**
 * Weekly public events, one per league ("Serie A Sunday Survival"). An event is an ordinary async
 * multiplayer league (LeaguesService) that the server creates for the week — anyone can join from
 * the Events page, drafts under the event's locked rules, and the league's standings are the
 * event's leaderboard. This file is the pure part: which week it is, and each league's template.
 */

export interface EventTemplate {
  leagueId: string;
  name: string;
  /** One line on what makes the week different. */
  twist: string;
  difficulty: "easy" | "normal" | "hard";
  /** Locked formation, or omitted for free choice. */
  formation?: string;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    leagueId: "league-gb1",
    name: "Premier League Power Week",
    twist: "No redraws and no safety net — Hard difficulty, any formation.",
    difficulty: "hard",
  },
  {
    leagueId: "league-es1",
    name: "LaLiga Gran Premio",
    twist: "Everyone plays 4-3-3. Win it with the draw, not the shape.",
    difficulty: "normal",
    formation: "4-3-3",
  },
  {
    leagueId: "league-it1",
    name: "Serie A Sunday Survival",
    twist: "Back five only (5-3-2) and Hard difficulty. Defend your way to the top.",
    difficulty: "hard",
    formation: "5-3-2",
  },
  {
    leagueId: "league-l1",
    name: "Bundesliga Gegenpress Cup",
    twist: "Everyone plays 4-2-2-2: two strikers, two wide mids, relentless.",
    difficulty: "normal",
    formation: "4-2-2-2",
  },
  {
    leagueId: "league-fr1",
    name: "Ligue 1 Jeunesse Week",
    twist: "Easy difficulty with three redraws and a 4-3-3 — chase the highest-scoring XI.",
    difficulty: "easy",
    formation: "4-3-3",
  },
];

export function templateFor(leagueId: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((t) => t.leagueId === leagueId);
}

/** "2026-W41" — the ISO 8601 week (Monday start) a date falls in, in UTC. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // the Thursday of this week decides the ISO year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The instant the week containing `date` ends (next Monday 00:00 UTC). */
export function weekEndsAt(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + (8 - dayOfWeek));
  return d;
}

export const eventKey = (week: string, leagueId: string) => `${week}:${leagueId}`;
