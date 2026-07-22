import { Module } from "@nestjs/common";
import { WorldsModule } from "../worlds/worlds.module.js";
import { JanuaryController } from "./january.controller.js";
import { JanuaryService } from "./january.service.js";

@Module({
  imports: [WorldsModule],
  controllers: [JanuaryController],
  providers: [JanuaryService],
})
export class JanuaryModule {}
