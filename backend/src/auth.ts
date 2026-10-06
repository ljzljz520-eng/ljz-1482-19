import { createHmac, timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { ApiError } from "./services/errors";

function sign(payload: string): string {
  return createHmac("sha256", config.tokenSecret).update(payload).digest("hex");
}

export function issueToken(username: string): string {
  const exp = Math.floor(Date.now() / 1000) + config.tokenTtlSeconds;
  const payload = `${username}.${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyToken(token: string): string | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [username, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!username || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  return username;
}

export interface AuthedRequest extends Request {
  actor?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const actor = token ? verifyToken(token) : null;
  if (!actor) {
    next(new ApiError(401, "UNAUTHORIZED", "未登录或登录已过期"));
    return;
  }
  req.actor = actor;
  next();
}

export function checkLogin(username: string, password: string): boolean {
  return username === config.adminUser && password === config.adminPassword;
}
