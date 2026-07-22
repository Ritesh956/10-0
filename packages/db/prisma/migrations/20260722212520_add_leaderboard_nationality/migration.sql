-- AlterTable
ALTER TABLE "leaderboard_entries" ADD COLUMN     "nationality" TEXT;

-- CreateIndex
CREATE INDEX "leaderboard_entries_mode_nationality_points_idx" ON "leaderboard_entries"("mode", "nationality", "points");
