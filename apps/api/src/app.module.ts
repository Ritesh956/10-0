import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { WorldsModule } from "./worlds/worlds.module.js";
import { DraftModule } from "./draft/draft.module.js";
import { SeasonsModule } from "./seasons/seasons.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    CatalogModule,
    WorldsModule,
    DraftModule,
    SeasonsModule,
  ],
})
export class AppModule {}
