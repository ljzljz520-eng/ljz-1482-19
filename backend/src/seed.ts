/**
 * 幂等种子：管理员账号、默认品牌 v1.0.0（已发布）、演示草稿 v1.1.0、
 * 云溪公园项目（follow 模式）与两条成片字幕审批记录。
 */
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { DEFAULT_TOKENS, BRAND_NAME } from "./brand/defaults";
import { validateTokenTree } from "./brand/validate";
import { generateArtifactCss } from "./brand/cssgen";
import { contentHashOfResolved } from "./services/brandService";

export async function ensureSeed(): Promise<void> {
  // 1) 管理员
  const admin = await prisma.adminUser.findUnique({ where: { username: "admin" } });
  if (!admin) {
    await prisma.adminUser.create({
      data: { username: "admin", passwordHash: bcrypt.hashSync("123456", 10) }
    });
    logger.info("seed_admin_created", { username: "admin" });
  }

  // 2) 默认品牌 v1.0.0（已发布）
  let v1 = await prisma.brandVersion.findFirst({ where: { name: BRAND_NAME, version: "1.0.0" } });
  if (!v1) {
    const validation = validateTokenTree(DEFAULT_TOKENS);
    if (!validation.ok) {
      throw new Error(`内置默认令牌未通过校验: ${JSON.stringify(validation.issues)}`);
    }
    const contentHash = contentHashOfResolved(validation.resolved);
    v1 = await prisma.brandVersion.create({
      data: {
        name: BRAND_NAME,
        version: "1.0.0",
        status: "published",
        tokens: DEFAULT_TOKENS as unknown as Prisma.JsonObject,
        contentHash,
        artifactCss: generateArtifactCss(validation.resolved, {
          version: "1.0.0",
          contentHash,
          publishedAt: new Date().toISOString()
        }),
        createdBy: "seed",
        publishedAt: new Date()
      }
    });
    logger.info("seed_brand_published", { version: "1.0.0", contentHash });
  }

  // 3) 演示草稿 v1.1.0（供 QA 直接体验编辑/校验/发布流程）
  const draft = await prisma.brandVersion.findFirst({ where: { name: BRAND_NAME, version: "1.1.0" } });
  if (!draft) {
    const tokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS)) as Record<string, unknown>;
    (tokens.color as Record<string, unknown>).accent = "#F97316";
    await prisma.brandVersion.create({
      data: {
        name: BRAND_NAME,
        version: "1.1.0",
        status: "draft",
        tokens: tokens as Prisma.JsonObject,
        createdBy: "seed"
      }
    });
    logger.info("seed_draft_created", { version: "1.1.0" });
  }

  // 4) 云溪公园项目（follow 模式）
  let project = await prisma.project.findUnique({ where: { slug: "yunxi-park" } });
  if (!project) {
    project = await prisma.project.create({
      data: { slug: "yunxi-park", name: "云溪公园官网", bindMode: "follow" }
    });
    logger.info("seed_project_created", { slug: "yunxi-park" });
  }

  // 5) 成片字幕审批（基于 v1.0.0 批准，颜色快照固化）
  const subtitleCount = await prisma.subtitleApproval.count({ where: { projectId: project.id } });
  if (subtitleCount === 0) {
    const validation = validateTokenTree(v1.tokens);
    const color = String(validation.resolved["export.subtitle.color"]);
    await prisma.subtitleApproval.createMany({
      data: [
        {
          projectId: project.id,
          content: "湖光栈道夜游宣传片 · 成片字幕",
          approvedVersionId: v1.id,
          snapshotColor: color,
          approvedBy: "admin"
        },
        {
          projectId: project.id,
          content: "森林书屋品牌短片 · 成片字幕",
          approvedVersionId: v1.id,
          snapshotColor: color,
          approvedBy: "admin"
        }
      ]
    });
    logger.info("seed_subtitles_created", { count: 2 });
  }
}
