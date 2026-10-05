import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../errors";
import { effectiveVersionOf, subtitlesOf } from "../services/brandService";
import { validateTokenTree } from "../brand/validate";
import { generateRuntimeCss, toCssVars } from "../brand/cssgen";
import { logger } from "../logger";

export const projectsRouter = Router();

async function loadProjectBySlug(slug: string) {
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw notFound(`项目 ${slug} 不存在`);
  return project;
}

function resolvedOf(tokens: unknown) {
  const validation = validateTokenTree(tokens);
  if (!validation.ok) {
    // 已发布版本理论上必然合法；若数据被外部破坏，明确报错而不是输出可疑样式
    throw conflict("STORED_TOKENS_INVALID", "存储的令牌数据未通过校验，请联系管理员");
  }
  return validation;
}

projectsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
    const result = [];
    for (const p of projects) {
      const effective = await effectiveVersionOf(p);
      result.push({
        ...p,
        effectiveVersion: effective
          ? { id: effective.id, version: effective.version, contentHash: effective.contentHash, publishedAt: effective.publishedAt }
          : null
      });
    }
    res.json(result);
  } catch (err) { next(err); }
});

/** 绑定策略：follow（跟随最新发布）或 pin（固定版本） */
projectsRouter.put("/:id/binding", requireAuth, async (req, res, next) => {
  try {
    const schema = z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("follow") }),
      z.object({ mode: z.literal("pin"), versionId: z.string().min(1) })
    ]);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("绑定参数不正确：mode 为 follow，或 pin + versionId");

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw notFound("项目不存在");

    let pinnedVersionId: string | null = null;
    if (parsed.data.mode === "pin") {
      const target = await prisma.brandVersion.findUnique({ where: { id: parsed.data.versionId } });
      if (!target || target.status !== "published") {
        throw badRequest("只能固定到已发布的品牌版本");
      }
      pinnedVersionId = target.id;
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { bindMode: parsed.data.mode, pinnedVersionId }
    });
    await prisma.auditLog.create({
      data: {
        actor: req.user!.username,
        action: "bind",
        detail: { project: project.slug, mode: parsed.data.mode, pinnedVersionId }
      }
    });
    logger.info("project_binding_changed", { project: project.slug, mode: parsed.data.mode, pinnedVersionId, actor: req.user!.username });
    res.json(updated);
  } catch (err) { next(err); }
});

/** 项目当前生效版本（网页据此显示“实际生效版本”） */
projectsRouter.get("/:slug/effective", async (req, res, next) => {
  try {
    const project = await loadProjectBySlug(req.params.slug);
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");
    res.setHeader("Cache-Control", "no-cache");
    res.json({
      project: { slug: project.slug, name: project.name, bindMode: project.bindMode, pinnedVersionId: project.pinnedVersionId },
      version: {
        id: effective.id,
        version: effective.version,
        contentHash: effective.contentHash,
        publishedAt: effective.publishedAt
      }
    });
  } catch (err) { next(err); }
});

/**
 * 运行时受约束变量：仅输出白名单 --brand-* CSS 变量（值已通过服务端校验），
 * ETag + 短缓存保证一致性；CSP 下同源加载，不接受任何内联脚本。
 */
projectsRouter.get("/:slug/theme.css", async (req, res, next) => {
  try {
    const project = await loadProjectBySlug(req.params.slug);
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");
    const validation = resolvedOf(effective.tokens);
    const css = generateRuntimeCss(validation.resolved, {
      version: effective.version,
      contentHash: effective.contentHash
    });
    const etag = `"bvt-${effective.id}-${effective.contentHash.slice(0, 12)}"`;
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    res.send(css);
  } catch (err) { next(err); }
});

/**
 * 导出预览：必须与网页资源同版本。
 * versionId 与项目当前生效版本不一致 → 409 VERSION_MISMATCH，
 * 保证“生成前端资源与导出预览所需样式来自同一版本”。
 */
projectsRouter.get("/:slug/export-preview", async (req, res, next) => {
  try {
    const project = await loadProjectBySlug(req.params.slug);
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");

    const requested = typeof req.query.versionId === "string" ? req.query.versionId : undefined;
    if (requested && requested !== effective.id) {
      throw conflict("VERSION_MISMATCH", "导出预览请求的版本与项目当前生效版本不一致", {
        effectiveVersionId: effective.id,
        effectiveVersion: effective.version
      });
    }

    const validation = resolvedOf(effective.tokens);
    const subtitles = await subtitlesOf(project, effective);
    res.setHeader("Cache-Control", "no-cache");
    res.json({
      project: { slug: project.slug, name: project.name },
      version: {
        id: effective.id,
        version: effective.version,
        contentHash: effective.contentHash,
        publishedAt: effective.publishedAt
      },
      cssVariables: toCssVars(validation.resolved),
      contrast: validation.contrast,
      subtitles
    });
  } catch (err) { next(err); }
});

/** 成片字幕列表（含审批状态推导） */
projectsRouter.get("/:slug/subtitles", requireAuth, async (req, res, next) => {
  try {
    const project = await loadProjectBySlug(req.params.slug);
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");
    res.json({
      effectiveVersion: { id: effective.id, version: effective.version },
      subtitles: await subtitlesOf(project, effective)
    });
  } catch (err) { next(err); }
});

/** 登记成片字幕：以当前生效版本批准并固化颜色快照 */
projectsRouter.post("/:slug/subtitles", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ content: z.string().min(1).max(200) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("字幕内容不能为空且不超过 200 字");

    const project = await loadProjectBySlug(req.params.slug);
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");
    const validation = resolvedOf(effective.tokens);
    const subtitleColor = validation.resolved["export.subtitle.color"];
    if (typeof subtitleColor !== "string") throw conflict("TOKENS_INVALID", "当前版本缺少 export.subtitle.color 令牌");

    const row = await prisma.subtitleApproval.create({
      data: {
        projectId: project.id,
        content: parsed.data.content,
        approvedVersionId: effective.id,
        snapshotColor: subtitleColor,
        approvedBy: req.user!.username
      }
    });
    await prisma.auditLog.create({
      data: {
        actor: req.user!.username,
        action: "approve_subtitle",
        detail: { subtitleId: row.id, project: project.slug, versionId: effective.id, snapshotColor: subtitleColor }
      }
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
});
