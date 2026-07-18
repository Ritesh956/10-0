import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env["PORT"] ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Futbol API listening on http://localhost:${port}`);
}

void bootstrap();
