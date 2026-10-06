import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TOKENS } from "../src/tokens/schema";
import { resolveTokens } from "../src/tokens/resolve";
import { validateTheme } from "../src/tokens/validate";
import { contrastRatio } from "../src/tokens/contrast";
import { compileCss, buildRuntimeCss, StyleBuildError, tokenHashOf, cssHashOf } from "../src/tokens/cssgen";

const base = () => ({ ...DEFAULT_TOKENS });

test("默认令牌（种子数据）通过全部校验", () => {
  const { hasErrors, issues } = validateTheme(base());
  assert.equal(hasErrors, false, JSON.stringify(issues, null, 2));
});

test("别名互指被检测为循环引用", () => {
  const tokens = base();
  tokens["editor.button.primary.bg"] = "{editor.button.hover.bg}";
  tokens["editor.button.hover.bg"] = "{editor.button.primary.bg}";
  const { issues } = resolveTokens(tokens);
  const cycle = issues.find((i) => i.code === "ALIAS_CYCLE");
  assert.ok(cycle, "应检测到循环引用");
  assert.match(cycle!.message, /→/);
});

test("别名自引用也是循环", () => {
  const tokens = base();
  tokens["brand.primary"] = "{brand.primary}";
  const { issues } = resolveTokens(tokens);
  assert.ok(issues.some((i) => i.code === "ALIAS_CYCLE"));
});

test("引用不存在的令牌被检测为缺项", () => {
  const tokens = base();
  tokens["editor.button.primary.bg"] = "{brand.not-exist}";
  const { issues } = resolveTokens(tokens);
  assert.ok(issues.some((i) => i.code === "ALIAS_MISSING" && i.message.includes("brand.not-exist")));
});

test("缺少必需令牌被检测为缺项", () => {
  const tokens = base();
  delete (tokens as Record<string, string>)["system.error.fg"];
  const { issues } = resolveTokens(tokens);
  assert.ok(issues.some((i) => i.code === "MISSING_TOKEN" && i.token === "system.error.fg"));
});

test("别名类型不匹配被拒绝", () => {
  const tokens = base();
  tokens["editor.button.radius"] = "{brand.primary}"; // dimension 引用 color
  const { issues } = resolveTokens(tokens);
  assert.ok(issues.some((i) => i.code === "ALIAS_TYPE_MISMATCH"));
});

test("暗色背景下对比不足被拒绝", () => {
  const tokens = base();
  tokens["export.badge.fg"] = "#1E293B"; // 暗灰文字 on 深色角标背景
  const { issues, hasErrors } = validateTheme(tokens);
  assert.equal(hasErrors, true);
  const c = issues.find((i) => i.code === "CONTRAST_INSUFFICIENT" && i.message.includes("暗色背景"));
  assert.ok(c, "应报告暗色背景对比不足");
});

test("暗色背景上字幕对比不足被拒绝", () => {
  const tokens = base();
  tokens["export.subtitle.fg"] = "#334155";
  const { issues } = validateTheme(tokens);
  assert.ok(issues.some((i) => i.code === "CONTRAST_INSUFFICIENT" && i.message.includes("字幕")));
});

test("用户主题不能把系统错误色改成非红色（覆盖错误语义）", () => {
  const tokens = base();
  tokens["system.error.fg"] = "#16A34A"; // 绿色
  const { issues, hasErrors } = validateTheme(tokens);
  assert.equal(hasErrors, true);
  assert.ok(issues.some((i) => i.code === "PROTECTED_ERROR_SEMANTICS"));
});

test("键盘焦点不可见被拒绝：焦点环过细", () => {
  const tokens = base();
  tokens["system.focus.ring.width"] = "1px";
  const { issues } = validateTheme(tokens);
  assert.ok(issues.some((i) => i.code === "FOCUS_INVISIBLE"));
});

test("键盘焦点不可见被拒绝：焦点环在暗色背景上对比不足", () => {
  const tokens = base();
  tokens["system.focus.ring.color"] = "#1E293B";
  const { issues } = validateTheme(tokens);
  assert.ok(issues.some((i) => i.code === "CONTRAST_INSUFFICIENT" && i.message.includes("焦点环")));
});

test("服务端拒绝任意脚本作为令牌值", () => {
  const tokens = base();
  tokens["brand.primary"] = "red; }</style><script>alert(1)</script>";
  const { issues } = resolveTokens(tokens);
  assert.ok(issues.some((i) => i.code === "UNSAFE_VALUE"));
});

test("服务端拒绝不受限 CSS / url() / javascript: 协议", () => {
  for (const evil of [
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "#fff; body { display: none }",
    "@import 'evil.css'"
  ]) {
    const tokens = base();
    tokens["brand.primary"] = evil;
    const { issues } = resolveTokens(tokens);
    assert.ok(issues.some((i) => i.code === "UNSAFE_VALUE"), `应拒绝: ${evil}`);
  }
});

test("服务端拒绝规范之外的未知令牌键（不接收任意 CSS 配置）", () => {
  const tokens = base() as Record<string, string>;
  tokens["*"] = "margin: 0";
  tokens["body"] = "background: black";
  const { issues } = resolveTokens(tokens);
  assert.equal(issues.filter((i) => i.code === "UNKNOWN_TOKEN").length, 2);
});

test("对比度计算符合 WCAG 基准", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#FFFFFF")! - 21) < 0.01);
  assert.ok(contrastRatio("#777777", "#777777")! === 1);
});

test("编译产物与运行时变量同源：同一版本解析结果生成", () => {
  const { values } = validateTheme(base());
  const meta = { brandSlug: "yunxi", versionNumber: 1, tokenHash: tokenHashOf(base()) };
  const compiled = compileCss(values, meta);
  const runtime = buildRuntimeCss(values, meta);
  assert.ok(compiled.includes("--brand-editor-button-primary-bg: #165DFF")); // 别名已展开
  assert.ok(runtime.includes("--brand-export-subtitle-fg: #FFFFFF"));
  assert.ok(compiled.includes(":focus-visible"));
  assert.notEqual(cssHashOf(compiled), cssHashOf(runtime));
});

test("构建样式失败：缺令牌时 compileCss 抛出 StyleBuildError", () => {
  const values: Record<string, string> = {};
  assert.throws(
    () => compileCss(values, { brandSlug: "x", versionNumber: 1, tokenHash: "t" }),
    (e: Error) => e instanceof StyleBuildError
  );
});

test("令牌哈希对内容敏感、对键顺序不敏感", () => {
  const a = base();
  const b = Object.fromEntries(Object.entries(base()).reverse());
  assert.equal(tokenHashOf(a), tokenHashOf(b));
  const c = base();
  c["brand.primary"] = "#000000";
  assert.notEqual(tokenHashOf(a), tokenHashOf(c));
});
