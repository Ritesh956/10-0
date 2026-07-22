/** Pure helpers factored out of leagues.service.ts (Prisma-coupled) so invite-code formatting and
    standings ranking are unit-testable without mocking the database — the same pattern as
    lineup.ts/round-robin.ts/leaderboard.logic.ts. */

/** Excludes visually-ambiguous characters (0/O, 1/I/L) so a code read aloud or handwritten from a
    screen doesn't get mistyped. */
const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const INVITE_CODE_LENGTH = 8;

/** Maps raw random bytes to an invite code string — pure so the mapping itself is testable without
    going through crypto.randomBytes. The service is responsible for supplying enough bytes
    (INVITE_CODE_LENGTH of them) and for retrying on the rare unique-constraint collision. */
export function buildInviteCode(randomBytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const byte = randomBytes[i] ?? 0;
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

/** Minimal shape a standings row's result needs — deliberately structural (not tied to Prisma's
    generated LeaderboardEntry type) so this stays pure and easy to unit test with plain fixtures. */
export interface LeagueEntryLike {
  points: number;
  goalDiff: number;
}

export interface MemberResult<E extends LeagueEntryLike> {
  userId: string;
  worldId: string | null;
  entry: E | null;
}

export type MemberStatus = "not-started" | "in-progress" | "complete";

export interface StandingsRow<E extends LeagueEntryLike> extends MemberResult<E> {
  /** 1-based rank among members with a submitted result; null for anyone without one yet. */
  rank: number | null;
  status: MemberStatus;
}

/**
 * Ranks league members by their submitted season result (points desc, goal difference desc as the
 * tiebreak — same ordering LeaderboardService.list already uses for the public board). Members with
 * no result yet are never ranked (not just sorted last with a fake rank) — they're either
 * "in-progress" (drafted, `worldId` set, season not finished/submitted) or "not-started" (joined but
 * hasn't drafted at all), both surfaced so a league's standings page can show who's still to play
 * without implying a false position in the table.
 */
export function rankStandings<E extends LeagueEntryLike>(members: MemberResult<E>[]): StandingsRow<E>[] {
  const withEntry = members.filter((m): m is MemberResult<E> & { entry: E } => m.entry !== null);
  const withoutEntry = members.filter((m) => m.entry === null);

  const ranked: StandingsRow<E>[] = [...withEntry]
    .sort((a, b) => b.entry.points - a.entry.points || b.entry.goalDiff - a.entry.goalDiff)
    .map((m, i) => ({ ...m, rank: i + 1, status: "complete" }));

  const unranked: StandingsRow<E>[] = withoutEntry.map((m) => ({
    ...m,
    rank: null,
    status: m.worldId ? "in-progress" : "not-started",
  }));

  return [...ranked, ...unranked];
}
