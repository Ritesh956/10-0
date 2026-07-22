-- AlterTable
ALTER TABLE "leaderboard_entries" ADD COLUMN     "refClubId" TEXT;

-- CreateIndex
CREATE INDEX "leaderboard_entries_mode_refClubId_points_idx" ON "leaderboard_entries"("mode", "refClubId", "points");
