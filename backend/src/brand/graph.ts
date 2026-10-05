/**
 * 别名引用图：检测循环（含互指 A↔B）、缺失引用、别名两端类型一致性，
 * 并把别名解析为字面量（resolved map 供对比度校验与 CSS 生成使用）。
 */
import { Issue, LeafEntry, TokenLeaf, isAliasRef } from "./tokens";

export interface ResolveResult {
  issues: Issue[];
  /** path → 字面量（string|number），仅在无循环/缺项时完整 */
  resolved: Map<string, string | number>;
}

/**
 * @param leaves  用户令牌叶子
 * @param systemLeaves 平台保留令牌（system.*），用户可引用但不可定义
 */
export function resolveAliases(leaves: LeafEntry[], systemLeaves: LeafEntry[]): ResolveResult {
  const issues: Issue[] = [];
  const all = new Map<string, LeafEntry>();
  for (const l of [...systemLeaves, ...leaves]) all.set(l.path, l);

  // 1) 缺项检测
  for (const leaf of leaves) {
    if (isAliasRef(leaf.value) && !all.has(leaf.value.alias)) {
      issues.push({
        path: leaf.path,
        code: "ALIAS_MISSING",
        message: `别名引用了不存在的令牌 "${leaf.value.alias}"`
      });
    }
  }

  // 2) 循环检测（DFS 三色标记），报告完整环路径
  const color = new Map<string, 0 | 1 | 2>(); // 0=未访问 1=在栈中 2=完成
  const stack: string[] = [];
  const reportedCycles = new Set<string>();

  const dfs = (path: string) => {
    color.set(path, 1);
    stack.push(path);
    const leaf = all.get(path);
    if (leaf && isAliasRef(leaf.value)) {
      const target = leaf.value.alias;
      const state = color.get(target) ?? 0;
      if (state === 1) {
        const cycleStart = stack.indexOf(target);
        const cycle = [...stack.slice(cycleStart), target];
        const key = cycle.slice(0, -1).sort().join("|");
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key);
          issues.push({
            path,
            code: "ALIAS_CYCLE",
            message: `检测到别名循环引用：${cycle.join(" → ")}`
          });
        }
      } else if (state === 0 && all.has(target)) {
        dfs(target);
      }
    }
    stack.pop();
    color.set(path, 2);
  };

  for (const path of all.keys()) {
    if ((color.get(path) ?? 0) === 0) dfs(path);
  }

  // 3) 类型一致性 + 解析
  const resolved = new Map<string, string | number>();
  const resolving = new Set<string>();

  const resolveOne = (path: string): TokenLeaf | null => {
    if (resolved.has(path)) return resolved.get(path)!;
    if (resolving.has(path)) return null; // 环，已报告
    const leaf = all.get(path);
    if (!leaf) return null;
    if (!isAliasRef(leaf.value)) {
      resolved.set(path, leaf.value as string | number);
      return leaf.value;
    }
    resolving.add(path);
    const targetValue = resolveOne(leaf.value.alias);
    resolving.delete(path);
    if (targetValue === null || typeof targetValue === "object") return null;
    const targetLeaf = all.get(leaf.value.alias)!;
    if (targetLeaf.type !== leaf.type) {
      issues.push({
        path,
        code: "ALIAS_TYPE_MISMATCH",
        message: `别名类型不一致：${leaf.path}(${leaf.type}) → ${leaf.value.alias}(${targetLeaf.type})`
      });
      return null;
    }
    resolved.set(path, targetValue);
    return targetValue;
  };

  for (const path of all.keys()) resolveOne(path);

  return { issues, resolved };
}
