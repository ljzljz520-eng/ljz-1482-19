/**
 * 综合校验：别名解析 + 对比度规则 + 系统保护语义。
 */
import { CONTRAST_RULES } from "./schema";
import { contrastRatio, hueOf } from "./contrast";
import { resolveTokens, TokenIssue } from "./resolve";

export interface ValidateResult {
  issues: TokenIssue[];
  values: Record<string, string>;
  /** 是否存在阻断发布的错误 */
  hasErrors: boolean;
}

export function validateTheme(tokens: Record<string, string>): ValidateResult {
  const { values, issues } = resolveTokens(tokens);
  const push = (issue: TokenIssue) => issues.push(issue);

  // 对比度规则（含暗色背景场景）
  for (const rule of CONTRAST_RULES) {
    const fg = values[rule.fg];
    const bg = values[rule.bg];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue; // 非法值已在解析阶段报告
    if (ratio < rule.min) {
      push({
        level: rule.level,
        code: "CONTRAST_INSUFFICIENT",
        token: rule.fg,
        message: `${rule.label}：对比度 ${ratio.toFixed(2)}:1 低于要求的 ${rule.min}:1（${rule.fg} 于 ${rule.bg}）`
      });
    }
  }

  // 系统保护 1：错误语义不可被覆盖 —— 错误色必须保持红色色相
  const errFg = values["system.error.fg"];
  if (errFg) {
    const hue = hueOf(errFg);
    if (hue !== null && !(hue <= 24 || hue >= 332)) {
      push({
        level: "error",
        code: "PROTECTED_ERROR_SEMANTICS",
        token: "system.error.fg",
        message: `系统错误色必须保持红色色相（当前色相 ${Math.round(hue)}°），用户主题不得覆盖错误语义`
      });
    }
  }

  // 系统保护 2：键盘焦点必须可见 —— 焦点环宽度下限
  const focusWidth = values["system.focus.ring.width"];
  if (focusWidth) {
    const px = parseFloat(focusWidth);
    if (!Number.isFinite(px) || px < 2) {
      push({
        level: "error",
        code: "FOCUS_INVISIBLE",
        token: "system.focus.ring.width",
        message: "键盘焦点环宽度不得小于 2px，否则焦点不可见"
      });
    }
  }
  // 焦点环颜色对比度由 CONTRAST_RULES 中两条 focus.ring 规则兜底（明/暗背景均 ≥ 3:1）

  return { issues, values, hasErrors: issues.some((i) => i.level === "error") };
}
