import { PrismaClient } from "@prisma/client";

/**
 * Removes test/dev runs from the public leaderboards before launch ("League Test XI", "OneClubLive2",
 * the audit sessions' "AuditTester"/"LineupE2E"/"EuropeE2E" …). Dry run by default — it only lists
 * what it would delete. Only leaderboard rows are touched; the worlds behind them stay.
 *
 *   pnpm wipe:test-leaderboard                 # list matches
 *   pnpm wipe:test-leaderboard -- --apply      # delete them
 *   pnpm wipe:test-leaderboard -- --all        # every leaderboard + daily entry (e.g. after the
 *                                              # 2026-10 rating re-fit, when old runs carry
 *                                              # squad overalls on the previous scale)
 */

const TEST_PATTERNS = [/test/i, /e2e/i, /audit/i, /live\d*$/i, /^tmp/i, /^demo/i];

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const all = process.argv.includes("--all");

  const entries = await prisma.leaderboardEntry.findMany({ select: { id: true, handle: true, clubName: true, createdAt: true } });
  const dailies = await prisma.dailyChallengeEntry.findMany({ select: { id: true, handle: true, createdAt: true } });
  const isTest = (...names: (string | null)[]) => names.some((n) => n && TEST_PATTERNS.some((re) => re.test(n)));

  const lbTargets = all ? entries : entries.filter((e) => isTest(e.handle, e.clubName));
  const dailyTargets = all ? dailies : dailies.filter((e) => isTest(e.handle));

  console.log(`Leaderboard entries to remove: ${lbTargets.length} of ${entries.length}`);
  for (const e of lbTargets) console.log(`  ${e.createdAt.toISOString().slice(0, 10)}  ${e.handle} · ${e.clubName}`);
  console.log(`Daily entries to remove: ${dailyTargets.length} of ${dailies.length}`);
  for (const e of dailyTargets) console.log(`  ${e.createdAt.toISOString().slice(0, 10)}  ${e.handle}`);

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --apply to delete.");
    return;
  }
  const lb = await prisma.leaderboardEntry.deleteMany({ where: { id: { in: lbTargets.map((e) => e.id) } } });
  const daily = await prisma.dailyChallengeEntry.deleteMany({ where: { id: { in: dailyTargets.map((e) => e.id) } } });
  console.log(`\nDeleted ${lb.count} leaderboard and ${daily.count} daily entries.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
