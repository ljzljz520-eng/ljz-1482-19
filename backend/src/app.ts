import express from "express";
import { authRouter } from "./routes/auth";
import { brandsRouter } from "./routes/brands";
import { projectsRouter } from "./routes/projects";
import { subtitlesRouter } from "./routes/subtitles";
import { errorHandler, notFoundHandler, requestLogger, securityHeaders } from "./middleware/common";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(securityHeaders);
  app.use(requestLogger);
  app.use(express.json({ limit: "256kb" })); // 主题配置体积受限，拒绝大包

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "brandspec-backend", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/brands", brandsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/subtitles", subtitlesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
