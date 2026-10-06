/**
 * 安全校验：令牌值只能是“类型化数据”（颜色 / 尺寸 / 别名引用），
 * 绝不接受任意 CSS、脚本或协议处理器。
 */

export const ALIAS_PATTERN = /^\{([A-Za-z0-9_.-]+)\}$/;

const COLOR_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_RGB = /^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;
const COLOR_HSL = /^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/;
const DIMENSION = /^\d+(?:\.\d+)?(?:px|rem|em|%)$/;

const FORBIDDEN: { re: RegExp; why: string }[] = [
  { re: /[<>]/, why: "包含尖括号（疑似标记注入）" },
  { re: /[;{}]/, why: "包含 CSS 声明分隔符（疑似任意 CSS 注入）" },
  { re: /javascript\s*:/i, why: "包含 javascript: 协议" },
  { re: /expression\s*\(/i, why: "包含 CSS expression()" },
  { re: /url\s*\(/i, why: "包含 url() 引用" },
  { re: /@import/i, why: "包含 @import" },
  { re: /\/\*|\*\//, why: "包含注释符" },
  { re: /\\/, why: "包含转义字符" }
];

/** 返回不安全原因；安全则返回 null */
export function findUnsafe(value: string): string | null {
  const trimmed = value.trim();
  if (ALIAS_PATTERN.test(trimmed)) return null; // 别名引用字符集受限，安全
  for (const rule of FORBIDDEN) {
    if (rule.re.test(trimmed)) return rule.why;
  }
  return null;
}

export function isValidColor(value: string): boolean {
  const t = value.trim();
  return COLOR_HEX.test(t) || COLOR_RGB.test(t) || COLOR_HSL.test(t);
}

export function isValidDimension(value: string): boolean {
  const t = value.trim();
  if (!DIMENSION.test(t)) return false;
  const num = parseFloat(t);
  return Number.isFinite(num) && num >= 0 && num <= 1000;
}

export function isValidValueForType(type: "color" | "dimension", value: string): boolean {
  return type === "color" ? isValidColor(value) : isValidDimension(value);
}
