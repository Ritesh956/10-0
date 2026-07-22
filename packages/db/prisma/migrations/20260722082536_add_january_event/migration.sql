-- CreateEnum
CREATE TYPE "JanuaryEventType" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "january_events" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "eventType" "JanuaryEventType" NOT NULL,
    "outPlayerId" TEXT NOT NULL,
    "outPlayerName" TEXT NOT NULL,
    "outOverall" INTEGER NOT NULL,
    "inPlayerId" TEXT NOT NULL,
    "inPlayerName" TEXT NOT NULL,
    "inOverall" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "january_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "january_events_worldId_idx" ON "january_events"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "january_events_seasonId_clubId_key" ON "january_events"("seasonId", "clubId");

-- AddForeignKey
ALTER TABLE "january_events" ADD CONSTRAINT "january_events_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "january_events" ADD CONSTRAINT "january_events_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
