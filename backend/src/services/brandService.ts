/**
 * 品牌版本核心服务：生效版本解析、发布事务（乐观锁防并发）、字幕审批联动。
 */
import { Prisma, BrandVersion, Project } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import { conflict, notFound, unprocessable } from "../errors";
import { validateTokenTree } from "../brand/validate";
import { generateArtifactCss } from "../brand/cssgen";

export function contentHashOfResolved(resolved: Record<string, string | number>): string {
  const canonical = JSON.stringify(
    Object.keys(resolved)
      .sort()
      .map((k) => [k, resolved[k]])
  );
  return createHash("sha256").update(canonical).digest("hex");
}

/** 项目当前生效版本：pin → 固定版本；follow → 最新已发布版本 */
export async function effectiveVersionOf(project: Project): Promise<BrandVersion | null> {
  if (project.bindMode === "pin" && project.pinnedVersionId) {
    const pinned = await prisma.brandVersion.findUnique({ where: { id: project.pinnedVersionId } });
    if (pinned && pinned.status === "published") return pinned;
    // pin 目标不可用（被归档/删除）时回退到最新发布，避免站点无样式
  }
  return prisma.brandVersion.findFirst({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });
}

/**
 * 发布：事务 + 乐观锁。
 * 两个管理员并发发布同一草稿时，updateMany 的 (id, revision, status) 条件只有一方命中，
 * 另一方 count=0 → 409 CONCURRENT_MODIFICATION，前端提示刷新后重试。
 */
export async function publishVersion(id: string, expectedRevision: number, actor: string) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.brandVersion.findUnique({ where: { id } });
    if (!draft) throw notFound("品牌版本不存在");
    if (draft.status !== "draft") {
      throw conflict("NOT_A_DRAFT", `版本 ${draft.version} 已是 ${draft.status} 状态，不能重复发布`);
    }
    if (draft.revision !== expectedRevision) {
      throw conflict("STALE_REVISION", "该草稿已被其他管理员修改，请刷新后重试", {
        currentRevision: draft.revision
      });
    }

    const validation = validateTokenTree(draft.tokens);
    if (!validation.ok) {
      throw unprocessable("品牌令牌校验失败，请修正后再发布", validation.issues);
    }

    const contentHash = contentHashOfResolved(validation.resolved);
    const artifactCss = generateArtifactCss(validation.resolved, {
      version: draft.version,
      contentHash,
      publishedAt: new Date().toISOString()
    });

    const updated = await tx.brandVersion.updateMany({
      where: { id, revision: expectedRevision, status: "draft" },
      data: {
        status: "published",
        publishedAt: new Date(),
        contentHash,
        artifactCss,
        revision: { increment: 1 }
      }
    });
    if (updated.count === 0) {
      throw conflict("CONCURRENT_MODIFICATION", "发布冲突：其他管理员已并发修改该版本", undefined);
    }

    await tx.auditLog.create({
      data: {
        actor,
        action: "publish",
        detail: { versionId: id, version: draft.version, contentHash } as Prisma.JsonObject
      }
    });

    return tx.brandVersion.findUniqueOrThrow({ where: { id } });
  });
}

/** 字幕视图：状态由“批准版本是否等于当前生效版本”动态推导 */
export interface SubtitleView {
  id: string;
  content: string;
  status: "approved" | "needs_review";
  /** 实际渲染色：永远是批准时刻的快照色，未复核前不随品牌升级变化 */
  color: string;
  approvedVersionId: string;
  approvedVersion: string;
  approvedAt: Date;
  approvedBy: string;
}

export async function subtitlesOf(project: Project, effective: BrandVersion): Promise<SubtitleView[]> {
  const rows = await prisma.subtitleApproval.findMany({
    where: { projectId: project.id },
    orderBy: { approvedAt: "asc" }
  });
  const versionIds = [...new Set(rows.map((r) => r.approvedVersionId))];
  const versions = await prisma.brandVersion.findMany({ where: { id: { in: versionIds } } });
  const versionMap = new Map(versions.map((v) => [v.id, v.version]));
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    status: r.approvedVersionId === effective.id ? "approved" : "needs_review",
    color: r.snapshotColor,
    approvedVersionId: r.approvedVersionId,
    approvedVersion: versionMap.get(r.approvedVersionId) ?? "未知版本",
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy
  }));
}
