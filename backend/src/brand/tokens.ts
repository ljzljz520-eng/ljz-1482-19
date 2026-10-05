/**
 * 令牌树结构校验：命名空间白名单、叶子类型推断、值域白名单。
 *
 * 安全模型（“服务端不接收任意脚本或不受限 CSS”）：
 *  - 键名：仅允许 [a-zA-Z][a-zA-Z0-9_-]*，长度受限；
 *  - 顶层命名空间：白名单（color/button/steps/asset/export/focus），system.* 为平台保留；
 *  - 叶子值：只能是 颜色字面量 / 尺寸字面量(px|rem) / 字重枚举 / 透明度 / 别名引用 {alias:"a.b"}；
 *    字符串值域由严格正则限定，结构上不可能注入 <script>、url()、@import、expression 等任意 CSS。
 */
import { isColorLiteral, parseColor } from "./color";

export type LeafType = "color" | "size" | "weight" | "opacity";

export interface AliasRef {
  alias: string;
}
export type TokenLeaf = string | number | AliasRef;
export type TokenTree = { [key: string]: TokenLeaf | TokenTree };

export interface Issue {
  path: string;
  code: string;
  message: string;
}

export const NAMESPACES = ["color", "button", "steps", "asset", "export", "focus"] as const;
export const RESERVED_NAMESPACES = ["system"] as const;

/** 叶子 key → 值类型。未知 key 一律拒绝，保证“后台校验类型”是封闭集合。 */
export const LEAF_TYPES: Record<string, LeafType> = {
  bg: "color",
  text: "color",
  border: "color",
  color: "color",
  dot: "color",
  line: "color",
  label: "color",
  icon: "color",
  ringColor: "color",
  hoverBg: "color",
  activeBg: "color",
  disabledBg: "color",
  disabledText: "color",
  radius: "size",
  width: "size",
  ringWidth: "size",
  gap: "size",
  fontSize: "size",
  fontWeight: "weight",
  opacity: "opacity"
};

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const PATH_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}(\.[a-zA-Z][a-zA-Z0-9_-]{0,39})+$/;
const SIZE_RE = /^(\d{1,4}(?:\.\d{1,2})?)(px|rem)$/;
const MAX_DEPTH = 5;

/** 调色板命名空间：任意键都是颜色令牌（品牌色板由用户自由命名） */
const PALETTE_NAMESPACES: readonly string[] = ["color"];

export function isAliasRef(v: unknown): v is AliasRef {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v as object).length === 1 &&
    typeof (v as { alias?: unknown }).alias === "string"
  );
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export interface LeafEntry {
  path: string;
  key: string;
  type: LeafType;
  value: TokenLeaf;
}

export interface TreeScan {
  issues: Issue[];
  leaves: LeafEntry[];
}

/** 递归扫描令牌树：结构、命名空间、键名、叶子类型与值域 */
export function scanTokenTree(input: unknown): TreeScan {
  const issues: Issue[] = [];
  const leaves: LeafEntry[] = [];

  if (!isPlainObject(input)) {
    issues.push({ path: "", code: "ROOT_NOT_OBJECT", message: "令牌配置必须是 JSON 对象" });
    return { issues, leaves };
  }

  const leafTypeOf = (key: string, namespace: string): LeafType | null => {
    if (PALETTE_NAMESPACES.includes(namespace)) return "color";
    return LEAF_TYPES[key] ?? null;
  };

  const walk = (node: Record<string, unknown>, prefix: string, depth: number) => {
    const namespace = prefix.split(".")[0] ?? "";
    if (depth > MAX_DEPTH) {
      issues.push({ path: prefix, code: "TOO_DEEP", message: `令牌嵌套超过 ${MAX_DEPTH} 层` });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!KEY_RE.test(key)) {
        issues.push({ path, code: "BAD_KEY", message: `非法键名 "${key}"：仅允许字母开头的字母数字/连字符` });
        continue;
      }
      if (depth === 1) {
        if ((RESERVED_NAMESPACES as readonly string[]).includes(key)) {
          issues.push({
            path,
            code: "NAMESPACE_RESERVED",
            message: `命名空间 "${key}.*" 为平台保留（系统错误语义等），用户主题不可覆盖`
          });
          continue;
        }
        if (!(NAMESPACES as readonly string[]).includes(key)) {
          issues.push({
            path,
            code: "NAMESPACE_UNKNOWN",
            message: `未知命名空间 "${key}"，允许：${NAMESPACES.join("/")}`
          });
          continue;
        }
      }
      if (isAliasRef(value)) {
        const leafType = leafTypeOf(key, namespace);
        if (!leafType) {
          issues.push({ path, code: "UNKNOWN_LEAF", message: `未知令牌字段 "${key}"，不在类型表中` });
          continue;
        }
        if (!PATH_RE.test(value.alias)) {
          issues.push({ path, code: "BAD_ALIAS", message: `别名 "${value.alias}" 不是合法令牌路径` });
          continue;
        }
        leaves.push({ path, key, type: leafType, value: { alias: value.alias } });
        continue;
      }
      if (isPlainObject(value)) {
        walk(value, path, depth + 1);
        continue;
      }
      const leafType = leafTypeOf(key, namespace);
      if (!leafType) {
        issues.push({ path, code: "UNKNOWN_LEAF", message: `未知令牌字段 "${key}"，不在类型表中` });
        continue;
      }
      const err = checkLeafValue(leafType, value);
      if (err) {
        issues.push({ path, code: "BAD_VALUE", message: err });
        continue;
      }
      leaves.push({ path, key, type: leafType, value: value as TokenLeaf });
    }
  };

  walk(input, "", 1);
  return { issues, leaves };
}

function checkLeafValue(type: LeafType, value: unknown): string | null {
  switch (type) {
    case "color": {
      if (typeof value !== "string" || !isColorLiteral(value)) {
        return "颜色必须是 #RGB/#RRGGBB(#AA) 或 rgb()/rgba() 字面量";
      }
      if (!parseColor(value)) return "颜色分量超出合法范围";
      return null;
    }
    case "size": {
      if (typeof value !== "string" || !SIZE_RE.test(value)) {
        return "尺寸必须是 <数字>px 或 <数字>rem（如 12px / 0.75rem）";
      }
      const m = SIZE_RE.exec(value)!;
      const num = Number(m[1]);
      if (m[2] === "px" && num > 999) return "尺寸过大（px 上限 999）";
      if (m[2] === "rem" && num > 12) return "尺寸过大（rem 上限 12）";
      return null;
    }
    case "weight": {
      if (typeof value !== "number" || ![400, 500, 600, 700, 800].includes(value)) {
        return "字重必须是 400/500/600/700/800";
      }
      return null;
    }
    case "opacity": {
      if (typeof value !== "number" || value < 0 || value > 1) return "透明度必须是 0~1 的数字";
      return null;
    }
  }
}
