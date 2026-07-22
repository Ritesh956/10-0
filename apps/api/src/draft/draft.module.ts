import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { DraftController } from "./draft.controller.js";
import { DraftService } from "./draft.service.js";

@Module({
  imports: [WorldsModule],
  controllers: [DraftController],
  providers: [DraftService],
  // live-draft.gateway.ts reuses draftFantasy directly (in-process, not over HTTP) to submit each
  // participant's picks the moment a room's picking phase completes.
  exports: [DraftService],
})
export class DraftModule {}
