import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { DataSource } from "typeorm";
import { buildRouter } from "./routes/api";
import { ApiError } from "./services/errors";
import logger from "./logger";

export function createApp(ds: DataSource) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "200kb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info("http", { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
    });
    next();
  });

  app.use("/api", buildRouter(ds));

  // 404
  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: "接口不存在" });
  });

  // 统一错误处理
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ code: err.code, message: err.message, details: err.details ?? null });
      return;
    }
    logger.error("unhandled error", { message: err.message, stack: err.stack });
    res.status(500).json({ code: "INTERNAL_ERROR", message: "服务器内部错误" });
  });

  return app;
}
