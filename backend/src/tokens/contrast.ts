/** WCAG 2.x 对比度计算 */

interface Rgba { r: number; g: number; b: number; a: number }

export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
    const hex = m[1];
    const norm =
      hex.length <= 4
        ? hex.split("").map((c) => c + c).join("")
        : hex;
    const r = parseInt(norm.slice(0, 2), 16);
    const g = parseInt(norm.slice(2, 4), 16);
    const b = parseInt(norm.slice(4, 6), 16);
    const a = norm.length === 8 ? parseInt(norm.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  if ((m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/.exec(s))) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  if ((m = /^hsla?\(\s*(\d{1,3})(?:deg)?\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/.exec(s))) {
    const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
    const a = m[4] === undefined ? 1 : +m[4];
    if (sat === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v, a };
    }
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const hue2rgb = (t0: number) => {
      let t = t0;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(hue2rgb(h + 1 / 3) * 255),
      g: Math.round(hue2rgb(h) * 255),
      b: Math.round(hue2rgb(h - 1 / 3) * 255),
      a
    };
  }
  return null;
}

/** 半透明前景合成到背景上 */
function composite(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a: 1
  };
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(color: Rgba): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** 计算 fg 在 bg 上的对比度；无法解析时返回 null */
export function contrastRatio(fgInput: string, bgInput: string): number | null {
  const fg = parseColor(fgInput);
  const bg = parseColor(bgInput);
  if (!fg || !bg) return null;
  const effectiveFg = fg.a < 1 ? composite(fg, bg) : fg;
  const l1 = luminance(effectiveFg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 返回颜色色相（0-360）；无法解析返回 null */
export function hueOf(input: string): number | null {
  const c = parseColor(input);
  if (!c) return null;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}
