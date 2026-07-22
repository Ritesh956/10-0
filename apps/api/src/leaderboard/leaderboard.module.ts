import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { SeasonsModule } from "../seasons/seasons.module.js";
import { LeaderboardController, LeaderboardSubmitController } from "./leaderboard.controller.js";
import { LeaderboardService } from "./leaderboard.service.js";

@Module({
  imports: [WorldsModule, SeasonsModule],
  controllers: [LeaderboardSubmitController, LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
