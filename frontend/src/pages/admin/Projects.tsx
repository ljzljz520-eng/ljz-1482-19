import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  BrandVersionSummary,
  ProjectInfo,
  SubtitleItem,
  fetchBrandVersions,
  fetchProjects,
  fetchSubtitles,
  reviewSubtitle,
  updateBinding
} from "@/api/brand";
import clsx from "clsx";

const Projects = () => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [published, setPublished] = useState<BrandVersionSummary[]>([]);
  const [subtitles, setSubtitles] = useState<Record<string, SubtitleItem[]>>({});
  const [pinChoice, setPinChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [ps, vs] = await Promise.all([fetchProjects(), fetchBrandVersions()]);
    setProjects(ps);
    setPublished(vs.filter((v) => v.status === "published"));
    const subs: Record<string, SubtitleItem[]> = {};
    for (const p of ps) {
      const res = await fetchSubtitles(p.slug);
      subs[p.slug] = res.subtitles;
    }
    setSubtitles(subs);
  };

  useEffect(() => {
    void load();
  }, []);

  const changeMode = async (p: ProjectInfo, mode: "follow" | "pin") => {
    setBusy(p.id);
    try {
      if (mode === "follow") {
        await updateBinding(p.id, { mode: "follow" });
        toast.success(`「${p.name}」已切换为跟随最新发布`);
      } else {
        const versionId = pinChoice[p.id] || p.effectiveVersion?.id;
        if (!versionId) {
          toast.error("请选择要固定的版本");
          return;
        }
        await updateBinding(p.id, { mode: "pin", versionId });
        toast.success(`「${p.name}」已固定到所选版本`);
      }
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setBusy(null);
    }
  };

  const onReview = async (slug: string, subtitleId: string) => {
    setBusy(subtitleId);
    try {
      await reviewSubtitle(subtitleId);
      toast.success("复核完成，字幕颜色已更新为当前品牌版本");
      await load();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">项目绑定</h1>
        <p className="text-sm text-slate-500 mt-1">
          品牌升级策略由项目自选：<b>跟随最新</b>自动采用新发布版本；<b>固定版本</b>锁定不变。
          已批准成片的字幕颜色在复核前永不随品牌升级变化。
        </p>
      </header>

      {projects.map((p) => (
        <section key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
              <p className="text-xs text-slate-400 font-mono">slug: {p.slug}</p>
            </div>
            {p.effectiveVersion && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                生效中 v{p.effectiveVersion.version} · hash {p.effectiveVersion.contentHash.slice(0, 8)}
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label
              className={clsx(
                "rounded-2xl border-2 p-4 cursor-pointer transition",
                p.bindMode === "follow" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`mode-${p.id}`}
                  checked={p.bindMode === "follow"}
                  onChange={() => void changeMode(p, "follow")}
                  disabled={busy === p.id}
                  className="accent-primary"
                />
                <span className="font-semibold text-slate-900 text-sm">跟随最新发布</span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 ml-6">
                新版本发布后自动升级；已批准字幕进入“待复核”且颜色保持不变。
              </p>
            </label>
            <div
              className={clsx(
                "rounded-2xl border-2 p-4 transition",
                p.bindMode === "pin" ? "border-primary bg-primary/5" : "border-slate-200"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`mode-${p.id}`}
                  checked={p.bindMode === "pin"}
                  onChange={() => {
                    const versionId = pinChoice[p.id] || p.effectiveVersion?.id;
                    if (versionId) void changeMode(p, "pin");
                    else toast.error("请先选择要固定的版本");
                  }}
                  disabled={busy === p.id}
                  className="accent-primary"
                />
                <span className="font-semibold text-slate-900 text-sm">固定版本</span>
              </div>
              <div className="flex items-center gap-2 mt-2.5 ml-6">
                <select
                  value={pinChoice[p.id] || p.pinnedVersionId || p.effectiveVersion?.id || ""}
                  onChange={(e) => setPinChoice((s) => ({ ...s, [p.id]: e.target.value }))}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                >
                  {published.map((v) => (
                    <option key={v.id} value={v.id}>v{v.version}</option>
                  ))}
                </select>
                {p.bindMode === "pin" && (
                  <button
                    onClick={() => void changeMode(p, "pin")}
                    disabled={busy === p.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    应用
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 成片字幕审批 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">成片字幕审批</h3>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 bg-slate-50/60">
                    <th className="px-4 py-2.5 font-medium">字幕内容</th>
                    <th className="px-4 py-2.5 font-medium">批准版本</th>
                    <th className="px-4 py-2.5 font-medium">快照颜色</th>
                    <th className="px-4 py-2.5 font-medium">状态</th>
                    <th className="px-4 py-2.5 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(subtitles[p.slug] ?? []).map((s) => (
                    <tr key={s.id} className="border-t border-slate-50">
                      <td className="px-4 py-3 text-slate-700">{s.content}</td>
                      <td className="px-4 py-3 text-slate-500">v{s.approvedVersion}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-5 w-5 rounded-md border border-slate-200" style={{ background: s.color }} />
                          <span className="font-mono text-xs text-slate-500">{s.color}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "approved" ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            已批准
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            待复核 · 颜色已冻结
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status === "needs_review" && (
                          <button
                            onClick={() => void onReview(p.slug, s.id)}
                            disabled={busy === s.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50"
                          >
                            复核通过
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(subtitles[p.slug] ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                        暂无字幕审批记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default Projects;
