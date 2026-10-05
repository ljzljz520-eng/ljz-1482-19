/**
 * HTTP 层冒烟测试（npm run smoke）：以内存数据替身替换 Prisma 单例的方法，
 * 真实走 Express 路由/中间件/服务层，覆盖验收场景：
 *   别名互指、暗色背景对比不足、两个管理员并发发布、导出预览版本一致性、
 *   字幕颜色冻结与复核、follow/pin 绑定、运行时 theme.css、安全注入拒绝。
 * 持久层本身由 Prisma + MySQL 在 Docker 环境中保证。
 */
process.env.DATABASE_URL ||= "mysql://root:root@localhost:3306/brandspec";
process.env.JWT_SECRET ||= "smoke-secret";

import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { DEFAULT_TOKENS, BRAND_NAME } from "./brand/defaults";
import { validateTokenTree } from "./brand/validate";
import { generateArtifactCss } from "./brand/cssgen";
import { contentHashOfResolved } from "./services/brandService";
import { createApp } from "./app";

/* ---------- 内存数据替身 ---------- */
let seq = 0;
const nid = () => `id_${++seq}`;

const v1Validation = validateTokenTree(DEFAULT_TOKENS);
const v1Hash = contentHashOfResolved(v1Validation.resolved);

const db = {
  admins: [{ id: "u1", username: "admin", passwordHash: bcrypt.hashSync("123456", 10), createdAt: new Date() }],
  versions: [
    {
      id: "v1", name: BRAND_NAME, version: "1.0.0", status: "published", revision: 2,
      tokens: DEFAULT_TOKENS, contentHash: v1Hash,
      artifactCss: generateArtifactCss(v1Validation.resolved, { version: "1.0.0", contentHash: v1Hash, publishedAt: new Date().toISOString() }),
      createdBy: "seed", createdAt: new Date(), publishedAt: new Date()
    },
    {
      id: "v2", name: BRAND_NAME, version: "1.1.0", status: "draft", revision: 1,
      tokens: JSON.parse(JSON.stringify(DEFAULT_TOKENS)), contentHash: "",
      artifactCss: null, createdBy: "seed", createdAt: new Date(), publishedAt: null
    }
  ] as any[],
  projects: [
    { id: "p1", slug: "yunxi-park", name: "云溪公园官网", bindMode: "follow", pinnedVersionId: null, createdAt: new Date(), updatedAt: new Date() }
  ] as any[],
  subtitles: [
    { id: "s1", projectId: "p1", content: "湖光栈道夜游宣传片 · 成片字幕", approvedVersionId: "v1", snapshotColor: "#FFE08A", approvedBy: "admin", approvedAt: new Date() }
  ] as any[],
  audits: [] as any[]
};

const clone = <T>(v: T): T => {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (Array.isArray(v)) return v.map((x) => clone(x)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = clone(val);
  return out as T;
};

function applyUpdate(row: any, data: any) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as any)) row[k] += (v as any).increment;
    else (row as any)[k] = v;
  }
}

const fake = {
  adminUser: {
    findUnique: async ({ where }: any) => clone(db.admins.find((a) => a.username === where.username) ?? null)
  },
  brandVersion: {
    findUnique: async ({ where }: any) => clone(db.versions.find((v) => v.id === where.id) ?? null),
    findFirst: async ({ where, orderBy }: any = {}) => {
      let rows = db.versions;
      if (where?.status) rows = rows.filter((v) => v.status === where.status);
      if (where?.name) rows = rows.filter((v) => v.name === where.name);
      if (where?.version) rows = rows.filter((v) => v.version === where.version);
      rows = [...rows].sort((a, b) => (b.publishedAt?.getTime?.() ?? 0) - (a.publishedAt?.getTime?.() ?? 0));
      return clone(rows[0] ?? null);
    },
    findMany: async ({ where, select }: any = {}) => {
      let rows = db.versions;
      if (where?.status) rows = rows.filter((v) => v.status === where.status);
      if (where?.id?.in) rows = rows.filter((v) => where.id.in.includes(v.id));
      const out = rows.map((r) => {
        if (!select) return clone(r);
        const o: any = {};
        for (const k of Object.keys(select)) if (select[k]) o[k] = r[k];
        return o;
      });
      return clone(out);
    },
    create: async ({ data }: any) => {
      if (db.versions.some((v) => v.name === data.name && v.version === data.version)) {
        const err: any = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      const row = { id: nid(), revision: 1, status: "draft", contentHash: "", artifactCss: null, createdAt: new Date(), publishedAt: null, ...clone(data) };
      db.versions.push(row);
      return clone(row);
    },
    updateMany: async ({ where, data }: any) => {
      const row = db.versions.find(
        (v) => v.id === where.id && (where.revision === undefined || v.revision === where.revision) && (where.status === undefined || v.status === where.status)
      );
      if (!row) return { count: 0 };
      applyUpdate(row, clone(data));
      return { count: 1 };
    },
    findUniqueOrThrow: async ({ where }: any) => {
      const row = db.versions.find((v) => v.id === where.id);
      if (!row) throw new Error("not found");
      return clone(row);
    }
  },
  project: {
    findUnique: async ({ where }: any) => clone(db.projects.find((p) => p.id === where.id || p.slug === where.slug) ?? null),
    findMany: async () => clone(db.projects),
    create: async ({ data }: any) => {
      const row = { id: nid(), createdAt: new Date(), updatedAt: new Date(), ...clone(data) };
      db.projects.push(row);
      return clone(row);
    },
    update: async ({ where, data }: any) => {
      const row = db.projects.find((p) => p.id === where.id);
      Object.assign(row, clone(data));
      return clone(row);
    }
  },
  subtitleApproval: {
    findMany: async ({ where }: any) => clone(db.subtitles.filter((s) => s.projectId === where.projectId)),
    findUnique: async ({ where }: any) => clone(db.subtitles.find((s) => s.id === where.id) ?? null),
    create: async ({ data }: any) => {
      const row = { id: nid(), approvedAt: new Date(), ...clone(data) };
      db.subtitles.push(row);
      return clone(row);
    },
    createMany: async ({ data }: any) => {
      for (const d of data) db.subtitles.push({ id: nid(), approvedAt: new Date(), ...clone(d) });
      return { count: data.length };
    },
    update: async ({ where, data }: any) => {
      const row = db.subtitles.find((s) => s.id === where.id);
      Object.assign(row, clone(data));
      return clone(row);
    },
    count: async ({ where }: any) => db.subtitles.filter((s) => !where?.projectId || s.projectId === where.projectId).length
  },
  auditLog: {
    create: async ({ data }: any) => {
      db.audits.push({ id: nid(), createdAt: new Date(), ...clone(data) });
      return {};
    }
  },
  $transaction: async (fn: any) => fn(fake),
  $queryRaw: async () => [{ 1: 1 }]
};

Object.assign(prisma as any, fake);

/* ---------- 测试执行 ---------- */
const results: { name: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function main() {
  const app = createApp();
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const req = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* css 等非 JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  // 健康检查
  const health = await req("GET", "/api/health");
  check("健康检查", health.status === 200 && health.json.status === "ok");

  // 登录
  const login = await req("POST", "/api/auth/login", { username: "admin", password: "123456" });
  check("管理员登录", login.status === 200 && !!login.json.token);
  const token = login.json.token;

  const badLogin = await req("POST", "/api/auth/login", { username: "admin", password: "wrong" });
  check("错误密码被拒绝 401", badLogin.status === 401);

  // 未授权访问
  const noAuth = await req("GET", "/api/brands");
  check("未登录访问管理接口被拒绝 401", noAuth.status === 401);

  // 校验：别名互指
  const cycTokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
  cycTokens.color.primary = { alias: "color.accent" };
  cycTokens.color.accent = { alias: "color.primary" };
  const cyc = await req("POST", "/api/brands/validate", { tokens: cycTokens }, token);
  check("验收·别名互指 → ALIAS_CYCLE", cyc.json.issues?.some((i: any) => i.code === "ALIAS_CYCLE"));

  // 校验：暗色背景对比不足
  const darkTokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
  darkTokens.export.subtitle.color = "#1F2937";
  const dark = await req("POST", "/api/brands/validate", { tokens: darkTokens }, token);
  check(
    "验收·暗色背景字幕对比不足 → CONTRAST_TOO_LOW",
    dark.json.issues?.some((i: any) => i.code === "CONTRAST_TOO_LOW" && i.path === "export.subtitle.color")
  );

  // 校验：脚本注入
  const evilTokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
  evilTokens.color.primary = "#fff; }</style><script>alert(1)</script>";
  const evil = await req("POST", "/api/brands/validate", { tokens: evilTokens }, token);
  check("安全·任意脚本作为主题配置被拒绝", evil.json.issues?.length > 0);

  // 保存草稿（合法修改：改强调色）
  const draftTokens = JSON.parse(JSON.stringify(DEFAULT_TOKENS));
  draftTokens.color.accent = "#F97316";
  draftTokens.export.subtitle.color = "#FFF7ED"; // 新版本字幕色（更浅）
  const save = await req("PUT", "/api/brands/v2", { tokens: draftTokens, expectedRevision: 1 }, token);
  check("保存草稿（revision 1→2）", save.status === 200 && save.json.revision === 2);

  // 过期 revision 保存 → 409
  const stale = await req("PUT", "/api/brands/v2", { tokens: draftTokens, expectedRevision: 1 }, token);
  check("过期修订号保存 → 409 STALE_REVISION", stale.status === 409 && stale.json.code === "STALE_REVISION");

  // 非法令牌保存 → 422
  const badSave = await req("PUT", "/api/brands/v2", { tokens: darkTokens, expectedRevision: 2 }, token);
  check("非法令牌保存 → 422 + issues", badSave.status === 422 && badSave.json.issues.length > 0);

  // 验收：两个管理员并发发布（同一 revision）
  const [pub1, pub2] = await Promise.all([
    req("POST", "/api/brands/v2/publish", { expectedRevision: 2 }, token),
    req("POST", "/api/brands/v2/publish", { expectedRevision: 2 }, token)
  ]);
  const statuses = [pub1.status, pub2.status].sort();
  check(
    "验收·两个管理员并发发布 → 一个 200 一个 409",
    statuses[0] === 200 && statuses[1] === 409,
    `实际: ${statuses.join(", ")}`
  );

  // 发布后 follow 项目生效版本升级
  const eff = await req("GET", "/api/projects/yunxi-park/effective");
  check("follow 项目生效版本升级到 v1.1.0", eff.json.version?.version === "1.1.0");

  // 运行时 theme.css：仅变量、带 ETag
  const css = await req("GET", "/api/projects/yunxi-park/theme.css");
  check(
    "运行时 theme.css 仅含受约束变量",
    css.status === 200 &&
      css.text.includes("--brand-button-primary-bg") &&
      !css.text.includes("<") &&
      (css.headers.get("content-type") ?? "").includes("text/css")
  );
  check("theme.css 携带 ETag 与缓存策略", !!css.headers.get("etag") && (css.headers.get("cache-control") ?? "").includes("max-age"));

  // 验收：导出预览版本一致性
  const mismatch = await req("GET", "/api/projects/yunxi-park/export-preview?versionId=v1");
  check("验收·导出预览版本不一致 → 409 VERSION_MISMATCH", mismatch.status === 409 && mismatch.json.code === "VERSION_MISMATCH");

  const matched = await req("GET", `/api/projects/yunxi-park/export-preview?versionId=${eff.json.version.id}`);
  check(
    "导出预览与网页同版本（hash 一致）",
    matched.status === 200 && matched.json.version.contentHash === eff.json.version.contentHash
  );

  // 验收：已批准字幕颜色在品牌升级后不变（冻结快照 + 待复核）
  const subAfterUpgrade = matched.json.subtitles.find((s: any) => s.id === "s1");
  check(
    "验收·品牌升级后已批准字幕颜色不变（#FFE08A）且状态为待复核",
    subAfterUpgrade?.color === "#FFE08A" && subAfterUpgrade?.status === "needs_review"
  );

  // 复核后字幕色更新为新版本色
  const review = await req("POST", "/api/subtitles/s1/review", {}, token);
  check("复核后字幕快照更新到新版本", review.status === 200);
  const subs2 = await req("GET", "/api/projects/yunxi-park/subtitles", undefined, token);
  const s1 = subs2.json.subtitles.find((s: any) => s.id === "s1");
  check("复核后状态恢复已批准、颜色变为 #FFF7ED", s1?.status === "approved" && s1?.color === "#FFF7ED");

  // pin 绑定：固定回 v1
  const pin = await req("PUT", "/api/projects/p1/binding", { mode: "pin", versionId: "v1" }, token);
  check("项目固定到 v1.0.0", pin.status === 200 && pin.json.bindMode === "pin");
  const effPin = await req("GET", "/api/projects/yunxi-park/effective");
  check("pin 后生效版本回退 v1.0.0", effPin.json.version?.version === "1.0.0");

  // pin 到草稿 → 400
  const pinDraft = await req("PUT", "/api/projects/p1/binding", { mode: "pin", versionId: "v3-nonexist" }, token);
  check("固定到不存在/未发布版本 → 400", pinDraft.status === 400);

  // 回到 follow
  await req("PUT", "/api/projects/p1/binding", { mode: "follow" }, token);
  const effFollow = await req("GET", "/api/projects/yunxi-park/effective");
  check("恢复 follow 后生效 v1.1.0", effFollow.json.version?.version === "1.1.0");

  // 编译时产物：内容寻址 + immutable 缓存
  const asset = await req("GET", `/api/brands/${effFollow.json.version.id}/asset.css`);
  check(
    "编译时产物 asset.css 可获取且 immutable 缓存",
    asset.status === 200 && asset.text.includes("--brand-button-primary-bg") && (asset.headers.get("cache-control") ?? "").includes("immutable")
  );

  // 重复发布 → 409
  const repub = await req("POST", "/api/brands/v2/publish", { expectedRevision: 3 }, token);
  check("重复发布已发布版本 → 409", repub.status === 409);

  // CSP/安全头
  check("API 安全响应头", health.headers.get("x-content-type-options") === "nosniff");

  server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("smoke 测试执行失败:", err);
  process.exit(1);
});
