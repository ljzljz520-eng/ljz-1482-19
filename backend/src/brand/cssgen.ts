/**
 * CSS 双轨生成（同源：同一条 BrandVersion 记录 → 同一份 resolved 令牌）：
 *
 *  A. 编译时产物 generateArtifactCss：发布时生成，含变量 + 组件类，内容寻址、可永久缓存，
 *     适合构建期打包进前端资源（性能最优，但租户定制需要重新构建/发版）。
 *  B. 运行时变量 generateRuntimeCss：仅输出白名单 --brand-* 变量，按项目生效版本实时供给，
 *     租户定制即时生效；通过 ETag + 短 max-age 控制缓存一致性，CSP 下仅允许同源样式。
 */
import { createHash } from "crypto";

export function toCssVarName(path: string): string {
  return (
    "--brand-" +
    path
      .replace(/\./g, "-")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
  );
}

export function contentHashOf(resolved: Record<string, string | number>): string {
  const canonical = JSON.stringify(
    Object.keys(resolved)
      .sort()
      .map((k) => [k, resolved[k]])
  );
  return createHash("sha256").update(canonical).digest("hex");
}

export function toCssVars(resolved: Record<string, string | number>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [path, value] of Object.entries(resolved)) {
    if (path.startsWith("system.")) continue; // 系统令牌不暴露为品牌变量
    vars[toCssVarName(path)] = String(value);
  }
  return vars;
}

const SYSTEM_VAR_OVERRIDES = `
  /* 平台保留：系统错误语义，恒定注入，用户主题不可覆盖 */
  --brand-system-error-bg: #DC2626;
  --brand-system-error-text: #FFFFFF;
  --brand-system-error-subtle: #FEE2E2;
  --brand-system-error-on-subtle: #7F1D1D;`;

export function generateRuntimeCss(
  resolved: Record<string, string | number>,
  meta: { version: string; contentHash: string }
): string {
  const vars = toCssVars(resolved);
  const lines = Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `/* BrandSpec runtime variables · v${meta.version} · ${meta.contentHash.slice(0, 12)}
 * 受约束的运行时变量：仅白名单 --brand-* 变量，由服务端校验后生成，不含任何可执行内容。 */
:root {
${lines}
${SYSTEM_VAR_OVERRIDES}
}
`;
}

/** 组件类与前端 index.css 中的 .bk-* 保持一致，使编译时产物可独立使用 */
export function generateArtifactCss(
  resolved: Record<string, string | number>,
  meta: { version: string; contentHash: string; publishedAt: string }
): string {
  const runtime = generateRuntimeCss(resolved, meta);
  return `/* ============================================================
 * BrandSpec 编译时产物 · v${meta.version}
 * contentHash: ${meta.contentHash}
 * publishedAt: ${meta.publishedAt}
 * 本文件由发布流水线生成，内容寻址、可永久缓存（immutable）。
 * ============================================================ */
${runtime}
.bk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.625rem 1.25rem;font-weight:600;border:1px solid transparent;transition:all .15s ease;cursor:pointer}
.bk-btn:focus-visible{outline:var(--brand-focus-ring-width) solid var(--brand-focus-ring-color);outline-offset:2px}
.bk-btn-primary{background:var(--brand-button-primary-bg);color:var(--brand-button-primary-text);border-color:var(--brand-button-primary-border);border-radius:var(--brand-button-primary-radius)}
.bk-btn-primary:hover{background:var(--brand-button-primary-hover-bg)}
.bk-btn-primary:active{background:var(--brand-button-primary-active-bg)}
.bk-btn-secondary{background:var(--brand-button-secondary-bg);color:var(--brand-button-secondary-text);border-color:var(--brand-button-secondary-border);border-radius:var(--brand-button-secondary-radius)}
.bk-btn-secondary:hover{background:var(--brand-button-secondary-hover-bg)}
.bk-btn-secondary:active{background:var(--brand-button-secondary-active-bg)}
.bk-btn-danger{background:var(--brand-button-danger-bg);color:var(--brand-button-danger-text);border-color:var(--brand-button-danger-border);border-radius:var(--brand-button-danger-radius)}
.bk-btn-danger:hover{background:var(--brand-button-danger-hover-bg)}
.bk-btn-danger:active{background:var(--brand-button-danger-active-bg)}
.bk-btn:disabled,.bk-btn[disabled]{background:var(--brand-button-primary-disabled-bg);color:var(--brand-button-primary-disabled-text);border-color:transparent;cursor:not-allowed;opacity:.9}
.bk-badge-export{display:inline-flex;align-items:center;gap:.375rem;padding:.25rem .75rem;font-size:.75rem;font-weight:700;background:var(--brand-export-badge-bg);color:var(--brand-export-badge-text);border:1px solid var(--brand-export-badge-border);border-radius:var(--brand-export-badge-radius)}
`;
}
