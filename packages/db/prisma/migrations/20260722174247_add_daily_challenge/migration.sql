-- CreateTable
CREATE TABLE "daily_challenges" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "themeLabel" TEXT NOT NULL,
    "anchorPlayerSeasonId" TEXT NOT NULL,
    "fixedFormation" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "poolStats" JSONB NOT NULL,
    "refreshesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenge_entries" (
    "id" TEXT NOT NULL,
    "dailyChallengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "squadOverall" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_challenge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenges_date_key" ON "daily_challenges"("date");

-- CreateIndex
CREATE INDEX "daily_challenge_entries_dailyChallengeId_score_idx" ON "daily_challenge_entries"("dailyChallengeId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenge_entries_dailyChallengeId_userId_key" ON "daily_challenge_entries"("dailyChallengeId", "userId");

-- AddForeignKey
ALTER TABLE "daily_challenge_entries" ADD CONSTRAINT "daily_challenge_entries_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "daily_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
