import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "@futbol/db";
import { SEASON_SIM_QUEUE, seasonSimJob } from "@futbol/domain";
import { processSeasonSimJob } from "./process-season.js";

function connectionOptions() {
  const url = new URL(process.env["REDIS_URL"] ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

const worker = new Worker(
  SEASON_SIM_QUEUE,
  async (job) => {
    const payload = seasonSimJob.parse(job.data);
    await processSeasonSimJob(prisma, payload);
  },
  { connection: connectionOptions() },
);

worker.on("completed", (job) => {
  // eslint-disable-next-line no-console
  console.log(`Season sim job ${job.id} (world ${job.data.worldId}, season ${job.data.seasonId}) completed`);
});

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`Season sim job ${job?.id} failed:`, err);
});

// eslint-disable-next-line no-console
console.log("Futbol sim-worker listening for season-simulation jobs...");
