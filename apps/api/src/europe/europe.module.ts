import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { SeasonsModule } from "../seasons/seasons.module.js";
import { EuropeController } from "./europe.controller.js";
import { EuropeService } from "./europe.service.js";

@Module({
  imports: [WorldsModule, SeasonsModule],
  controllers: [EuropeController],
  providers: [EuropeService],
})
export class EuropeModule {}
