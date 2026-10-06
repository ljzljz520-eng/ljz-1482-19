import { DataSource } from "typeorm";
import { Asset, Brand, BrandVersion, Project } from "./entities/entities";
import { DEFAULT_TOKENS } from "./tokens/schema";
import { validateTheme } from "./tokens/validate";
import { compileCss, cssHashOf, tokenHashOf } from "./tokens/cssgen";
import { pickTokens } from "./services/brandService";
import logger from "./logger";

/** 幂等种子：库为空时写入演示品牌、版本、项目与素材 */
export async function seed(ds: DataSource): Promise<void> {
  const brandRepo = ds.getRepository(Brand);
  if ((await brandRepo.count()) > 0) {
    logger.info("seed skipped: database not empty");
    return;
  }

  const brand = await brandRepo.save(brandRepo.create({ slug: "yunxi", name: "云溪品牌规范" }));

  const { values, hasErrors, issues } = validateTheme(DEFAULT_TOKENS);
  if (hasErrors) {
    logger.error("seed default tokens invalid", { issues });
    throw new Error("默认令牌校验失败，请检查种子数据");
  }
  const tokenHash = tokenHashOf(DEFAULT_TOKENS);
  const css = compileCss(values, { brandSlug: brand.slug, versionNumber: 1, tokenHash });

  const versionRepo = ds.getRepository(BrandVersion);
  const v1 = await versionRepo.save(
    versionRepo.create({
      brandId: brand.id,
      versionNumber: 1,
      status: "published",
      tokens: { ...DEFAULT_TOKENS },
      note: "初始品牌规范",
      tokenHash,
      compiledCss: css,
      cssHash: cssHashOf(css),
      createdBy: "seed",
      publishedAt: new Date()
    })
  );

  const projectRepo = ds.getRepository(Project);
  const official = await projectRepo.save(
    projectRepo.create({ slug: "official-site", name: "云溪官网", brandId: brand.id, bindingMode: "follow" })
  );
  const kiosk = await projectRepo.save(
    projectRepo.create({ slug: "kiosk-screen", name: "园区导览屏", brandId: brand.id, bindingMode: "pin", pinnedVersionId: v1.id })
  );

  const assetRepo = ds.getRepository(Asset);
  await assetRepo.save(
    assetRepo.create({
      projectId: official.id,
      name: "《云溪四季》成片字幕",
      kind: "subtitle",
      watchedTokens: ["export.subtitle.fg", "export.subtitle.bg"],
      tokenSnapshot: pickTokens(values, ["export.subtitle.fg", "export.subtitle.bg"]),
      approvedVersionId: v1.id,
      reviewStatus: "approved"
    })
  );
  await assetRepo.save(
    assetRepo.create({
      projectId: kiosk.id,
      name: "导览屏导出角标",
      kind: "badge",
      watchedTokens: ["export.badge.bg", "export.badge.fg", "export.badge.border"],
      tokenSnapshot: pickTokens(values, ["export.badge.bg", "export.badge.fg", "export.badge.border"]),
      approvedVersionId: v1.id,
      reviewStatus: "approved"
    })
  );

  logger.info("seed completed", { brand: brand.slug, version: 1 });
}
