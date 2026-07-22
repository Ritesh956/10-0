-- CreateEnum
CREATE TYPE "LiveDraftStatus" AS ENUM ('LOBBY', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "live_draft_rooms" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "maxSeats" INTEGER NOT NULL DEFAULT 4,
    "status" "LiveDraftStatus" NOT NULL DEFAULT 'LOBBY',
    "currentPickNumber" INTEGER NOT NULL DEFAULT 0,
    "turnStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "live_draft_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_draft_participants" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "worldId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_draft_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_draft_picks" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "refPlayerSeasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_rooms_leagueId_key" ON "live_draft_rooms"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_rooms_inviteCode_key" ON "live_draft_rooms"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_participants_roomId_userId_key" ON "live_draft_participants"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_participants_roomId_seatIndex_key" ON "live_draft_participants"("roomId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_picks_roomId_pickNumber_key" ON "live_draft_picks"("roomId", "pickNumber");

-- CreateIndex
CREATE UNIQUE INDEX "live_draft_picks_roomId_playerId_key" ON "live_draft_picks"("roomId", "playerId");

-- AddForeignKey
ALTER TABLE "live_draft_rooms" ADD CONSTRAINT "live_draft_rooms_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "multiplayer_leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_draft_participants" ADD CONSTRAINT "live_draft_participants_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "live_draft_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_draft_picks" ADD CONSTRAINT "live_draft_picks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "live_draft_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
