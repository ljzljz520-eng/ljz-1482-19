import { DataSource, EntityManager } from "typeorm";
import { Asset, Brand, BrandVersion, Project, PublishEvent } from "../entities/entities";
import { DEFAULT_TOKENS, TOKEN_DEFS } from "../tokens/schema";
import { validateTheme } from "../tokens/validate";
import { resolveTokens } from "../tokens/resolve";
import { buildRuntimeCss, compileCss, cssHashOf, StyleBuildError, tokenHashOf } from "../tokens/cssgen";
import { ALIAS_PATTERN } from "../tokens/sanitize";
import { ApiError, isUniqueViolation } from "./errors";
import logger from "../logger";

export function pickTokens(values: Record<string, string>, paths: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paths) out[p] = values[p];
  return out;
}

async function recordEvent(
  em: EntityManager,
  brandId: string,
  versionId: string | null,
  actor: string,
  result: string,
  detail?: string
): Promise<void> {
  await em.save(em.create(PublishEvent, { brandId, versionId, actor, result, detail: detail ?? null }));
}

export async function listBrands(ds: DataSource) {
  const brands = await ds.getRepository(Brand).find({ order: { createdAt: "ASC" } });
  const versionRepo = ds.getRepository(BrandVersion);
  return Promise.all(
    brands.map(async (b) => {
      const latest = await versionRepo.findOne({
        where: { brandId: b.id, status: "published" },
        order: { versionNumber: "DESC" }
      });
      return { ...b, latestPublished: latest ?? null };
    })
  );
}

export async function getBrandDetail(ds: DataSource, brandId: string) {
  const brand = await ds.getRepository(Brand).findOne({ where: { id: brandId } });
  if (!brand) throw new ApiError(404, "NOT_FOUND", "品牌不存在");
  const versions = await ds.getRepository(BrandVersion).find({
    where: { brandId },
    order: { createdAt: "DESC" }
  });
  const draft = versions.find((v) => v.status === "draft") ?? null;
  return { ...brand, versions, draft };
}

export async function createDraft(ds: DataSource, brandId: string, baseVersionId: string | undefined, actor: string) {
  const brand = await ds.getRepository(Brand).findOne({ where: { id: brandId } });
  if (!brand) throw new ApiError(404, "NOT_FOUND", "品牌不存在");
  const repo = ds.getRepository(BrandVersion);
  let baseTokens: Record<string, string> = { ...DEFAULT_TOKENS };
  if (baseVersionId) {
    const base = await repo.findOne({ where: { id: baseVersionId, brandId } });
    if (!base) throw new ApiError(404, "NOT_FOUND", "基准版本不存在");
    baseTokens = { ...base.tokens };
  } else {
    const latest = await repo.findOne({ where: { brandId, status: "published" }, order: { versionNumber: "DESC" } });
    if (latest) baseTokens = { ...latest.tokens };
  }
  const draft = repo.create({
    brandId,
    status: "draft",
    versionNumber: null,
    tokens: baseTokens,
    note: null,
    createdBy: actor
  });
  return repo.save(draft);
}

export async function getVersion(ds: DataSource, versionId: string) {
  const version = await ds.getRepository(BrandVersion).findOne({ where: { id: versionId } });
  if (!version) throw new ApiError(404, "NOT_FOUND", "版本不存在");
  const { issues } = validateTheme(version.tokens);
  return { ...version, issues };
}

export async function saveDraft(
  ds: DataSource,
  versionId: string,
  tokens: Record<string, string>,
  note: string | null,
  lockVersion: number,
  actor: string
) {
  const repo = ds.getRepository(BrandVersion);
  const draft = await repo.findOne({ where: { id: versionId } });
  if (!draft) throw new ApiError(404, "NOT_FOUND", "版本不存在");
  if (draft.status !== "draft") throw new ApiError(409, "VERSION_CONFLICT", "该版本已发布，不能再编辑");
  // 保存前做硬校验：含错误的令牌组合不允许落库
  const { hasErrors, issues } = validateTheme(tokens);
  if (hasErrors) {
    throw new ApiError(422, "VALIDATION_FAILED", "令牌校验未通过，已拒绝保存", issues);
  }
  // 原子 compare-and-set：仅当锁版本与状态同时匹配才更新，并发安全
  const result = await ds
    .createQueryBuilder()
    .update(BrandVersion)
    .set({ tokens, note, createdBy: actor, lockVersion: () => "lockVersion + 1" })
    .where("id = :id AND lockVersion = :lockVersion AND status = 'draft'", { id: versionId, lockVersion })
    .execute();
  if (!result.affected) {
    await recordEvent(ds.manager, draft.brandId, draft.id, actor, "conflict", "保存草稿时锁版本不匹配");
    throw new ApiError(409, "VERSION_CONFLICT", "草稿已被他人修改，请刷新后重试");
  }
  return repo.findOneByOrFail({ id: versionId });
}

const EVENT_BY_CODE: Record<string, string> = {
  VERSION_CONFLICT: "conflict",
  VALIDATION_FAILED: "validation_failed",
  STYLE_BUILD_FAILED: "build_failed"
};

export async function publishVersion(
  ds: DataSource,
  versionId: string,
  expectedLockVersion: number,
  actor: string,
  compileFn: typeof compileCss = compileCss
) {
  const pre = await ds.getRepository(BrandVersion).findOne({ where: { id: versionId } });
  const brandId = pre?.brandId ?? "unknown";
  try {
    return await ds.transaction(async (em) => {
    const repo = em.getRepository(BrandVersion);
    const draft = await repo.findOne({ where: { id: versionId } });
    if (!draft) throw new ApiError(404, "NOT_FOUND", "版本不存在");
    if (draft.status !== "draft") {
      throw new ApiError(409, "VERSION_CONFLICT", "该版本已发布，可能由其他管理员完成");
    }
    if (draft.lockVersion !== expectedLockVersion) {
      throw new ApiError(409, "VERSION_CONFLICT", "草稿已被他人修改，请刷新后重试");
    }

    // 1. 校验（别名循环 / 缺项 / 对比度 / 系统保护 / 安全）
    const { issues, values, hasErrors } = validateTheme(draft.tokens);
    if (hasErrors) {
      throw new ApiError(422, "VALIDATION_FAILED", "令牌校验未通过，无法发布", issues);
    }

    // 2. 构建编译期样式产物 —— 失败则整体回滚，版本保持草稿
    const tokenHash = tokenHashOf(draft.tokens);
    const brand = await em.getRepository(Brand).findOne({ where: { id: draft.brandId } });
    let css: string;
    try {
      css = compileFn(values, { brandSlug: brand?.slug ?? "brand", versionNumber: null, tokenHash });
    } catch (e) {
      const err = e as Error;
      if (e instanceof StyleBuildError) {
        throw new ApiError(500, "STYLE_BUILD_FAILED", `样式构建失败：${err.message}。版本未发布，线上仍使用上一版本。`);
      }
      throw e;
    }

    // 3. 分配版本号（唯一约束兜底并发）并落库
    const maxRaw = await repo
      .createQueryBuilder("v")
      .select("MAX(v.versionNumber)", "max")
      .where("v.brandId = :brandId", { brandId: draft.brandId })
      .getRawOne<{ max: number | null }>();
    const nextNumber = (maxRaw?.max ?? 0) + 1;

    const compiledCss = css.replace(`v${"draft"}`, `v${nextNumber}`);
    const cssHash = cssHashOf(compiledCss);
    // 原子 compare-and-set：锁版本 + 草稿状态同时匹配才完成发布迁移，
    // 两个管理员并发发布同一草稿时只有一人成功；唯一约束 (brandId, versionNumber) 兜底跨草稿竞争
    try {
      const cas = await em
        .createQueryBuilder()
        .update(BrandVersion)
        .set({
          status: "published",
          versionNumber: nextNumber,
          tokenHash,
          compiledCss,
          cssHash,
          publishedAt: new Date(),
          lockVersion: () => "lockVersion + 1"
        })
        .where("id = :id AND lockVersion = :lv AND status = 'draft'", { id: draft.id, lv: expectedLockVersion })
        .execute();
      if (!cas.affected) {
        throw new ApiError(409, "VERSION_CONFLICT", "并发发布冲突：另一管理员已先发布，请刷新后基于最新版本重新操作");
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (isUniqueViolation(e)) {
        throw new ApiError(409, "VERSION_CONFLICT", "并发发布冲突：版本号被占用，请刷新后基于最新版本重新操作");
      }
      throw e;
    }
    const published = await repo.findOneByOrFail({ id: draft.id });

    // 4. 跟随型项目的素材：快照与新解析值不一致 → 标记待复核（快照不变，已批准成片不漂移）
    const followProjects = await em.getRepository(Project).find({ where: { brandId: draft.brandId, bindingMode: "follow" } });
    let markedAssets = 0;
    for (const project of followProjects) {
      const assets = await em.getRepository(Asset).find({ where: { projectId: project.id } });
      for (const asset of assets) {
        const nextSnapshot = pickTokens(values, asset.watchedTokens);
        if (JSON.stringify(nextSnapshot) !== JSON.stringify(asset.tokenSnapshot)) {
          asset.reviewStatus = "needs_re_review";
          await em.getRepository(Asset).save(asset);
          markedAssets += 1;
        }
      }
    }

    await recordEvent(em, draft.brandId, published.id, actor, "published", `v${nextNumber}，${markedAssets} 个素材标记待复核`);
    logger.info("brand version published", { brandId: draft.brandId, version: nextNumber, actor, markedAssets });
    return published;
    });
  } catch (e) {
    // 事务已回滚：在此记录失败事件，保证审计不丢失
    if (e instanceof ApiError && EVENT_BY_CODE[e.code]) {
      await recordEvent(ds.manager, brandId, versionId, actor, EVENT_BY_CODE[e.code], e.message);
    }
    throw e;
  }
}

export async function resolveEffectiveVersion(ds: DataSource, project: Project): Promise<BrandVersion> {
  const repo = ds.getRepository(BrandVersion);
  if (project.bindingMode === "pin" && project.pinnedVersionId) {
    const pinned = await repo.findOne({ where: { id: project.pinnedVersionId } });
    if (pinned && pinned.status === "published") return pinned;
  }
  const latest = await repo.findOne({
    where: { brandId: project.brandId, status: "published" },
    order: { versionNumber: "DESC" }
  });
  if (!latest) throw new ApiError(404, "NO_PUBLISHED_VERSION", "该品牌尚未发布任何版本");
  return latest;
}

export async function getEffectiveTheme(ds: DataSource, projectSlug: string) {
  const project = await ds.getRepository(Project).findOne({ where: { slug: projectSlug } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "项目不存在");
  const version = await resolveEffectiveVersion(ds, project);
  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      bindingMode: project.bindingMode,
      pinnedVersionId: project.pinnedVersionId
    },
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      tokenHash: version.tokenHash,
      cssHash: version.cssHash,
      publishedAt: version.publishedAt
    },
    cssUrl: `/api/assets/brand-${version.cssHash}.css`,
    runtimeCssUrl: `/api/runtime/theme.css?project=${project.slug}`
  };
}

export async function listProjects(ds: DataSource) {
  const projects = await ds.getRepository(Project).find({ order: { createdAt: "ASC" } });
  return Promise.all(
    projects.map(async (p) => {
      const effective = await resolveEffectiveVersion(ds, p).catch(() => null);
      const pendingAssets = await ds.getRepository(Asset).count({ where: { projectId: p.id, reviewStatus: "needs_re_review" } });
      return {
        ...p,
        effectiveVersion: effective
          ? { id: effective.id, versionNumber: effective.versionNumber, cssHash: effective.cssHash, tokenHash: effective.tokenHash }
          : null,
        pendingAssets
      };
    })
  );
}

export async function setBinding(ds: DataSource, projectId: string, mode: "follow" | "pin", pinnedVersionId: string | null, actor: string) {
  const repo = ds.getRepository(Project);
  const project = await repo.findOne({ where: { id: projectId } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "项目不存在");
  if (mode === "pin") {
    if (!pinnedVersionId) throw new ApiError(400, "BAD_REQUEST", "固定模式必须指定版本");
    const version = await ds.getRepository(BrandVersion).findOne({ where: { id: pinnedVersionId } });
    if (!version || version.status !== "published" || version.brandId !== project.brandId) {
      throw new ApiError(400, "BAD_REQUEST", "只能固定到本品牌已发布的版本");
    }
    project.pinnedVersionId = pinnedVersionId;
  }
  project.bindingMode = mode;
  await repo.save(project);
  logger.info("project binding updated", { projectId, mode, pinnedVersionId, actor });
  return project;
}

export async function reapproveAsset(ds: DataSource, assetId: string, actor: string) {
  const assetRepo = ds.getRepository(Asset);
  const asset = await assetRepo.findOne({ where: { id: assetId } });
  if (!asset) throw new ApiError(404, "NOT_FOUND", "素材不存在");
  const project = await ds.getRepository(Project).findOne({ where: { id: asset.projectId } });
  if (!project) throw new ApiError(404, "NOT_FOUND", "素材所属项目不存在");
  const version = await resolveEffectiveVersion(ds, project);
  const { values, hasErrors } = validateTheme(version.tokens);
  if (hasErrors) throw new ApiError(500, "VERSION_INVALID", "当前生效版本令牌无效，无法复核");
  asset.tokenSnapshot = pickTokens(values, asset.watchedTokens);
  asset.approvedVersionId = version.id;
  asset.reviewStatus = "approved";
  await assetRepo.save(asset);
  logger.info("asset re-approved", { assetId, actor, versionId: version.id });
  return asset;
}

export function referenceGraphOf(version: BrandVersion) {
  const nodes = TOKEN_DEFS.map((d) => ({
    path: d.path,
    group: d.group,
    type: d.type,
    label: d.label,
    isSystem: !!d.isSystem
  }));
  const edges: { from: string; to: string }[] = [];
  for (const [path, raw] of Object.entries(version.tokens)) {
    const m = ALIAS_PATTERN.exec(String(raw).trim());
    if (m) edges.push({ from: path, to: m[1] });
  }
  const { issues } = resolveTokens(version.tokens);
  return { nodes, edges, issues: issues.filter((i) => i.code.startsWith("ALIAS")) };
}

export function exportPreviewOf(version: BrandVersion) {
  const { values, hasErrors, issues } = validateTheme(version.tokens);
  if (hasErrors) {
    throw new ApiError(422, "VALIDATION_FAILED", "版本校验未通过，无法生成导出预览", issues);
  }
  const tokenHash = tokenHashOf(version.tokens);
  const runtimeCss = buildRuntimeCss(values, { brandSlug: "brand", versionNumber: version.versionNumber, tokenHash });
  return {
    versionId: version.id,
    versionNumber: version.versionNumber,
    tokenHash,
    css: runtimeCss,
    inline: {
      exportBadge: {
        backgroundColor: values["export.badge.bg"],
        color: values["export.badge.fg"],
        border: `1px solid ${values["export.badge.border"]}`,
        borderRadius: values["export.badge.radius"]
      },
      subtitle: {
        color: values["export.subtitle.fg"],
        backgroundColor: values["export.subtitle.bg"]
      },
      primaryButton: {
        backgroundColor: values["editor.button.primary.bg"],
        color: values["editor.button.primary.fg"],
        borderRadius: values["editor.button.radius"]
      }
    }
  };
}
