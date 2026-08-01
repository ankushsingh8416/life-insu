import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AppConfig } from "./common/config/configuration";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const { port, corsOrigin, env } = config.get<AppConfig>("app")!;

  // Required behind any reverse proxy (Railway, Vercel, NGINX, Cloudflare) — without
  // this, req.ip resolves to the proxy's IP for every request, so the rate limiter
  // would key all users into one shared bucket instead of limiting per real client.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableShutdownHooks();

  await app.listen(port);

  Logger.log(`🚀 Sabse Pehle AI API running on :${port} [${env}]`, "Bootstrap");
  Logger.log(`🔌 Socket.IO chat namespace: /chat`, "Bootstrap");
}

bootstrap().catch((error) => {
  Logger.error("Failed to bootstrap application", error);
  process.exit(1);
});
