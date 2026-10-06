/**
 * 样式产物生成。
 *
 * 两种交付形态（同一版本、同一份解析结果，保证前端资源与导出预览同源）：
 *  - compileCss: 编译期产物，完整工具类样式，内容哈希命名，可长缓存 immutable
 *  - buildRuntimeCss: 受约束的运行时变量，仅输出规范内的 --brand-* CSS 变量
 */
import { createHash } from "crypto";
import { TOKEN_DEFS } from "./schema";
import { isValidValueForType } from "./sanitize";

export class StyleBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StyleBuildError";
  }
}

export interface BuildMeta {
  brandSlug: string;
  versionNumber: number | null;
  tokenHash: string;
}

export function tokenHashOf(tokens: Record<string, string>): string {
  const canonical = JSON.stringify(
    Object.keys(tokens).sort().map((k) => [k, tokens[k]])
  );
  return createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

export function cssHashOf(css: string): string {
  return createHash("sha256").update(css).digest("hex").slice(0, 12);
}

function assertBuildable(values: Record<string, string>): void {
  for (const def of TOKEN_DEFS) {
    const val = values[def.path];
    if (val === undefined) {
      throw new StyleBuildError(`令牌 "${def.path}" 缺失，无法构建样式`);
    }
    if (!isValidValueForType(def.type, val)) {
      throw new StyleBuildError(`令牌 "${def.path}" 的值 "${val}" 非法，无法构建样式`);
    }
  }
}

function varBlock(values: Record<string, string>, indent: string): string {
  return TOKEN_DEFS
    .map((d) => `${indent}${d.cssVar}: ${values[d.path]};`)
    .join("\n");
}

/** 受约束的运行时变量产物：仅 :root 变量，无任何选择器逻辑 */
export function buildRuntimeCss(values: Record<string, string>, meta: BuildMeta): string {
  assertBuildable(values);
  return [
    `/* 品牌运行时变量 · ${meta.brandSlug} v${meta.versionNumber ?? "draft"} · tokens:${meta.tokenHash} */`,
    `:root {`,
    varBlock(values, "  "),
    `}`,
    ``
  ].join("\n");
}

/** 编译期完整产物：变量 + 组件工具类 + 焦点可见性 */
export function compileCss(values: Record<string, string>, meta: BuildMeta): string {
  assertBuildable(values);
  const lines = [
    `/* 品牌编译产物 · ${meta.brandSlug} v${meta.versionNumber ?? "draft"} · tokens:${meta.tokenHash} */`,
    `:root {`,
    varBlock(values, "  "),
    `}`,
    ``,
    `/* ---- 网页编辑按钮 ---- */`,
    `.brand-btn-primary {`,
    `  background-color: var(--brand-editor-button-primary-bg);`,
    `  color: var(--brand-editor-button-primary-fg);`,
    `  border-radius: var(--brand-editor-button-radius);`,
    `}`,
    `.brand-btn-primary:hover:not(:disabled) { background-color: var(--brand-editor-button-hover-bg); }`,
    `.brand-btn-primary:disabled {`,
    `  background-color: var(--brand-editor-button-disabled-bg);`,
    `  color: var(--brand-editor-button-disabled-fg);`,
    `  cursor: not-allowed;`,
    `}`,
    ``,
    `/* ---- 键盘焦点可见性（系统保护，不可覆盖） ---- */`,
    `:focus-visible {`,
    `  outline: var(--brand-system-focus-ring-width) solid var(--brand-system-focus-ring-color);`,
    `  outline-offset: 2px;`,
    `}`,
    ``,
    `/* ---- 步骤条 ---- */`,
    `.brand-step-active { background-color: var(--brand-steps-active-bg); color: var(--brand-steps-active-fg); }`,
    `.brand-step-done { background-color: var(--brand-steps-done-bg); color: var(--brand-steps-done-fg); }`,
    `.brand-step-pending { background-color: var(--brand-steps-pending-bg); color: var(--brand-steps-pending-fg); }`,
    `.brand-step-connector { background-color: var(--brand-steps-connector); }`,
    ``,
    `/* ---- 素材状态徽章 ---- */`,
    `.brand-asset-chip { color: var(--brand-asset-state-fg); border-radius: 999px; }`,
    `.brand-asset-draft { background-color: var(--brand-asset-state-draft); }`,
    `.brand-asset-reviewing { background-color: var(--brand-asset-state-reviewing); }`,
    `.brand-asset-approved { background-color: var(--brand-asset-state-approved); }`,
    `.brand-asset-published { background-color: var(--brand-asset-state-published); }`,
    `.brand-asset-error { background-color: var(--brand-asset-state-error); }`,
    ``,
    `/* ---- 导出标识 ---- */`,
    `.brand-export-badge {`,
    `  background-color: var(--brand-export-badge-bg);`,
    `  color: var(--brand-export-badge-fg);`,
    `  border: 1px solid var(--brand-export-badge-border);`,
    `  border-radius: var(--brand-export-badge-radius);`,
    `}`,
    `.brand-subtitle { color: var(--brand-export-subtitle-fg); background-color: var(--brand-export-subtitle-bg); }`,
    ``,
    `/* ---- 系统错误语义 ---- */`,
    `.brand-error { color: var(--brand-system-error-fg); }`,
    `.brand-error-surface { color: var(--brand-system-error-fg); background-color: var(--brand-system-error-bg); }`,
    ``
  ];
  return lines.join("\n");
}
