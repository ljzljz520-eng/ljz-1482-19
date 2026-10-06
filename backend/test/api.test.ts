import test from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { createDataSource } from "../src/data-source";
import { createApp } from "../src/app";
import { seed } from "../src/seed";

async function startServer() {
  const ds = createDataSource({ type: "sqljs" });
  await ds.initialize();
  await seed(ds);
  const app = createApp(ds);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  return { ds, server, origin, base: `${origin}/api` };
}

async function login(base: string): Promise<string> {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "123456" })
  });
  assert.equal(res.status, 200);
  const { token } = (await res.json()) as { token: string };
  return token;
}

test("HTTP 端到端：登录 → 草稿 → 发布 → 生效版本与样式产物", async () => {
  const { ds, server, origin, base } = await startServer();
  try {
    const token = await login(base);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // 品牌与草稿
    const brands = (await (await fetch(`${base}/brands`)).json()) as { id: string }[];
    const draftRes = await fetch(`${base}/brands/${brands[0].id}/drafts`, { method: "POST", headers: auth, body: "{}" });
    assert.equal(draftRes.status, 201);
    const draft = (await draftRes.json()) as { id: string; lockVersion: number; tokens: Record<string, string> };

    // 未认证写操作被拒
    const noAuth = await fetch(`${base}/versions/${draft.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockVersion: 1 })
    });
    assert.equal(noAuth.status, 401);

    // 发布
    const pubRes = await fetch(`${base}/versions/${draft.id}/publish`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ lockVersion: draft.lockVersion })
    });
    assert.equal(pubRes.status, 200);
    const published = (await pubRes.json()) as { versionNumber: number; cssHash: string };
    assert.equal(published.versionNumber, 2);

    // 生效版本（网页实际生效版本展示的数据源）
    const eff = (await (await fetch(`${base}/projects/official-site/effective-theme`)).json()) as {
      version: { versionNumber: number; cssHash: string };
      cssUrl: string;
    };
    assert.equal(eff.version.versionNumber, 2);

    // 编译期产物：immutable 长缓存 + 版本响应头
    const cssRes = await fetch(`${origin}${eff.cssUrl}`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get("cache-control") ?? "", /immutable/);
    assert.equal(cssRes.headers.get("x-brand-version"), "2");
    const cssText = await cssRes.text();
    assert.match(cssText, /--brand-editor-button-primary-bg/);

    // 运行时变量：no-cache，仅变量
    const rtRes = await fetch(`${base}/runtime/theme.css?project=official-site`);
    assert.match(rtRes.headers.get("cache-control") ?? "", /no-cache/);
    const rtText = await rtRes.text();
    assert.match(rtText, /:root/);
    assert.doesNotMatch(rtText, /brand-btn-primary/);
  } finally {
    server.close();
    await ds.destroy();
  }
});

test("HTTP：恶意主题配置被拒绝（脚本 / 任意 CSS / 未知键）", async () => {
  const { ds, server, origin, base } = await startServer();
  try {
    const token = await login(base);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const brands = (await (await fetch(`${base}/brands`)).json()) as { id: string }[];
    const draft = (await (
      await fetch(`${base}/brands/${brands[0].id}/drafts`, { method: "POST", headers: auth, body: "{}" })
    ).json()) as { id: string; lockVersion: number; tokens: Record<string, string> };

    const evilTokens = {
      ...draft.tokens,
      "brand.primary": "#fff; }</style><script>alert(1)</script>",
      "body { display:none }": "1"
    };
    const res = await fetch(`${base}/versions/${draft.id}`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ tokens: evilTokens, lockVersion: draft.lockVersion })
    });
    assert.equal(res.status, 422);
    const body = (await res.json()) as { code: string; details: { code: string }[] };
    assert.equal(body.code, "VALIDATION_FAILED");
    const codes = body.details.map((d) => d.code);
    assert.ok(codes.includes("UNSAFE_VALUE"));
    assert.ok(codes.includes("UNKNOWN_TOKEN"));
  } finally {
    server.close();
    await ds.destroy();
  }
});

test("HTTP：别名互指的草稿无法保存与发布", async () => {
  const { ds, server, origin, base } = await startServer();
  try {
    const token = await login(base);
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const brands = (await (await fetch(`${base}/brands`)).json()) as { id: string }[];
    const draft = (await (
      await fetch(`${base}/brands/${brands[0].id}/drafts`, { method: "POST", headers: auth, body: "{}" })
    ).json()) as { id: string; lockVersion: number; tokens: Record<string, string> };

    const cyclic = {
      ...draft.tokens,
      "editor.button.primary.bg": "{editor.button.hover.bg}",
      "editor.button.hover.bg": "{editor.button.primary.bg}"
    };
    const res = await fetch(`${base}/versions/${draft.id}`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ tokens: cyclic, lockVersion: draft.lockVersion })
    });
    assert.equal(res.status, 422);
    const body = (await res.json()) as { details: { code: string; message: string }[] };
    assert.ok(body.details.some((d) => d.code === "ALIAS_CYCLE"));
  } finally {
    server.close();
    await ds.destroy();
  }
});
