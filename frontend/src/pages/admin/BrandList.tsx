import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { BrandVersionSummary, createDraft, fetchBrandVersions } from "@/api/brand";
import clsx from "clsx";

const statusMeta: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  published: { label: "已发布", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  archived: { label: "已归档", cls: "bg-amber-50 text-amber-700 border-amber-200" }
};

const BrandList = () => {
  const [versions, setVersions] = useState<BrandVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVersion, setNewVersion] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setVersions(await fetchBrandVersions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d+\.\d+\.\d+$/.test(newVersion.trim())) {
      toast.error("版本号必须是 x.y.z 形式，如 1.2.0");
      return;
    }
    setCreating(true);
    try {
      const draft = await createDraft(newVersion.trim());
      toast.success(`草稿 v${draft.version} 已创建（基于最新发布复制）`);
      navigate(`/admin/brands/${draft.id}`);
    } catch {
      /* 拦截器已提示（含 409 版本号冲突） */
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">品牌版本</h1>
          <p className="text-sm text-slate-500 mt-1">
            令牌版本化管理：草稿编辑 → 校验 → 发布；发布生成内容寻址的编译时样式产物。
          </p>
        </div>
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <input
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
            placeholder="新版本号，如 1.2.0"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm w-44 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button type="submit" disabled={creating} className="bk-btn bk-btn-primary text-sm disabled:opacity-60">
            {creating ? "创建中…" : "+ 新建草稿"}
          </button>
        </form>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">版本</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">修订号</th>
                <th className="px-5 py-3 font-medium">内容哈希</th>
                <th className="px-5 py-3 font-medium">发布时间</th>
                <th className="px-5 py-3 font-medium">创建人</th>
                <th className="px-5 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                  <td className="px-5 py-3.5 font-semibold text-slate-900">v{v.version}</td>
                  <td className="px-5 py-3.5">
                    <span className={clsx("inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold", statusMeta[v.status]?.cls)}>
                      {statusMeta[v.status]?.label ?? v.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">r{v.revision}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                    {v.contentHash ? v.contentHash.slice(0, 12) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString("zh-CN") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{v.createdBy}</td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    {v.status === "draft" ? (
                      <Link to={`/admin/brands/${v.id}`} className="text-primary font-medium hover:underline">
                        编辑令牌
                      </Link>
                    ) : (
                      <>
                        <Link to={`/admin/brands/${v.id}`} className="text-slate-600 font-medium hover:underline">
                          查看
                        </Link>
                        <a
                          href={`/api/brands/${v.id}/asset.css`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-600 font-medium hover:underline"
                        >
                          编译产物
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BrandList;
