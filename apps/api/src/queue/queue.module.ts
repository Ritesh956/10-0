import { Global, Module } from "@nestjs/common";
import { Queue } from "bullmq";
import { SEASON_SIM_QUEUE } from "@futbol/domain";

export const SEASON_SIM_QUEUE_TOKEN = Symbol("SEASON_SIM_QUEUE");

function connectionOptions() {
  const url = new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

/** Producer side of the season-simulation queue; apps/sim-worker is the consumer. */
@Global()
@Module({
  providers: [
    {
      provide: SEASON_SIM_QUEUE_TOKEN,
      useFactory: () =>
        new Queue(SEASON_SIM_QUEUE, {
          connection: connectionOptions(),
        }),
    },
  ],
  exports: [SEASON_SIM_QUEUE_TOKEN],
})
export class QueueModule {}
