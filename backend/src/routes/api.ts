import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { DataSource } from "typeorm";
import { Asset, BrandVersion, Project, PublishEvent } from "../entities/entities";
import { checkLogin, issueToken, requireAuth, AuthedRequest } from "../auth";
import { GROUP_META, TOKEN_DEFS, CONTRAST_RULES } from "../tokens/schema";
import { validateTheme } from "../tokens/validate";
import { buildRuntimeCss, tokenHashOf } from "../tokens/cssgen";
import { ApiError } from "../services/errors";
import * as svc from "../services/brandService";

const tokensSchema = z.record(z.string(), z.string().max(200));

type Handler = (req: AuthedRequest, res: Response) => unknown | Promise<unknown>;
/** Express 4 不捕获异步异常，统一包装 */
const h =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);
  };

export function buildRouter(ds: DataSource): Router {
  const router = Router();
  const actorOf = (req: AuthedRequest) => req.actor ?? "anonymous";

  // ---------- 认证 ----------
  router.post("/auth/login", h((req, res) => {
    const body = z.object({ username: z.string(), password: z.string() }).safeParse(req.body);
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    if (!checkLogin(body.data.username, body.data.password)) {
      throw new ApiError(401, "UNAUTHORIZED", "用户名或密码错误");
    }
    res.json({ token: issueToken(body.data.username) });
  }));

  // ---------- 规范元数据 ----------
  router.get("/schema", h((_req, res) => {
    res.json({ groups: GROUP_META, defs: TOKEN_DEFS, contrastRules: CONTRAST_RULES });
  }));

  // ---------- 品牌与版本 ----------
  router.get("/brands", h(async (_req, res) => {
    res.json(await svc.listBrands(ds));
  }));

  router.get("/brands/:id", h(async (req, res) => {
    res.json(await svc.getBrandDetail(ds, req.params.id));
  }));

  router.post("/brands/:id/drafts", requireAuth, h(async (req, res) => {
    const body = z.object({ baseVersionId: z.string().optional() }).safeParse(req.body ?? {});
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    res.status(201).json(await svc.createDraft(ds, req.params.id, body.data.baseVersionId, actorOf(req)));
  }));

  router.get("/versions/:id", h(async (req, res) => {
    res.json(await svc.getVersion(ds, req.params.id));
  }));

  router.put("/versions/:id", requireAuth, h(async (req, res) => {
    const body = z
      .object({ tokens: tokensSchema, note: z.string().max(500).nullable().optional(), lockVersion: z.number().int() })
      .safeParse(req.body);
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误", body.error.issues);
    res.json(await svc.saveDraft(ds, req.params.id, body.data.tokens, body.data.note ?? null, body.data.lockVersion, actorOf(req)));
  }));

  router.post("/versions/:id/validate", h(async (req, res) => {
    const body = z.object({ tokens: tokensSchema }).safeParse(req.body);
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    res.json(validateTheme(body.data.tokens));
  }));

  router.post("/versions/:id/publish", requireAuth, h(async (req, res) => {
    const body = z.object({ lockVersion: z.number().int() }).safeParse(req.body);
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    res.json(await svc.publishVersion(ds, req.params.id, body.data.lockVersion, actorOf(req)));
  }));

  router.get("/versions/:id/reference-graph", h(async (req, res) => {
    const version = await ds.getRepository(BrandVersion).findOne({ where: { id: req.params.id } });
    if (!version) throw new ApiError(404, "NOT_FOUND", "版本不存在");
    res.json(svc.referenceGraphOf(version));
  }));

  router.get("/versions/:id/export-preview", h(async (req, res) => {
    const version = await ds.getRepository(BrandVersion).findOne({ where: { id: req.params.id } });
    if (!version) throw new ApiError(404, "NOT_FOUND", "版本不存在");
    res.json(svc.exportPreviewOf(version));
  }));

  // ---------- 项目绑定 ----------
  router.get("/projects", h(async (_req, res) => {
    res.json(await svc.listProjects(ds));
  }));

  router.put("/projects/:id/binding", requireAuth, h(async (req, res) => {
    const body = z
      .object({ mode: z.enum(["follow", "pin"]), pinnedVersionId: z.string().nullable().optional() })
      .safeParse(req.body);
    if (!body.success) throw new ApiError(400, "BAD_REQUEST", "请求格式错误");
    res.json(await svc.setBinding(ds, req.params.id, body.data.mode, body.data.pinnedVersionId ?? null, actorOf(req)));
  }));

  router.get("/projects/:slug/effective-theme", h(async (req, res) => {
    res.json(await svc.getEffectiveTheme(ds, req.params.slug));
  }));

  router.get("/projects/:id/assets", h(async (req, res) => {
    const assets = await ds.getRepository(Asset).find({ where: { projectId: req.params.id }, order: { updatedAt: "DESC" } });
    res.json(assets);
  }));

  router.post("/assets/:id/reapprove", requireAuth, h(async (req, res) => {
    res.json(await svc.reapproveAsset(ds, req.params.id, actorOf(req)));
  }));

  // ---------- 审计 ----------
  router.get("/audit", h(async (_req, res) => {
    const events = await ds.getRepository(PublishEvent).find({ order: { createdAt: "DESC" }, take: 50 });
    res.json(events);
  }));

  // ---------- 样式产物 ----------
  // 编译期产物：内容哈希寻址，immutable 长缓存；旧设备缓存旧包不影响新版本发布
  router.get("/assets/brand-:hash.css", h(async (req, res) => {
    const version = await ds
      .getRepository(BrandVersion)
      .createQueryBuilder("v")
      .where("v.cssHash = :hash", { hash: req.params.hash })
      .andWhere("v.status = 'published'")
      .getOne();
    if (!version || !version.compiledCss) throw new ApiError(404, "NOT_FOUND", "样式产物不存在");
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", `"${version.cssHash}"`);
    res.setHeader("X-Brand-Version", String(version.versionNumber));
    res.send(version.compiledCss);
  }));

  // 受约束的运行时变量：仅规范内 --brand-* 变量，no-cache，便于按租户即时生效
  router.get("/runtime/theme.css", h(async (req, res) => {
    const slug = String(req.query.project ?? "");
    const project = await ds.getRepository(Project).findOne({ where: { slug } });
    if (!project) throw new ApiError(404, "NOT_FOUND", "项目不存在");
    const version = await svc.resolveEffectiveVersion(ds, project);
    const { values, hasErrors } = validateTheme(version.tokens);
    if (hasErrors) throw new ApiError(500, "VERSION_INVALID", "生效版本令牌无效");
    const css = buildRuntimeCss(values, {
      brandSlug: project.slug,
      versionNumber: version.versionNumber,
      tokenHash: version.tokenHash ?? tokenHashOf(version.tokens)
    });
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", `"${version.tokenHash}"`);
    res.setHeader("X-Brand-Version", String(version.versionNumber));
    res.send(css);
  }));

  router.get("/health", h((_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  }));

  return router;
}
