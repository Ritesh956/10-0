-- CreateTable
CREATE TABLE "multiplayer_leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multiplayer_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "multiplayer_leagues_inviteCode_key" ON "multiplayer_leagues"("inviteCode");

-- DropForeignKey
ALTER TABLE "league_memberships" DROP CONSTRAINT "league_memberships_worldId_fkey";

-- DropIndex
DROP INDEX "league_memberships_worldId_userId_key";

-- AlterTable
ALTER TABLE "league_memberships"
    DROP COLUMN "clubId",
    DROP COLUMN "role",
    ADD COLUMN     "leagueId" TEXT NOT NULL,
    ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "worldId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "league_memberships_leagueId_userId_key" ON "league_memberships"("leagueId", "userId");

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "multiplayer_leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
