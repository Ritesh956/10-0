import { Module } from "@nestjs/common";
import { LeaguesController, LeaguesPublicController } from "./leagues.controller.js";
import { LeaguesService } from "./leagues.service.js";

@Module({
  controllers: [LeaguesPublicController, LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
