/**
 * 校验编排：结构/类型/安全 → 别名图 → 语义约束。
 *
 * 语义约束（品牌规范的核心红线）：
 *  1. 对比度：文本/背景令牌对必须满足 WCAG 阈值（含“暗色播放器背景上的字幕色”）；
 *  2. 错误语义不可覆盖：system.* 由平台注入、用户不可定义；
 *     且用户主题中任何 error/danger 语义的颜色必须落在感知红色域；
 *  3. 键盘焦点必须可见：焦点环与浅色/深色背景的对比度 ≥ 3:1，宽度 ≥ 2px。
 */
import { contrastRatio, isErrorHue, parseColor } from "./color";
import { resolveAliases } from "./graph";
import { Issue, LeafEntry, scanTokenTree } from "./tokens";
import { SYSTEM_LEAVES } from "./defaults";

export interface ContrastCheck {
  pair: string;
  ratio: number;
  min: number;
  pass: boolean;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  resolved: Record<string, string | number>;
  contrast: ContrastCheck[];
}

interface PairSpec {
  fg: string;
  bg: string;
  min: number;
  label: string;
}

function buildContrastPairs(userPaths: Set<string>): PairSpec[] {
  const pairs: PairSpec[] = [];
  const has = (p: string) => userPaths.has(p);

  for (const variant of ["primary", "secondary", "danger"]) {
    if (has(`button.${variant}.text`) && has(`button.${variant}.bg`)) {
      pairs.push({ fg: `button.${variant}.text`, bg: `button.${variant}.bg`, min: 4.5, label: `按钮 ${variant} 文字/底色` });
    }
    if (has(`button.${variant}.disabledText`) && has(`button.${variant}.disabledBg`)) {
      pairs.push({ fg: `button.${variant}.disabledText`, bg: `button.${variant}.disabledBg`, min: 3, label: `按钮 ${variant} 禁用态文字/底色` });
    }
  }
  for (const state of ["ready", "processing", "error", "selected"]) {
    if (has(`asset.${state}.text`) && has(`asset.${state}.bg`)) {
      pairs.push({ fg: `asset.${state}.text`, bg: `asset.${state}.bg`, min: 4.5, label: `素材状态 ${state} 文字/底色` });
    }
  }
  if (has("export.badge.text") && has("export.badge.bg")) {
    pairs.push({ fg: "export.badge.text", bg: "export.badge.bg", min: 4.5, label: "导出标识徽章 文字/底色" });
  }
  // 暗色背景（播放器）上的字幕颜色 —— 验收场景“暗色背景下对比不足”
  if (has("export.subtitle.color") && has("export.subtitle.bg")) {
    pairs.push({ fg: "export.subtitle.color", bg: "export.subtitle.bg", min: 4.5, label: "成片字幕颜色/播放器暗色背景" });
  }
  for (const state of ["active", "completed", "pending"]) {
    if (has(`steps.${state}.label`) && has("color.surface")) {
      pairs.push({ fg: `steps.${state}.label`, bg: "color.surface", min: 4.5, label: `步骤 ${state} 文案/页面底色` });
    }
    if (state !== "pending" && has(`steps.${state}.dot`) && has("color.surface")) {
      // pending 为“未激活”语义，WCAG 对禁用态豁免，不强制
      pairs.push({ fg: `steps.${state}.dot`, bg: "color.surface", min: 3, label: `步骤 ${state} 圆点/页面底色` });
    }
  }
  // 键盘焦点可见性：焦点环在浅色与深色背景上都必须 ≥ 3:1
  if (has("focus.ringColor") && has("color.surface")) {
    pairs.push({ fg: "focus.ringColor", bg: "color.surface", min: 3, label: "焦点环/浅色背景（键盘焦点必须可见）" });
  }
  if (has("focus.ringColor") && has("color.surfaceDark")) {
    pairs.push({ fg: "focus.ringColor", bg: "color.surfaceDark", min: 3, label: "焦点环/深色背景（键盘焦点必须可见）" });
  }
  return pairs;
}

export function validateTokenTree(input: unknown): ValidationResult {
  const scan = scanTokenTree(input);
  const issues: Issue[] = [...scan.issues];

  const { issues: graphIssues, resolved } = resolveAliases(scan.leaves, SYSTEM_LEAVES);
  issues.push(...graphIssues);

  const resolvedObj: Record<string, string | number> = {};
  for (const [k, v] of resolved) resolvedObj[k] = v;

  const contrast: ContrastCheck[] = [];
  // 仅在结构/引用无误时做语义校验（解析结果才可信）
  if (issues.length === 0) {
    const userPaths = new Set(scan.leaves.map((l) => l.path));
    for (const spec of buildContrastPairs(userPaths)) {
      const fgVal = resolved.get(spec.fg);
      const bgVal = resolved.get(spec.bg);
      if (typeof fgVal !== "string" || typeof bgVal !== "string") continue;
      const fg = parseColor(fgVal);
      const bg = parseColor(bgVal);
      if (!fg || !bg) continue;
      const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
      const pass = ratio >= spec.min;
      contrast.push({ pair: spec.label, ratio, min: spec.min, pass });
      if (!pass) {
        issues.push({
          path: spec.fg,
          code: "CONTRAST_TOO_LOW",
          message: `对比度不足：${spec.label} 实测 ${ratio}:1，要求 ≥ ${spec.min}:1`
        });
      }
    }

    // 错误语义色相约束：error/danger 语义的“填充/指示”类颜色必须是感知红色。
    // 文字色（白字红底）、禁用态中性色不受此限 —— 它们不承担错误指示。
    const ERROR_FILL_KEYS = new Set(["bg", "border", "dot", "line", "icon", "color", "hoverBg", "activeBg"]);
    for (const leaf of scan.leaves) {
      if (leaf.type !== "color") continue;
      if (!/(^|\.)(error|danger)(\.|$)/.test(leaf.path)) continue;
      if (!ERROR_FILL_KEYS.has(leaf.key)) continue;
      const val = resolved.get(leaf.path);
      if (typeof val !== "string") continue;
      const c = parseColor(val);
      if (c && !isErrorHue(c)) {
        issues.push({
          path: leaf.path,
          code: "ERROR_SEMANTIC_VIOLATION",
          message: `令牌 ${leaf.path} 承担错误语义，颜色必须保持感知红色域（不可覆盖系统错误含义）`
        });
      }
    }

    // 焦点环宽度
    const ringWidth = resolved.get("focus.ringWidth");
    if (typeof ringWidth === "string") {
      const m = /^(\d{1,3}(?:\.\d{1,2})?)(px|rem)$/.exec(ringWidth);
      if (m) {
        const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
        if (px < 2) {
          issues.push({
            path: "focus.ringWidth",
            code: "FOCUS_RING_TOO_THIN",
            message: `焦点环宽度 ${ringWidth} 小于 2px，键盘焦点将不可见`
          });
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, resolved: resolvedObj, contrast };
}
