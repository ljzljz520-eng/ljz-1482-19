import { Issue } from "./brand/tokens";

export class ApiError extends Error {
  status: number;
  code: string;
  issues?: Issue[];
  extra?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, issues?: Issue[], extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
    this.extra = extra;
  }
}

export const badRequest = (msg: string, issues?: Issue[]) => new ApiError(400, "BAD_REQUEST", msg, issues);
export const unauthorized = (msg = "未登录或凭证已过期") => new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "没有权限执行该操作") => new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "资源不存在") => new ApiError(404, "NOT_FOUND", msg);
export const conflict = (code: string, msg: string, extra?: Record<string, unknown>) =>
  new ApiError(409, code, msg, undefined, extra);
export const unprocessable = (msg: string, issues?: Issue[]) => new ApiError(422, "VALIDATION_FAILED", msg, issues);
