import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { ensureSeed } from "./seed";

async function waitForDatabase(maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      logger.warn("database_not_ready", { attempt, maxAttempts, error: err instanceof Error ? err.message : String(err) });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("数据库连接失败：超过最大重试次数");
}

async function main() {
  if (process.env.BRANDSPEC_INSECURE_SECRET) {
    logger.warn("JWT_SECRET 未配置，正在使用开发兜底密钥 —— 生产环境必须注入 JWT_SECRET");
  }
  await waitForDatabase();
  await ensureSeed();

  const app = createApp();
  app.listen(config.port, () => {
    logger.info("server_started", { port: config.port });
  });
}

main().catch((err) => {
  logger.error("fatal_startup_error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
