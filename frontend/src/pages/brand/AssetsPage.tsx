import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { Asset, Project, brandApi } from "@/api/brand";
import Skeleton from "@/components/Skeleton";

const isColorValue = (v: string) => /^#|^rgb|^hsl/.test(v.trim());

const AssetsPage = () => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [assetsByProject, setAssetsByProject] = useState<Record<string, Asset[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const projectList = await brandApi.projects();
    setProjects(projectList);
    const entries = await Promise.all(
      projectList.map(async (p) => [p.id, await brandApi.projectAssets(p.id)] as const)
    );
    setAssetsByProject(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onReapprove = async (asset: Asset) => {
    setBusy(asset.id);
    try {
      await brandApi.reapproveAsset(asset.id);
      toast.success(`「${asset.name}」已复核通过，快照更新到当前生效版本`);
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setBusy(null);
    }
  };

  if (!projects) return <Skeleton />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100 px-5 py-4 text-sm text-indigo-800">
        已批准成片的渲染只认「批准快照」：品牌升级后，受影响的素材会被标记为待复核，复核通过前字幕颜色等不会变化。
      </div>
      {projects.map((project) => {
        const assets = assetsByProject[project.id] ?? [];
        return (
          <section key={project.id} className="rounded-3xl bg-white/90 border border-white/70 shadow-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{project.name}</h3>
              <span className="text-xs text-slate-400">
                {project.bindingMode === "follow" ? "跟随最新发布" : "固定版本"} · 生效 v{project.effectiveVersion?.versionNumber ?? "—"}
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {assets.length === 0 && <p className="text-sm text-slate-400">该项目暂无素材</p>}
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className={clsx(
                    "rounded-2xl border p-4",
                    asset.reviewStatus === "needs_re_review" ? "border-amber-300 bg-amber-50/50" : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          asset.reviewStatus === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {asset.reviewStatus === "approved" ? "已批准" : "待复核"}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{asset.name}</p>
                        <p className="text-xs text-slate-400">{asset.kind === "subtitle" ? "成片字幕" : "导出角标"}</p>
                      </div>
                    </div>
                    {asset.reviewStatus === "needs_re_review" && (
                      <button
                        onClick={() => onReapprove(asset)}
                        disabled={busy === asset.id}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {busy === asset.id ? "复核中…" : "复核通过（采用当前版本）"}
                      </button>
                    )}
                  </div>

                  {/* 快照渲染预览：证明未复核前成片不漂移 */}
                  {asset.kind === "subtitle" && (
                    <div className="mt-3 rounded-xl bg-slate-900 px-4 py-6 text-center">
                      <span
                        className="inline-block rounded px-2 py-0.5 text-sm"
                        style={{
                          color: asset.tokenSnapshot["export.subtitle.fg"],
                          backgroundColor: asset.tokenSnapshot["export.subtitle.bg"]
                        }}
                      >
                        云溪四季，自然与创作共生（批准快照渲染）
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3">
                    {asset.watchedTokens.map((path) => {
                      const value = asset.tokenSnapshot[path];
                      return (
                        <div key={path} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          {isColorValue(value ?? "") && (
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: value }} />
                          )}
                          <code>{path}</code>
                          <span className="text-slate-400">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default AssetsPage;
