import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../errors";
import { validateTokenTree } from "../brand/validate";
import { publishVersion } from "../services/brandService";
import { logger } from "../logger";

export const brandsRouter = Router();

const versionNameSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "版本号必须是 x.y.z 形式");

brandsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.brandVersion.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true, name: true, version: true, status: true, revision: true,
        contentHash: true, createdBy: true, createdAt: true, publishedAt: true
      }
    });
    res.json(rows);
  } catch (err) { next(err); }
});

brandsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const row = await prisma.brandVersion.findUnique({ where: { id: req.params.id } });
    if (!row) throw notFound("品牌版本不存在");
    res.json(row);
  } catch (err) { next(err); }
});

/** 新建草稿：从指定版本（默认最新已发布）复制令牌 */
brandsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      version: versionNameSchema,
      baseVersionId: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "参数不正确");

    const base = parsed.data.baseVersionId
      ? await prisma.brandVersion.findUnique({ where: { id: parsed.data.baseVersionId } })
      : await prisma.brandVersion.findFirst({
          where: { status: "published" },
          orderBy: [{ publishedAt: "desc" }]
        });
    if (!base) throw badRequest("没有可复制的基准版本，请先发布一个版本");

    try {
      const draft = await prisma.brandVersion.create({
        data: {
          name: base.name,
          version: parsed.data.version,
          status: "draft",
          tokens: base.tokens as Prisma.JsonObject,
          createdBy: req.user!.username
        }
      });
      await prisma.auditLog.create({
        data: {
          actor: req.user!.username,
          action: "create_draft",
          detail: { versionId: draft.id, version: draft.version, from: base.version }
        }
      });
      res.status(201).json(draft);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw conflict("VERSION_EXISTS", `版本号 ${parsed.data.version} 已存在，请更换`);
      }
      throw e;
    }
  } catch (err) { next(err); }
});

/** 保存草稿令牌：先校验（类型/引用图/对比度/安全），再乐观锁写入 */
brandsRouter.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      tokens: z.unknown(),
      expectedRevision: z.number().int().positive()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("请求体需要 tokens 与 expectedRevision");

    const validation = validateTokenTree(parsed.data.tokens);
    if (!validation.ok) {
      return res.status(422).json({
        code: "VALIDATION_FAILED",
        message: "品牌令牌校验失败",
        issues: validation.issues
      });
    }

    const draft = await prisma.brandVersion.findUnique({ where: { id: req.params.id } });
    if (!draft) throw notFound("品牌版本不存在");
    if (draft.status !== "draft") throw conflict("NOT_A_DRAFT", "只有草稿可以编辑");

    const updated = await prisma.brandVersion.updateMany({
      where: { id: draft.id, revision: parsed.data.expectedRevision, status: "draft" },
      data: { tokens: parsed.data.tokens as Prisma.JsonObject, revision: { increment: 1 } }
    });
    if (updated.count === 0) {
      throw conflict("STALE_REVISION", "该草稿已被其他管理员修改，请刷新后重试");
    }
    const fresh = await prisma.brandVersion.findUniqueOrThrow({ where: { id: draft.id } });
    logger.info("draft_saved", { versionId: draft.id, version: draft.version, actor: req.user!.username });
    res.json(fresh);
  } catch (err) { next(err); }
});

/** 干跑校验：编辑器实时反馈（别名循环/缺项、对比度、错误语义、焦点可见性） */
brandsRouter.post("/validate", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ tokens: z.unknown() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("请求体需要 tokens 字段");
    const validation = validateTokenTree(parsed.data.tokens);
    res.json({
      ok: validation.ok,
      issues: validation.issues,
      contrast: validation.contrast
    });
  } catch (err) { next(err); }
});

/** 发布：事务 + 乐观锁，两个管理员并发发布时后者收到 409 */
brandsRouter.post("/:id/publish", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ expectedRevision: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("请求体需要 expectedRevision");
    const published = await publishVersion(req.params.id, parsed.data.expectedRevision, req.user!.username);
    logger.info("version_published", { versionId: published.id, version: published.version, actor: req.user!.username });
    res.json(published);
  } catch (err) { next(err); }
});

/** 编译时样式产物：发布时生成，内容寻址，永久缓存 */
brandsRouter.get("/:id/asset.css", async (req, res, next) => {
  try {
    const row = await prisma.brandVersion.findUnique({ where: { id: req.params.id } });
    if (!row) throw notFound("品牌版本不存在");
    if (row.status !== "published" || !row.artifactCss) {
      throw conflict("NOT_PUBLISHED", "该版本尚未发布，没有编译产物");
    }
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("ETag", `"bva-${row.id}-${row.contentHash.slice(0, 12)}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.headers["if-none-match"] === `"bva-${row.id}-${row.contentHash.slice(0, 12)}"`) {
      return res.status(304).end();
    }
    res.send(row.artifactCss);
  } catch (err) { next(err); }
});
