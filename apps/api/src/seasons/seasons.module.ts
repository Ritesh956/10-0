import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { SeasonsController } from "./seasons.controller.js";
import { SeasonsService } from "./seasons.service.js";

@Module({
  imports: [WorldsModule],
  controllers: [SeasonsController],
  providers: [SeasonsService],
})
export class SeasonsModule {}
