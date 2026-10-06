import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import {
  BrandDetail,
  BrandVersion,
  ExportPreview,
  ReferenceGraph as GraphData,
  SchemaResponse,
  TokenIssue,
  brandApi
} from "@/api/brand";
import TokenEditor from "./TokenEditor";
import ReferenceGraph from "./ReferenceGraph";
import Skeleton from "@/components/Skeleton";

const ConsolePage = () => {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [draft, setDraft] = useState<BrandVersion | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [issues, setIssues] = useState<TokenIssue[]>([]);
  const [activeGroup, setActiveGroup] = useState("editorButton");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadBrand = useCallback(async () => {
    const [schemaData, brands] = await Promise.all([brandApi.schema(), brandApi.brands()]);
    setSchema(schemaData);
    if (brands.length > 0) {
      const detail = await brandApi.brandDetail(brands[0].id);
      setBrand(detail);
      if (detail.draft) {
        setDraft(detail.draft);
        setTokens({ ...detail.draft.tokens });
        setNote(detail.draft.note ?? "");
      }
    }
  }, []);

  useEffect(() => {
    loadBrand().catch(() => undefined);
  }, [loadBrand]);

  // 令牌变化 → 防抖校验 + 刷新引用图 / 导出预览
  useEffect(() => {
    if (!draft || !dirty) return;
    clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(async () => {
      try {
        const result = await brandApi.validate(draft.id, tokens);
        setIssues(result.issues);
      } catch {
        /* 拦截器已提示 */
      }
    }, 400);
    return () => clearTimeout(validateTimer.current);
  }, [tokens, dirty, draft]);

  const refreshArtifacts = useCallback(async (versionId: string) => {
    try {
      const [g, p] = await Promise.all([brandApi.referenceGraph(versionId), brandApi.exportPreview(versionId)]);
      setGraph(g);
      setPreview(p);
    } catch {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    if (draft) refreshArtifacts(draft.id);
  }, [draft, refreshArtifacts]);

  const issueByToken = useMemo(() => {
    const map = new Map<string, TokenIssue>();
    for (const issue of issues) {
      if (issue.token && !map.has(issue.token)) map.set(issue.token, issue);
    }
    return map;
  }, [issues]);

  const errorCount = issues.filter((i) => i.level === "error").length;
  const warningCount = issues.filter((i) => i.level === "warning").length;

  const onTokenChange = (path: string, value: string) => {
    setTokens((prev) => ({ ...prev, [path]: value }));
    setDirty(true);
  };

  const onCreateDraft = async (baseVersionId?: string) => {
    if (!brand) return;
    try {
      const created = await brandApi.createDraft(brand.id, baseVersionId);
      setDraft(created);
      setTokens({ ...created.tokens });
      setNote("");
      setIssues([]);
      setDirty(false);
      toast.success("已创建草稿");
    } catch {
      /* 拦截器已提示 */
    }
  };

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await brandApi.saveDraft(draft.id, tokens, note || null, draft.lockVersion);
      setDraft(saved);
      setDirty(false);
      toast.success("草稿已保存");
      refreshArtifacts(saved.id);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error("草稿已被其他管理员修改，正在刷新…");
        await loadBrand();
      } else if (status === 422) {
        const details = (err as { response?: { data?: { details?: TokenIssue[] } } })?.response?.data?.details;
        if (details) setIssues(details);
      }
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      if (dirty) {
        const saved = await brandApi.saveDraft(draft.id, tokens, note || null, draft.lockVersion);
        setDraft(saved);
        setDirty(false);
        const published = await brandApi.publish(saved.id, saved.lockVersion);
        toast.success(`已发布品牌规范 v${published.versionNumber}`);
        afterPublish();
        return;
      }
      const published = await brandApi.publish(draft.id, draft.lockVersion);
      toast.success(`已发布品牌规范 v${published.versionNumber}`);
      afterPublish();
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: { code?: string; details?: TokenIssue[]; message?: string } } })?.response;
      if (resp?.status === 409) {
        toast.error("并发发布冲突：其他管理员已先操作，正在刷新…");
        await loadBrand();
      } else if (resp?.status === 422) {
        toast.error("校验未通过，无法发布");
        if (resp.data?.details) setIssues(resp.data.details);
      } else if (resp?.data?.code === "STYLE_BUILD_FAILED") {
        toast.error(resp.data.message ?? "样式构建失败，版本未发布");
      }
    } finally {
      setPublishing(false);
    }
  };

  const afterPublish = () => {
    setDraft(null);
    setGraph(null);
    setPreview(null);
    loadBrand();
  };

  if (!schema || !brand) {
    return <Skeleton />;
  }

  if (!draft) {
    const published = brand.versions.filter((v) => v.status === "published");
    return (
      <div className="rounded-3xl bg-white/90 border border-white/70 shadow-card p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">当前没有编辑中的草稿</h2>
        <p className="mt-2 text-sm text-slate-500">
          最新已发布版本：{brand.latestPublished ? `v${brand.latestPublished.versionNumber}` : "无"}
        </p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => onCreateDraft()}
            className="rounded-xl bg-primary px-5 py-2.5 text-white font-medium transition hover:bg-primary/90"
          >
            基于最新版本创建草稿
          </button>
          {published.map((v) => (
            <button
              key={v.id}
              onClick={() => onCreateDraft(v.id)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:border-primary hover:text-primary"
            >
              基于 v{v.versionNumber} 创建
            </button>
          ))}
        </div>
      </div>
    );
  }

  const groupDefs = schema.defs.filter((d) => d.group === activeGroup);

  return (
    <div className="space-y-6">
      {/* 状态栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 border border-white/70 shadow-card px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">草稿编辑中</span>
          <span className="text-xs text-slate-400">锁版本 {draft.lockVersion} · 创建人 {draft.createdBy}</span>
          {dirty && <span className="text-xs text-indigo-500">有未保存修改</span>}
          {errorCount > 0 && <span className="text-xs font-medium text-red-600">{errorCount} 个错误</span>}
          {warningCount > 0 && <span className="text-xs font-medium text-amber-600">{warningCount} 个警告</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving || publishing}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存草稿"}
          </button>
          <button
            onClick={onPublish}
            disabled={publishing || saving || errorCount > 0}
            title={errorCount > 0 ? "存在校验错误，无法发布" : "发布为新版本"}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {publishing ? "发布中…" : "发布版本"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4">
          {/* 分组切换 */}
          <div className="flex flex-wrap gap-2">
            {schema.groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                  activeGroup === g.key ? "bg-slate-900 text-white" : "bg-white/80 text-slate-600 hover:bg-slate-100"
                )}
              >
                {g.title}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">{schema.groups.find((g) => g.key === activeGroup)?.desc}</p>

          {/* 令牌编辑列表 */}
          <div className="space-y-3">
            {groupDefs.map((def) => (
              <TokenEditor
                key={def.path}
                def={def}
                value={tokens[def.path] ?? ""}
                allPaths={schema.defs.filter((d) => d.type === def.type).map((d) => d.path)}
                issue={issueByToken.get(def.path) ?? null}
                onChange={onTokenChange}
              />
            ))}
          </div>

          <label className="block rounded-2xl bg-white/80 border border-slate-200 p-4">
            <span className="text-sm text-slate-600">版本备注</span>
            <input
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              placeholder="本次品牌调整说明…"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:border-primary"
            />
          </label>
        </div>

        {/* 侧栏：校验结果 / 导出预览 / 引用图 */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-2xl bg-white/90 border border-white/70 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-900">校验结果</h3>
            {issues.length === 0 ? (
              <p className="mt-2 text-xs text-emerald-600">✓ 全部校验通过：别名、对比度、系统保护、安全扫描</p>
            ) : (
              <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {issues.map((issue, idx) => (
                  <li
                    key={idx}
                    className={clsx(
                      "rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed",
                      issue.level === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    )}
                  >
                    <span className="font-mono">[{issue.code}]</span> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {preview && (
            <section className="rounded-2xl bg-white/90 border border-white/70 shadow-card p-4">
              <h3 className="text-sm font-semibold text-slate-900">导出预览</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                与编译产物同源 · tokenHash <code className="text-indigo-500">{preview.tokenHash}</code>
              </p>
              <div className="mt-3 space-y-3 rounded-xl bg-slate-900 p-4">
                <div className="flex justify-end">
                  <span style={preview.inline.exportBadge as React.CSSProperties} className="px-3 py-1 text-xs font-medium">
                    云溪出品
                  </span>
                </div>
                <p className="text-center">
                  <span style={preview.inline.subtitle as React.CSSProperties} className="px-2 py-0.5 rounded text-sm">
                        云溪四季，自然与创作共生
                  </span>
                </p>
              </div>
              <button style={preview.inline.primaryButton as React.CSSProperties} className="mt-3 w-full px-4 py-2 text-sm font-medium">
                主按钮预览
              </button>
            </section>
          )}
        </aside>
      </div>

      {/* 引用图 */}
      {graph && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">令牌引用图（别名有向边，红色为循环）</h3>
          <ReferenceGraph graph={graph} />
        </section>
      )}
    </div>
  );
};

export default ConsolePage;
