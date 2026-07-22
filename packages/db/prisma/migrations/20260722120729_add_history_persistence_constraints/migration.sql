-- CreateIndex
CREATE UNIQUE INDEX "achievements_worldId_userId_key_key" ON "achievements"("worldId", "userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "awards_worldId_seasonId_name_key" ON "awards"("worldId", "seasonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "records_worldId_name_key" ON "records"("worldId", "name");
