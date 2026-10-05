/**
 * 品牌校验核心逻辑自检（npm run test:brand）。
 * 覆盖验收场景：别名互指循环、缺项、暗色背景对比不足、错误语义覆盖、焦点不可见、脚本注入。
 */
import { validateTokenTree } from "./validate";
import { DEFAULT_TOKENS } from "./defaults";

let failures = 0;

function check(name: string, fn: () => boolean) {
  const ok = fn();
  if (!ok) failures++;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

const clone = () => JSON.parse(JSON.stringify(DEFAULT_TOKENS)) as Record<string, unknown>;

// 1. 默认令牌必须通过
const base = validateTokenTree(clone());
check("默认令牌校验通过", () => base.ok);
check("默认令牌对比度全部达标", () => base.contrast.every((c) => c.pass));

// 2. 别名互指 → 循环检测
const cyc = clone();
(cyc.color as Record<string, unknown>).primary = { alias: "color.accent" };
(cyc.color as Record<string, unknown>).accent = { alias: "color.primary" };
const cycRes = validateTokenTree(cyc);
check("别名互指被检出 ALIAS_CYCLE", () => !cycRes.ok && cycRes.issues.some((i) => i.code === "ALIAS_CYCLE"));

// 3. 缺项引用
const miss = clone();
(miss.button as Record<string, Record<string, unknown>>).primary.bg = { alias: "color.notExist" };
const missRes = validateTokenTree(miss);
check("缺失别名被检出 ALIAS_MISSING", () => !missRes.ok && missRes.issues.some((i) => i.code === "ALIAS_MISSING"));

// 4. 暗色背景对比不足（字幕色改成深灰）
const dark = clone();
(dark.export as Record<string, Record<string, unknown>>).subtitle.color = "#1F2937";
const darkRes = validateTokenTree(dark);
check(
  "暗色背景字幕对比不足被检出 CONTRAST_TOO_LOW",
  () => !darkRes.ok && darkRes.issues.some((i) => i.code === "CONTRAST_TOO_LOW" && i.path === "export.subtitle.color")
);

// 5. 错误语义被覆盖（danger 改成绿色）
const sem = clone();
(sem.button as Record<string, Record<string, unknown>>).danger.bg = "#16A34A";
const semRes = validateTokenTree(sem);
check(
  "错误语义改色被检出 ERROR_SEMANTIC_VIOLATION",
  () => !semRes.ok && semRes.issues.some((i) => i.code === "ERROR_SEMANTIC_VIOLATION")
);

// 6. 用户试图定义 system.* 保留命名空间
const ns = clone();
(ns as Record<string, unknown>).system = { error: { bg: "#00FF00" } };
const nsRes = validateTokenTree(ns);
check("system.* 保留命名空间被检出 NAMESPACE_RESERVED", () => !nsRes.ok && nsRes.issues.some((i) => i.code === "NAMESPACE_RESERVED"));

// 7. 焦点不可见：焦点环与背景同色
const focus = clone();
(focus.focus as Record<string, unknown>).ringColor = "#FFFFFF";
const focusRes = validateTokenTree(focus);
check("焦点环不可见被检出 CONTRAST_TOO_LOW", () => !focusRes.ok && focusRes.issues.some((i) => i.path === "focus.ringColor"));

// 8. 焦点环过细
const thin = clone();
(thin.focus as Record<string, unknown>).ringWidth = "1px";
const thinRes = validateTokenTree(thin);
check("焦点环过细被检出 FOCUS_RING_TOO_THIN", () => !thinRes.ok && thinRes.issues.some((i) => i.code === "FOCUS_RING_TOO_THIN"));

// 9. 任意脚本 / 不受限 CSS 注入被拒绝
const evil = clone();
(evil.color as Record<string, unknown>).primary = "red; }</style><script>alert(1)</script>";
const evilRes = validateTokenTree(evil);
check("脚本注入被拒绝 BAD_VALUE", () => !evilRes.ok && evilRes.issues.some((i) => i.code === "BAD_VALUE"));

const evil2 = clone();
(evil2.color as Record<string, unknown>).primary = "url(javascript:alert(1))";
const evil2Res = validateTokenTree(evil2);
check("url() 注入被拒绝 BAD_VALUE", () => !evil2Res.ok && evil2Res.issues.some((i) => i.code === "BAD_VALUE"));

// 10. 别名类型不一致
const tm = clone();
(tm.button as Record<string, Record<string, unknown>>).primary.bg = { alias: "button.primary.radius" };
const tmRes = validateTokenTree(tm);
check("别名类型不一致被检出 ALIAS_TYPE_MISMATCH", () => !tmRes.ok && tmRes.issues.some((i) => i.code === "ALIAS_TYPE_MISMATCH"));

// 11. 合法别名链可通过
const okAlias = clone();
(okAlias.color as Record<string, unknown>).brandMain = { alias: "color.primary" };
(okAlias.button as Record<string, Record<string, unknown>>).primary.hoverBg = { alias: "color.brandMain" };
const okAliasRes = validateTokenTree(okAlias);
check("合法别名链通过", () => okAliasRes.ok);

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failures} 项自检失败`);
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log("\n全部自检通过");
