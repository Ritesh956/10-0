import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { DraftController } from "./draft.controller.js";
import { DraftService } from "./draft.service.js";

@Module({
  imports: [WorldsModule],
  controllers: [DraftController],
  providers: [DraftService],
})
export class DraftModule {}
