import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { BrandDetail, Project, brandApi } from "@/api/brand";
import Skeleton from "@/components/Skeleton";
import { useBrandTheme } from "@/theme/ThemeProvider";

const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [pinChoice, setPinChoice] = useState<Record<string, string>>({});
  const { applied } = useBrandTheme();

  const load = useCallback(async () => {
    const [projectList, brands] = await Promise.all([brandApi.projects(), brandApi.brands()]);
    setProjects(projectList);
    if (brands.length > 0) setBrand(await brandApi.brandDetail(brands[0].id));
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onBind = async (project: Project, mode: "follow" | "pin") => {
    try {
      const pinnedVersionId = mode === "pin" ? pinChoice[project.id] ?? project.pinnedVersionId : null;
      if (mode === "pin" && !pinnedVersionId) {
        toast.error("请选择要固定的版本");
        return;
      }
      await brandApi.setBinding(project.id, mode, pinnedVersionId);
      toast.success(mode === "follow" ? "已切换为跟随最新发布" : "已固定到指定版本");
      await load();
    } catch {
      /* 拦截器已提示 */
    }
  };

  if (!projects || !brand) return <Skeleton />;

  const publishedVersions = brand.versions.filter((v) => v.status === "published" && v.versionNumber !== null);

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {projects.map((project) => {
        const effective = project.effectiveVersion;
        const isWebProject = project.slug === "official-site";
        const webStale = isWebProject && applied && effective && applied.version.cssHash !== effective.cssHash;
        return (
          <section key={project.id} className="rounded-3xl bg-white/90 border border-white/70 shadow-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{project.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{project.slug}</p>
              </div>
              {project.pendingAssets > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  {project.pendingAssets} 个素材待复核
                </span>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">当前生效版本</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {effective ? `v${effective.versionNumber}` : "无已发布版本"}
                {effective && <code className="ml-2 text-xs font-normal text-slate-400">{effective.cssHash}</code>}
              </p>
              {webStale && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠ 本页面实际生效 v{applied!.version.versionNumber}（设备缓存旧包），可在页头点击更新
                </p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 cursor-pointer transition hover:border-primary/50">
                <input
                  type="radio"
                  name={`mode-${project.id}`}
                  checked={project.bindingMode === "follow"}
                  onChange={() => onBind(project, "follow")}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">跟随最新发布</p>
                  <p className="text-xs text-slate-400">品牌发布后自动升级，素材变更进入复核队列</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 cursor-pointer transition hover:border-primary/50">
                <input
                  type="radio"
                  name={`mode-${project.id}`}
                  checked={project.bindingMode === "pin"}
                  onChange={() => onBind(project, "pin")}
                  className="accent-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">固定版本</p>
                  <p className="text-xs text-slate-400">锁定在指定版本，品牌升级不影响该项目</p>
                </div>
                <select
                  value={pinChoice[project.id] ?? project.pinnedVersionId ?? ""}
                  onChange={(e) => {
                    setPinChoice((prev) => ({ ...prev, [project.id]: e.target.value }));
                    if (project.bindingMode === "pin") {
                      brandApi.setBinding(project.id, "pin", e.target.value).then(load).catch(() => undefined);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
                >
                  <option value="" disabled>
                    选择版本
                  </option>
                  {publishedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ProjectsPage;
