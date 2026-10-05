import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { conflict, notFound } from "../errors";
import { effectiveVersionOf } from "../services/brandService";
import { validateTokenTree } from "../brand/validate";
import { logger } from "../logger";

export const subtitlesRouter = Router();

/**
 * 复核：把已批准字幕迁移到项目当前生效版本。
 * 只有复核后，字幕颜色快照才更新为新品牌色 —— 未复核前导出始终使用旧快照色。
 */
subtitlesRouter.post("/:id/review", requireAuth, async (req, res, next) => {
  try {
    const subtitle = await prisma.subtitleApproval.findUnique({ where: { id: req.params.id } });
    if (!subtitle) throw notFound("字幕不存在");
    const project = await prisma.project.findUnique({ where: { id: subtitle.projectId } });
    if (!project) throw notFound("项目不存在");
    const effective = await effectiveVersionOf(project);
    if (!effective) throw notFound("当前没有已发布的品牌版本");

    if (subtitle.approvedVersionId === effective.id) {
      throw conflict("ALREADY_CURRENT", "该字幕已基于当前生效版本批准，无需复核");
    }

    const validation = validateTokenTree(effective.tokens);
    const newColor = validation.resolved["export.subtitle.color"];
    if (typeof newColor !== "string") throw conflict("TOKENS_INVALID", "当前版本缺少 export.subtitle.color 令牌");

    const updated = await prisma.subtitleApproval.update({
      where: { id: subtitle.id },
      data: {
        approvedVersionId: effective.id,
        snapshotColor: newColor,
        approvedBy: req.user!.username,
        approvedAt: new Date()
      }
    });
    await prisma.auditLog.create({
      data: {
        actor: req.user!.username,
        action: "review",
        detail: { subtitleId: subtitle.id, project: project.slug, fromVersion: subtitle.approvedVersionId, toVersion: effective.id, newColor }
      }
    });
    logger.info("subtitle_reviewed", { subtitleId: subtitle.id, actor: req.user!.username });
    res.json(updated);
  } catch (err) { next(err); }
});
