import { NextFunction, Request, Response } from "express";
import { logger } from "../logger";
import { ApiError } from "../errors";

/** 安全响应头：API 不渲染内容，default-src 'none' */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}

/** 结构化访问日志 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info("http_request", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(ms * 10) / 10,
      actor: req.user?.username ?? "anonymous"
    });
  });
  next();
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: "NOT_FOUND", message: "接口不存在" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.issues ? { issues: err.issues } : {}),
      ...(err.extra ? err.extra : {})
    });
    return;
  }
  if (isBodyParseError(err)) {
    res.status(400).json({ code: "BAD_JSON", message: "请求体不是合法 JSON" });
    return;
  }
  logger.error("unhandled_error", { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({ code: "INTERNAL_ERROR", message: "服务器内部错误" });
}

function isBodyParseError(err: unknown): err is { type: string } {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed";
}
