import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { WorldsModule } from "../worlds/worlds.module.js";
import { DraftModule } from "../draft/draft.module.js";
import { LiveDraftController, LiveDraftPublicController } from "./live-draft.controller.js";
import { LiveDraftService } from "./live-draft.service.js";
import { LiveDraftGateway } from "./live-draft.gateway.js";

@Module({
  imports: [AuthModule, WorldsModule, DraftModule],
  controllers: [LiveDraftPublicController, LiveDraftController],
  providers: [LiveDraftService, LiveDraftGateway],
})
export class LiveDraftModule {}
