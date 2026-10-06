/**
 * 令牌解析：别名（{other.token}）展开、循环检测、缺项检测、类型校验、安全校验。
 */
import { DEF_BY_PATH, TOKEN_DEFS } from "./schema";
import { ALIAS_PATTERN, findUnsafe, isValidValueForType } from "./sanitize";

export interface TokenIssue {
  level: "error" | "warning";
  code: string;
  token?: string;
  message: string;
}

export interface ResolveResult {
  /** 解析后的字面值（仅包含解析成功的令牌） */
  values: Record<string, string>;
  issues: TokenIssue[];
}

export function resolveTokens(tokens: Record<string, string>): ResolveResult {
  const issues: TokenIssue[] = [];
  const seenMessages = new Set<string>();
  const push = (issue: TokenIssue) => {
    const key = `${issue.code}|${issue.message}`;
    if (seenMessages.has(key)) return;
    seenMessages.add(key);
    issues.push(issue);
  };

  // 1. 未知键：服务端只接受规范内令牌，拒绝不受限配置
  for (const key of Object.keys(tokens)) {
    if (!DEF_BY_PATH.has(key)) {
      push({ level: "error", code: "UNKNOWN_TOKEN", token: key, message: `未定义的令牌 "${key}"：服务端仅接受规范内的令牌键，不接收任意 CSS` });
    }
  }

  // 2. 安全校验
  for (const [key, raw] of Object.entries(tokens)) {
    if (typeof raw !== "string") {
      push({ level: "error", code: "INVALID_VALUE", token: key, message: `令牌 "${key}" 的值必须是字符串` });
      continue;
    }
    const unsafe = findUnsafe(raw);
    if (unsafe) {
      push({ level: "error", code: "UNSAFE_VALUE", token: key, message: `令牌 "${key}" 的值不安全：${unsafe}` });
    }
  }

  // 3. 缺项检测
  for (const def of TOKEN_DEFS) {
    if (!(def.path in tokens)) {
      push({ level: "error", code: "MISSING_TOKEN", token: def.path, message: `缺少必需令牌 "${def.path}"（${def.label}）` });
    }
  }

  // 4. 别名解析（DFS，检测循环 / 引用缺失 / 类型不匹配）
  const values: Record<string, string> = {};
  const state = new Map<string, "visiting" | "done">();

  const resolveOne = (path: string, chain: string[]): string | null => {
    if (state.get(path) === "done") return values[path] ?? null;
    const def = DEF_BY_PATH.get(path);
    const raw = tokens[path];
    if (!def || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    const m = ALIAS_PATTERN.exec(trimmed);
    if (!m) {
      values[path] = trimmed;
      state.set(path, "done");
      return trimmed;
    }
    const target = m[1];
    const targetDef = DEF_BY_PATH.get(target);
    if (!targetDef || typeof tokens[target] !== "string") {
      push({ level: "error", code: "ALIAS_MISSING", token: path, message: `"${path}" 引用了不存在的令牌 "${target}"` });
      state.set(path, "done");
      return null;
    }
    if (chain.includes(target)) {
      push({ level: "error", code: "ALIAS_CYCLE", token: path, message: `检测到循环引用：${[...chain, target].join(" → ")}` });
      state.set(path, "done");
      return null;
    }
    if (targetDef.type !== def.type) {
      push({ level: "error", code: "ALIAS_TYPE_MISMATCH", token: path, message: `"${path}"（${def.type}）不能引用类型为 ${targetDef.type} 的 "${target}"` });
      state.set(path, "done");
      return null;
    }
    state.set(path, "visiting");
    const resolved = resolveOne(target, [...chain, path]);
    state.set(path, "done");
    if (resolved === null) return null;
    values[path] = resolved;
    return resolved;
  };

  for (const def of TOKEN_DEFS) resolveOne(def.path, []);

  // 5. 字面值类型校验
  for (const def of TOKEN_DEFS) {
    const val = values[def.path];
    if (val === undefined) continue;
    if (!isValidValueForType(def.type, val)) {
      push({ level: "error", code: "INVALID_VALUE", token: def.path, message: `"${def.path}" 的值 "${val}" 不是合法的 ${def.type === "color" ? "颜色" : "尺寸"}` });
    }
  }

  return { values, issues };
}
