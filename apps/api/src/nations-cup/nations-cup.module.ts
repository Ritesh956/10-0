import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { SeasonsModule } from "../seasons/seasons.module.js";
import { EuropeModule } from "../europe/europe.module.js";
import { NationsCupController } from "./nations-cup.controller.js";
import { NationsCupService } from "./nations-cup.service.js";

@Module({
  imports: [WorldsModule, SeasonsModule, EuropeModule],
  controllers: [NationsCupController],
  providers: [NationsCupService],
})
export class NationsCupModule {}
