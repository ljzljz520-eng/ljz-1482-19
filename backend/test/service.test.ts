import test from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { createDataSource } from "../src/data-source";
import { seed } from "../src/seed";
import * as svc from "../src/services/brandService";
import { ApiError } from "../src/services/errors";
import { Asset, Brand, BrandVersion, Project, PublishEvent } from "../src/entities/entities";
import { DEFAULT_TOKENS } from "../src/tokens/schema";
import { StyleBuildError } from "../src/tokens/cssgen";

async function freshDs(): Promise<DataSource> {
  const ds = createDataSource({ type: "sqljs" });
  await ds.initialize();
  await seed(ds);
  return ds;
}

async function getBrand(ds: DataSource) {
  const brand = await ds.getRepository(Brand).findOneOrFail({ where: { slug: "yunxi" } });
  return brand;
}

test("种子数据：v1 已发布，官网跟随、导览屏固定", async () => {
  const ds = await freshDs();
  const official = await svc.getEffectiveTheme(ds, "official-site");
  const kiosk = await svc.getEffectiveTheme(ds, "kiosk-screen");
  assert.equal(official.version.versionNumber, 1);
  assert.equal(kiosk.version.versionNumber, 1);
  assert.equal(official.project.bindingMode, "follow");
  assert.equal(kiosk.project.bindingMode, "pin");
  assert.match(official.cssUrl, /^\/api\/assets\/brand-[0-9a-f]{12}\.css$/);
  await ds.destroy();
});

test("发布后跟随型项目升级、固定型项目保持不变", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  draft.tokens["brand.primary"] = "#7C3AED";
  await svc.saveDraft(ds, draft.id, draft.tokens, "改主色", draft.lockVersion, "admin-a");
  const saved = await ds.getRepository(BrandVersion).findOneByOrFail({ id: draft.id });
  const published = await svc.publishVersion(ds, saved.id, saved.lockVersion, "admin-a");
  assert.equal(published.versionNumber, 2);

  const official = await svc.getEffectiveTheme(ds, "official-site");
  const kiosk = await svc.getEffectiveTheme(ds, "kiosk-screen");
  assert.equal(official.version.versionNumber, 2, "跟随型项目应升级到 v2");
  assert.equal(kiosk.version.versionNumber, 1, "固定型项目应保持 v1");
  await ds.destroy();
});

test("两个管理员并发发布同一草稿：后到者 409", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  // 管理员 A 保存一次（lockVersion 1 -> 2）
  await svc.saveDraft(ds, draft.id, draft.tokens, "A 的修改", 1, "admin-a");
  // 管理员 B 仍持有旧的 lockVersion=1，直接发布 -> 冲突
  await assert.rejects(
    svc.publishVersion(ds, draft.id, 1, "admin-b"),
    (e: ApiError) => e.status === 409 && e.code === "VERSION_CONFLICT"
  );
  // A 用最新锁发布成功
  const published = await svc.publishVersion(ds, draft.id, 2, "admin-a");
  assert.equal(published.versionNumber, 2);
  // B 再次尝试发布同一版本 -> 已发布，冲突
  await assert.rejects(
    svc.publishVersion(ds, draft.id, 2, "admin-b"),
    (e: ApiError) => e.status === 409
  );
  await ds.destroy();
});

test("两个管理员并发保存草稿：旧锁版本保存被拒绝", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  await svc.saveDraft(ds, draft.id, draft.tokens, null, 1, "admin-a");
  await assert.rejects(
    svc.saveDraft(ds, draft.id, draft.tokens, null, 1, "admin-b"),
    (e: ApiError) => e.status === 409
  );
  await ds.destroy();
});

test("数据库唯一约束兜底：同品牌版本号不可重复", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const repo = ds.getRepository(BrandVersion);
  const mk = () =>
    repo.create({ brandId: brand.id, versionNumber: 99, status: "published", tokens: { ...DEFAULT_TOKENS }, createdBy: "t" });
  await repo.save(mk());
  await assert.rejects(repo.save(mk()));
  await ds.destroy();
});

test("校验未通过的草稿不能发布（暗色对比不足）", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  const tokens = { ...draft.tokens, "export.badge.fg": "#1E293B" };
  // 保存也会被拒
  await assert.rejects(
    svc.saveDraft(ds, draft.id, tokens, null, 1, "admin-a"),
    (e: ApiError) => e.status === 422 && e.code === "VALIDATION_FAILED"
  );
  await ds.destroy();
});

test("构建样式失败：发布回滚，版本保持草稿并记录事件", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  const brokenCompile = () => {
    throw new StyleBuildError("模拟构建失败：产物超出大小限制");
  };
  await assert.rejects(
    svc.publishVersion(ds, draft.id, draft.lockVersion, "admin-a", brokenCompile),
    (e: ApiError) => e.status === 500 && e.code === "STYLE_BUILD_FAILED"
  );
  const after = await ds.getRepository(BrandVersion).findOneByOrFail({ id: draft.id });
  assert.equal(after.status, "draft", "构建失败后版本应保持草稿");
  assert.equal(after.versionNumber, null);
  const events = await ds.getRepository(PublishEvent).find();
  assert.ok(events.some((e: { result: string }) => e.result === "build_failed"));
  await ds.destroy();
});

test("品牌升级后已批准成片字幕颜色不漂移：快照保留 + 标记待复核 + 复核后更新", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const assetRepo = ds.getRepository(Asset);
  const official = await ds.getRepository(Project).findOneByOrFail({ slug: "official-site" });
  const before = await assetRepo.findOneByOrFail({ projectId: official.id });
  const oldSnapshot = { ...before.tokenSnapshot };
  assert.equal(before.reviewStatus, "approved");

  // 发布 v2：修改字幕颜色
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  draft.tokens["export.subtitle.fg"] = "#FDE68A";
  await svc.saveDraft(ds, draft.id, draft.tokens, "字幕改米色", draft.lockVersion, "admin-a");
  const saved = await ds.getRepository(BrandVersion).findOneByOrFail({ id: draft.id });
  await svc.publishVersion(ds, saved.id, saved.lockVersion, "admin-a");

  const after = await assetRepo.findOneByOrFail({ projectId: official.id });
  assert.equal(after.reviewStatus, "needs_re_review", "应标记待复核");
  assert.deepEqual(after.tokenSnapshot, oldSnapshot, "未复核前快照不得变化（已批准成片字幕颜色不漂移）");

  // 复核通过：快照更新到 v2 的解析值
  const reapproved = await svc.reapproveAsset(ds, after.id, "admin-b");
  assert.equal(reapproved.reviewStatus, "approved");
  assert.equal(reapproved.tokenSnapshot["export.subtitle.fg"], "#FDE68A");

  // 固定型项目的素材不受影响
  const kiosk = await ds.getRepository(Project).findOneByOrFail({ slug: "kiosk-screen" });
  const kioskAsset = await assetRepo.findOneByOrFail({ projectId: kiosk.id });
  assert.equal(kioskAsset.reviewStatus, "approved");
  await ds.destroy();
});

test("发布未改变素材关注的令牌时不触发复核", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const official = await ds.getRepository(Project).findOneByOrFail({ slug: "official-site" });
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  draft.tokens["steps.pending.fg"] = "#475569"; // 与字幕无关
  await svc.saveDraft(ds, draft.id, draft.tokens, null, draft.lockVersion, "admin-a");
  const saved = await ds.getRepository(BrandVersion).findOneByOrFail({ id: draft.id });
  await svc.publishVersion(ds, saved.id, saved.lockVersion, "admin-a");
  const asset = await ds.getRepository(Asset).findOneByOrFail({ projectId: official.id });
  assert.equal(asset.reviewStatus, "approved");
  await ds.destroy();
});

test("项目从固定切换为跟随后立即生效到最新版本", async () => {
  const ds = await freshDs();
  const brand = await getBrand(ds);
  const draft = await svc.createDraft(ds, brand.id, undefined, "admin-a");
  await svc.saveDraft(ds, draft.id, draft.tokens, null, draft.lockVersion, "admin-a");
  const saved = await ds.getRepository(BrandVersion).findOneByOrFail({ id: draft.id });
  await svc.publishVersion(ds, saved.id, saved.lockVersion, "admin-a");

  const kiosk = await ds.getRepository(Project).findOneByOrFail({ slug: "kiosk-screen" });
  await svc.setBinding(ds, kiosk.id, "follow", null, "admin-a");
  const effective = await svc.getEffectiveTheme(ds, "kiosk-screen");
  assert.equal(effective.version.versionNumber, 2);
  await ds.destroy();
});
