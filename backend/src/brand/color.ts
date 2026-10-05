/**
 * 颜色解析与 WCAG 对比度计算。
 * 支持 #RGB/#RGBA/#RRGGBB/#RRGGBBAA 与 rgb()/rgba()，其余一律拒绝（在 tokens.ts 中拦截）。
 */

export interface RGBA {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/;

export function isColorLiteral(input: string): boolean {
  return HEX_RE.test(input.trim()) || RGB_RE.test(input.trim());
}

export function parseColor(input: string): RGBA | null {
  const s = input.trim();
  if (HEX_RE.test(s)) {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const m = RGB_RE.exec(s);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    return { r, g, b, a };
  }
  return null;
}

/** 前景色按 alpha 合成到背景上 */
export function composite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a: 1
  };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x 相对亮度 */
export function relativeLuminance(c: RGBA): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG 对比度 (L1+0.05)/(L2+0.05)，前景先合成到背景 */
export function contrastRatio(fg: RGBA, bg: RGBA): number {
  const f = fg.a >= 1 ? fg : composite(fg, bg);
  const l1 = relativeLuminance(f);
  const l2 = relativeLuminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function toHsl(c: RGBA): HSL {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/**
 * “错误语义”色相约束：必须落在感知红色域（含浅粉错误表面），
 * 防止用户把错误色改成绿/蓝导致语义错乱。纯白/纯黑等无彩色因饱和度不足被拒绝。
 */
export function isErrorHue(c: RGBA): boolean {
  const { h, s, l } = toHsl(c);
  const redHue = h <= 22 || h >= 338;
  return redHue && s >= 0.4 && l >= 0.12 && l <= 0.97;
}
