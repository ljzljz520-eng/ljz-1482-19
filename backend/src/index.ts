import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { createApp } from "./app";
import { seed } from "./seed";
import { config } from "./config";
import logger from "./logger";

async function bootstrap(): Promise<void> {
  let attempts = 0;
  // 等待数据库就绪（docker compose 下 db 健康检查之外的兜底重试）
  for (;;) {
    try {
      await AppDataSource.initialize();
      break;
    } catch (err) {
      attempts += 1;
      if (attempts > 30) throw err;
      logger.warn("database not ready, retrying", { attempts });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  logger.info("database connected", { type: config.dbType });

  await seed(AppDataSource);

  const app = createApp(AppDataSource);
  app.listen(config.port, () => {
    logger.info("brand-spec backend listening", { port: config.port });
  });
}

bootstrap().catch((err) => {
  logger.error("fatal bootstrap error", { message: err.message, stack: err.stack });
  process.exit(1);
});
