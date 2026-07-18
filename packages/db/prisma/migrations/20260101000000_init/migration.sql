-- CreateEnum
CREATE TYPE "WorldType" AS ENUM ('SINGLE', 'LEAGUE');

-- CreateEnum
CREATE TYPE "WorldStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'INTERNATIONAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('PERMANENT', 'LOAN', 'SWAP');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_leagues" (
    "id" TEXT NOT NULL,
    "eraId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ref_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "badgeRef" TEXT,

    CONSTRAINT "ref_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_club_seasons" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "reputation" INTEGER NOT NULL,

    CONSTRAINT "ref_club_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ref_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_player_seasons" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubSeasonId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "positions" TEXT[],
    "preferredFoot" TEXT NOT NULL,
    "weakFoot" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "overall" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "traits" TEXT[],

    CONSTRAINT "ref_player_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_managers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "philosophy" TEXT,

    CONSTRAINT "ref_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_competitions" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "ref_competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_kits" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "assetRef" TEXT NOT NULL,

    CONSTRAINT "ref_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_badges" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "assetRef" TEXT NOT NULL,

    CONSTRAINT "ref_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "WorldType" NOT NULL,
    "eraId" TEXT NOT NULL,
    "status" "WorldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_clubs" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "refClubSeasonId" TEXT,
    "name" TEXT NOT NULL,
    "managedByUserId" TEXT,
    "formation" TEXT,
    "lineup" JSONB,
    "bench" JSONB,

    CONSTRAINT "world_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_players" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "refPlayerSeasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "positions" TEXT[],
    "preferredFoot" TEXT NOT NULL,
    "weakFoot" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "overall" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "traits" TEXT[],
    "fitness" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "morale" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "form" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sharpness" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "world_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchday" INTEGER NOT NULL,
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "matchId" TEXT,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "setup" JSONB NOT NULL,
    "seed" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "homeXg" DOUBLE PRECISION NOT NULL,
    "awayXg" DOUBLE PRECISION NOT NULL,
    "homePossession" DOUBLE PRECISION NOT NULL,
    "awayPossession" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_stats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "passesCompleted" INTEGER NOT NULL,
    "tackles" INTEGER NOT NULL,
    "minutesPlayed" INTEGER NOT NULL,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "wage" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youth_players" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "positions" TEXT[],
    "attributes" JSONB NOT NULL,
    "potential" INTEGER NOT NULL,

    CONSTRAINT "youth_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finances" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "fromClubId" TEXT NOT NULL,
    "toClubId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "feeCents" BIGINT NOT NULL,
    "type" "TransferType" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_memberships" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',

    CONSTRAINT "league_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ref_leagues_eraId_idx" ON "ref_leagues"("eraId");

-- CreateIndex
CREATE INDEX "ref_club_seasons_leagueId_idx" ON "ref_club_seasons"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "ref_club_seasons_clubId_seasonYear_key" ON "ref_club_seasons"("clubId", "seasonYear");

-- CreateIndex
CREATE INDEX "ref_player_seasons_clubSeasonId_idx" ON "ref_player_seasons"("clubSeasonId");

-- CreateIndex
CREATE INDEX "ref_player_seasons_playerId_idx" ON "ref_player_seasons"("playerId");

-- CreateIndex
CREATE INDEX "ref_kits_clubId_idx" ON "ref_kits"("clubId");

-- CreateIndex
CREATE INDEX "ref_badges_clubId_idx" ON "ref_badges"("clubId");

-- CreateIndex
CREATE INDEX "worlds_ownerId_idx" ON "worlds"("ownerId");

-- CreateIndex
CREATE INDEX "world_clubs_worldId_idx" ON "world_clubs"("worldId");

-- CreateIndex
CREATE INDEX "world_players_worldId_clubId_idx" ON "world_players"("worldId", "clubId");

-- CreateIndex
CREATE INDEX "competitions_worldId_idx" ON "competitions"("worldId");

-- CreateIndex
CREATE INDEX "seasons_worldId_idx" ON "seasons"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_matchId_key" ON "fixtures"("matchId");

-- CreateIndex
CREATE INDEX "fixtures_worldId_seasonId_matchday_idx" ON "fixtures"("worldId", "seasonId", "matchday");

-- CreateIndex
CREATE INDEX "matches_worldId_idx" ON "matches"("worldId");

-- CreateIndex
CREATE INDEX "match_events_matchId_seq_idx" ON "match_events"("matchId", "seq");

-- CreateIndex
CREATE INDEX "player_match_stats_matchId_idx" ON "player_match_stats"("matchId");

-- CreateIndex
CREATE INDEX "player_match_stats_playerId_idx" ON "player_match_stats"("playerId");

-- CreateIndex
CREATE INDEX "contracts_worldId_idx" ON "contracts"("worldId");

-- CreateIndex
CREATE INDEX "staff_worldId_idx" ON "staff"("worldId");

-- CreateIndex
CREATE INDEX "youth_players_worldId_idx" ON "youth_players"("worldId");

-- CreateIndex
CREATE INDEX "finances_worldId_idx" ON "finances"("worldId");

-- CreateIndex
CREATE INDEX "transfers_worldId_idx" ON "transfers"("worldId");

-- CreateIndex
CREATE INDEX "awards_worldId_idx" ON "awards"("worldId");

-- CreateIndex
CREATE INDEX "records_worldId_idx" ON "records"("worldId");

-- CreateIndex
CREATE INDEX "achievements_worldId_idx" ON "achievements"("worldId");

-- CreateIndex
CREATE UNIQUE INDEX "league_memberships_worldId_userId_key" ON "league_memberships"("worldId", "userId");

-- CreateIndex
CREATE INDEX "chat_messages_worldId_createdAt_idx" ON "chat_messages"("worldId", "createdAt");

-- AddForeignKey
ALTER TABLE "ref_leagues" ADD CONSTRAINT "ref_leagues_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "eras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref_club_seasons" ADD CONSTRAINT "ref_club_seasons_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ref_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref_club_seasons" ADD CONSTRAINT "ref_club_seasons_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "ref_leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref_player_seasons" ADD CONSTRAINT "ref_player_seasons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "ref_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref_player_seasons" ADD CONSTRAINT "ref_player_seasons_clubSeasonId_fkey" FOREIGN KEY ("clubSeasonId") REFERENCES "ref_club_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ref_competitions" ADD CONSTRAINT "ref_competitions_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "ref_leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "eras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_clubs" ADD CONSTRAINT "world_clubs_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_clubs" ADD CONSTRAINT "world_clubs_refClubSeasonId_fkey" FOREIGN KEY ("refClubSeasonId") REFERENCES "ref_club_seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_players" ADD CONSTRAINT "world_players_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_players" ADD CONSTRAINT "world_players_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "world_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_players" ADD CONSTRAINT "world_players_refPlayerSeasonId_fkey" FOREIGN KEY ("refPlayerSeasonId") REFERENCES "ref_player_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "world_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "world_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "world_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youth_players" ADD CONSTRAINT "youth_players_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "world_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finances" ADD CONSTRAINT "finances_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "world_clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

