-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'solo',
    "difficulty" TEXT NOT NULL,
    "ratingsMode" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "squadOverall" INTEGER NOT NULL,
    "clubName" TEXT NOT NULL,
    "leagueName" TEXT,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "goalDiff" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_worldId_key" ON "leaderboard_entries"("worldId");

-- CreateIndex
CREATE INDEX "leaderboard_entries_mode_points_idx" ON "leaderboard_entries"("mode", "points");
