import { TokenDef } from "@/api/brand";
import clsx from "clsx";

const ALIAS_RE = /^\{([A-Za-z0-9_.-]+)\}$/;

interface Props {
  def: TokenDef;
  value: string;
  allPaths: string[];
  issue?: { level: "error" | "warning"; message: string } | null;
  onChange: (path: string, value: string) => void;
}

/** 单个令牌编辑行：颜色选择器 / 尺寸输入 / 别名引用 */
const TokenEditor = ({ def, value, allPaths, issue, onChange }: Props) => {
  const aliasMatch = ALIAS_RE.exec(value.trim());
  const isAlias = !!aliasMatch;
  const isColor = def.type === "color";
  const colorValue = isColor && !isAlias && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#888888";

  return (
    <div
      className={clsx(
        "rounded-2xl border p-4 transition",
        issue?.level === "error"
          ? "border-red-300 bg-red-50/60"
          : issue
            ? "border-amber-300 bg-amber-50/60"
            : "border-slate-200 bg-white/80 hover:border-primary/40"
      )}
      data-token={def.path}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">{def.label}</span>
            <code className="text-[11px] text-slate-400">{def.path}</code>
            {def.isSystem && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white" title="系统保护令牌：错误语义与焦点可见性受约束">
                系统保护
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{def.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isColor && !isAlias && (
            <input
              type="color"
              value={colorValue}
              onChange={(e) => onChange(def.path, e.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white"
              aria-label={`${def.label} 颜色选择`}
            />
          )}
          <input
            value={value}
            onChange={(e) => onChange(def.path, e.target.value)}
            spellCheck={false}
            className={clsx(
              "w-44 rounded-lg border px-2.5 py-1.5 font-mono text-xs outline-none transition",
              issue?.level === "error" ? "border-red-400" : "border-slate-200 focus-visible:border-primary"
            )}
            placeholder={def.type === "color" ? "#165DFF 或 {brand.primary}" : "12px 或 {token}"}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {isAlias ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600">
            别名 → <code>{aliasMatch![1]}</code>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(def.path, "{brand.primary}")}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
            title="将该令牌改为别名引用"
          >
            转为别名
          </button>
        )}
        {isAlias && (
          <select
            value={aliasMatch![1]}
            onChange={(e) => onChange(def.path, `{${e.target.value}}`)}
            className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600"
          >
            {allPaths
              .filter((p) => p !== def.path)
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>
        )}
        {issue && (
          <span className={clsx("text-[11px]", issue.level === "error" ? "text-red-600" : "text-amber-600")}>
            {issue.message}
          </span>
        )}
      </div>
    </div>
  );
};

export default TokenEditor;
