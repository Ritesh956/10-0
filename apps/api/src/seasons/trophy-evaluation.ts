import type { TrophyKey } from "@futbol/domain";

/** Pure input bundle for trophy evaluation — everything SeasonsService.finalizeRun already has
    on hand from getStandings/getCompetitionStats, reshaped into one flat record so the actual
    condition-checking is unit-testable without touching Prisma. */
export interface RunSummary {
  userClubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** 1-indexed final league position. */
  position: number;
  goldenBootClubId?: string | undefined;
  playmakerClubId?: string | undefined;
  goldenGloveClubId?: string | undefined;
  mvpClubId?: string | undefined;
}

/** Evaluates the trophy catalog (packages/domain's TrophyKey) against one finished run. "The
    Invincible" (won every match, the true 38-0-0 record) and "Unbeaten" (no losses, but at least
    one draw) are mutually exclusive — a perfect record earns the rarer trophy, not both. */
export function evaluateTrophies(run: RunSummary): TrophyKey[] {
  const trophies: TrophyKey[] = [];

  if (run.played > 0 && run.lost === 0) {
    if (run.won === run.played) trophies.push("invincible");
    else trophies.push("unbeaten");
  }
  if (run.position === 1) trophies.push("champions");
  if (run.goldenBootClubId === run.userClubId) trophies.push("golden-boot");
  if (run.playmakerClubId === run.userClubId) trophies.push("playmaker");
  if (run.goldenGloveClubId === run.userClubId) trophies.push("golden-glove");
  if (run.mvpClubId === run.userClubId) trophies.push("mvp");

  return trophies;
}
