-- CreateEnum
CREATE TYPE "KnockoutRound" AS ENUM ('QF', 'SF', 'FINAL');

-- CreateTable
CREATE TABLE "knockout_ties" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "round" "KnockoutRound" NOT NULL,
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,
    "firstLegFixtureId" TEXT,
    "secondLegFixtureId" TEXT,
    "winnerClubId" TEXT,
    "wentToPenalties" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "knockout_ties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knockout_ties_firstLegFixtureId_key" ON "knockout_ties"("firstLegFixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "knockout_ties_secondLegFixtureId_key" ON "knockout_ties"("secondLegFixtureId");

-- CreateIndex
CREATE INDEX "knockout_ties_worldId_competitionId_idx" ON "knockout_ties"("worldId", "competitionId");

-- AddForeignKey
ALTER TABLE "knockout_ties" ADD CONSTRAINT "knockout_ties_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
