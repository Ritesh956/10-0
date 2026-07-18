import { Global, Module } from "@nestjs/common";
import { prisma } from "@futbol/db";

export const PRISMA = Symbol("PRISMA_CLIENT");

/** Wraps the shared @futbol/db singleton client as a Nest provider so every service injects the same connection pool. */
@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: prisma }],
  exports: [PRISMA],
})
export class PrismaModule {}
