import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  BrandVersionDetail,
  ValidateResponse,
  fetchBrandVersion,
  publishVersion,
  saveDraft,
  validateTokens
} from "@/api/brand";
import clsx from "clsx";

/* ---------- 令牌树工具 ---------- */
type TokenTree = Record<string, unknown>;

const isAlias = (v: unknown): v is { alias: string } =>
  typeof v === "object" && v !== null && Object.keys(v as object).length === 1 && typeof (v as { alias?: unknown }).alias === "string";

const isLeaf = (v: unknown) => typeof v === "string" || typeof v === "number" || isAlias(v);

function getAtPath(tree: TokenTree, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (typeof node === "object" && node !== null) return (node as TokenTree)[key];
    return undefined;
  }, tree);
}

function setAtPath(tree: TokenTree, path: string, value: unknown): TokenTree {
  const keys = path.split(".");
  const clone: TokenTree = { ...tree };
  let node = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    node[keys[i]] = { ...(node[keys[i]] as TokenTree) };
    node = node[keys[i]] as TokenTree;
  }
  node[keys[keys.length - 1]] = value;
  return clone;
}

interface LeafRow {
  path: string;
  key: string;
  value: string | number | { alias: string };
}

function collectLeaves(node: unknown, prefix: string): LeafRow[] {
  if (typeof node !== "object" || node === null) return [];
  const rows: LeafRow[] = [];
  for (const [key, value] of Object.entries(node as TokenTree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isLeaf(value)) rows.push({ path, key, value: value as LeafRow["value"] });
    else rows.push(...collectLeaves(value, path));
  }
  return rows;
}

const CATEGORIES = [
  { ns: "color", label: "调色板", desc: "基础色板，可被其他令牌以别名引用" },
  { ns: "button", label: "按钮", desc: "primary / secondary / danger 各状态" },
  { ns: "steps", label: "步骤条", desc: "进行中 / 已完成 / 待处理" },
  { ns: "asset", label: "素材状态", desc: "就绪 / 处理中 / 错误 / 选中" },
  { ns: "export", label: "导出标识", desc: "导出徽章与成片字幕" },
  { ns: "focus", label: "键盘焦点", desc: "焦点环颜色与宽度（必须可见）" }
];

const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/* ---------- 页面 ---------- */
const BrandEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<BrandVersionDetail | null>(null);
  const [tokens, setTokens] = useState<TokenTree>({});
  const [activeNs, setActiveNs] = useState("color");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const validateTimer = useRef<ReturnType<typeof setTimeout>>();

  const isDraft = detail?.status === "draft";

  useEffect(() => {
    if (!id) return;
    fetchBrandVersion(id).then((d) => {
      setDetail(d);
      setTokens(d.tokens as TokenTree);
    });
  }, [id]);

  /* 实时校验（防抖 500ms）：别名循环/缺项、对比度、错误语义、焦点可见性 */
  useEffect(() => {
    if (!detail || Object.keys(tokens).length === 0) return;
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(async () => {
      setValidating(true);
      try {
        setValidation(await validateTokens(tokens));
      } catch {
        /* 拦截器已提示 */
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
  }, [tokens, detail]);

  const updateLeaf = (path: string, value: unknown) => {
    setTokens((t) => setAtPath(t, path, value));
    setDirty(true);
  };

  const onSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const saved = await saveDraft(detail.id, tokens, detail.revision);
      setDetail(saved);
      setDirty(false);
      toast.success(`草稿已保存（r${saved.revision}）`);
    } catch {
      /* 409/422 由拦截器提示，issues 已通过实时校验展示 */
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!detail) return;
    if (validation && !validation.ok) {
      toast.error("存在校验错误，无法发布");
      return;
    }
    setPublishing(true);
    try {
      const published = await publishVersion(detail.id, detail.revision);
      setDetail(published);
      setDirty(false);
      toast.success(`v${published.version} 发布成功，内容哈希 ${published.contentHash.slice(0, 12)}`);
    } catch {
      /* 并发发布 → 409，拦截器已提示 */
    } finally {
      setPublishing(false);
    }
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as TokenTree;
      setTokens(parsed);
      setDirty(true);
      setShowJson(false);
      toast.success("已应用 JSON 编辑");
    } catch {
      toast.error("JSON 格式错误");
    }
  };

  const leaves = useMemo(() => collectLeaves(tokens[activeNs], activeNs), [tokens, activeNs]);
  const issuePaths = useMemo(() => new Map((validation?.issues ?? []).map((i) => [i.path, i])), [validation]);

  if (!detail) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded-xl bg-slate-200 animate-pulse" />
        <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/admin/brands" className="text-slate-400 hover:text-primary transition text-sm">← 版本列表</Link>
            <h1 className="text-2xl font-bold text-slate-900">v{detail.version}</h1>
            <span
              className={clsx(
                "px-2.5 py-1 rounded-full border text-xs font-semibold",
                isDraft ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}
            >
              {isDraft ? `草稿 · r${detail.revision}` : "已发布"}
            </span>
            {dirty && <span className="text-xs text-amber-600 font-medium">● 未保存</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            值支持字面值或别名（如 <code className="text-xs bg-slate-100 px-1 rounded">color.primary</code>）；
            system.* 为平台保留，错误语义与键盘焦点可见性不可覆盖。
          </p>
        </div>
        {isDraft && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setJsonText(JSON.stringify(tokens, null, 2)); setShowJson(true); }} className="bk-btn bk-btn-secondary text-sm">
              JSON 视图
            </button>
            <button onClick={onSave} disabled={saving || !dirty} className="bk-btn bk-btn-secondary text-sm disabled:opacity-50">
              {saving ? "保存中…" : "保存草稿"}
            </button>
            <button
              onClick={onPublish}
              disabled={publishing || (validation !== null && !validation.ok)}
              className="bk-btn bk-btn-primary text-sm disabled:opacity-50"
              title={validation && !validation.ok ? "存在校验错误" : "发布为不可变版本"}
            >
              {publishing ? "发布中…" : "发布版本"}
            </button>
          </div>
        )}
      </header>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* 左：分类令牌编辑 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="flex flex-wrap border-b border-slate-100">
            {CATEGORIES.map((c) => (
              <button
                key={c.ns}
                onClick={() => setActiveNs(c.ns)}
                className={clsx(
                  "px-4 py-3 text-sm font-medium border-b-2 transition",
                  activeNs === c.ns
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="px-5 py-3 text-xs text-slate-400 bg-slate-50/60 border-b border-slate-100">
            {CATEGORIES.find((c) => c.ns === activeNs)?.desc}
          </div>
          <div className="divide-y divide-slate-50">
            {leaves.map((leaf) => (
              <LeafEditor
                key={leaf.path}
                leaf={leaf}
                issue={issuePaths.get(leaf.path)}
                readOnly={!isDraft}
                onChange={updateLeaf}
              />
            ))}
            {leaves.length === 0 && <p className="px-5 py-8 text-sm text-slate-400">该分类暂无令牌</p>}
          </div>
        </div>

        {/* 右：校验面板 */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">服务端校验</h3>
              {validating ? (
                <span className="text-xs text-slate-400">校验中…</span>
              ) : validation ? (
                <span className={clsx("text-xs font-semibold", validation.ok ? "text-emerald-600" : "text-red-600")}>
                  {validation.ok ? "✓ 全部通过" : `✗ ${validation.issues.length} 个问题`}
                </span>
              ) : null}
            </div>
            {validation && validation.issues.length > 0 && (
              <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                {validation.issues.map((issue, idx) => (
                  <li key={idx} className="text-xs rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                    <p className="font-mono text-red-700">{issue.path || "(root)"}</p>
                    <p className="text-red-600 mt-0.5">{issue.message}</p>
                    <p className="text-red-400 mt-0.5">{issue.code}</p>
                  </li>
                ))}
              </ul>
            )}
            {validation && validation.contrast.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">对比度实测（WCAG）</p>
                <ul className="space-y-1.5 max-h-56 overflow-auto pr-1">
                  {validation.contrast.map((c) => (
                    <li key={c.pair} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 truncate mr-2" title={c.pair}>{c.pair}</span>
                      <span className={clsx("font-mono font-semibold shrink-0", c.pass ? "text-emerald-600" : "text-red-600")}>
                        {c.ratio.toFixed(2)} {c.pass ? "≥" : "<"} {c.min}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="bg-slate-900 rounded-2xl p-5 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-slate-100">发布保障</p>
            <p>· 乐观锁：并发发布时后者收到 409</p>
            <p>· 发布后不可变，内容哈希寻址</p>
            <p>· 编译产物与运行时变量同源生成</p>
          </div>
        </aside>
      </div>

      {/* JSON 视图抽屉 */}
      {showJson && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowJson(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900">令牌 JSON（保存前将经过服务端完整校验）</h3>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full h-80 font-mono text-xs rounded-xl border border-slate-200 p-4 outline-none focus:border-primary"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowJson(false)} className="bk-btn bk-btn-secondary text-sm">取消</button>
              <button onClick={applyJson} className="bk-btn bk-btn-primary text-sm">应用</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- 单个令牌行 ---------- */
const LeafEditor = ({
  leaf,
  issue,
  readOnly,
  onChange
}: {
  leaf: LeafRow;
  issue?: { code: string; message: string };
  readOnly: boolean;
  onChange: (path: string, value: unknown) => void;
}) => {
  const aliasMode = isAlias(leaf.value);
  const strValue = isAlias(leaf.value) ? leaf.value.alias : String(leaf.value);
  const isColorLike = !aliasMode && COLOR_RE.test(strValue);

  return (
    <div className={clsx("px-5 py-3 flex flex-wrap items-center gap-3", issue && "bg-red-50/50")}>
      <div className="w-56 shrink-0">
        <p className="font-mono text-xs text-slate-700">{leaf.path}</p>
        {issue && <p className="text-[11px] text-red-600 mt-0.5">{issue.message}</p>}
      </div>
      {isColorLike && (
        <span className="h-7 w-7 rounded-lg border border-slate-200 shrink-0" style={{ background: strValue }} />
      )}
      <input
        value={strValue}
        readOnly={readOnly}
        onChange={(e) => {
          const v = e.target.value;
          onChange(leaf.path, aliasMode ? { alias: v } : /^\d+$/.test(v) && leaf.key === "fontWeight" ? Number(v) : v);
        }}
        placeholder={aliasMode ? "别名路径，如 color.primary" : "字面值，如 #165DFF / 12px"}
        className={clsx(
          "flex-1 min-w-[220px] font-mono text-xs rounded-lg border px-3 py-2 outline-none transition",
          issue ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-primary",
          readOnly && "bg-slate-50 text-slate-500"
        )}
        spellCheck={false}
      />
      {!readOnly && (
        <button
          onClick={() =>
            onChange(leaf.path, aliasMode ? "#165DFF" : { alias: "color.primary" })
          }
          className={clsx(
            "text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition shrink-0",
            aliasMode
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
          )}
          title={aliasMode ? "当前为别名引用，点击切换为字面值" : "当前为字面值，点击切换为别名引用"}
        >
          {aliasMode ? "@别名" : "字面值"}
        </button>
      )}
    </div>
  );
};

export default BrandEditor;
