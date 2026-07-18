import { Module } from "@nestjs/common";
import { WorldsController } from "./worlds.controller.js";
import { WorldsService } from "./worlds.service.js";

@Module({
  controllers: [WorldsController],
  providers: [WorldsService],
  exports: [WorldsService],
})
export class WorldsModule {}
