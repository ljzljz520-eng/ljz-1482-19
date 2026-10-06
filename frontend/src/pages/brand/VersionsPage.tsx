import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { BrandDetail, brandApi } from "@/api/brand";
import Skeleton from "@/components/Skeleton";

interface AuditEvent {
  id: string;
  actor: string;
  result: string;
  detail: string | null;
  createdAt: string;
}

const RESULT_LABEL: Record<string, { label: string; cls: string }> = {
  published: { label: "发布成功", cls: "bg-emerald-100 text-emerald-700" },
  conflict: { label: "并发冲突", cls: "bg-amber-100 text-amber-700" },
  validation_failed: { label: "校验失败", cls: "bg-red-100 text-red-700" },
  build_failed: { label: "构建失败", cls: "bg-red-100 text-red-700" }
};

const VersionsPage = () => {
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const load = useCallback(async () => {
    const brands = await brandApi.brands();
    if (brands.length > 0) {
      setBrand(await brandApi.brandDetail(brands[0].id));
    }
    setEvents(await brandApi.audit());
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (!brand) return <Skeleton />;

  const versions = [...brand.versions].sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white/90 border border-white/70 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{brand.name} · 版本历史</h2>
          <p className="text-xs text-slate-400 mt-0.5">每个已发布版本对应一份内容哈希寻址的编译产物，可长期缓存</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-6 py-3 font-medium">版本</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">令牌哈希</th>
              <th className="px-4 py-3 font-medium">样式产物</th>
              <th className="px-4 py-3 font-medium">备注</th>
              <th className="px-4 py-3 font-medium">发布时间</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="border-b border-slate-50 hover:bg-primary/5 transition">
                <td className="px-6 py-3 font-semibold text-slate-900">
                  {v.versionNumber ? `v${v.versionNumber}` : "草稿"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      v.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {v.status === "published" ? "已发布" : v.status === "draft" ? "草稿" : "已归档"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{v.tokenHash ?? "—"}</td>
                <td className="px-4 py-3">
                  {v.cssHash ? (
                    <a
                      href={`/api/assets/brand-${v.cssHash}.css`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      brand-{v.cssHash}.css
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{v.note ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {v.publishedAt ? new Date(v.publishedAt).toLocaleString("zh-CN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl bg-white/90 border border-white/70 shadow-card p-6">
        <h2 className="font-semibold text-slate-900">发布审计</h2>
        <p className="text-xs text-slate-400 mt-0.5">包含并发冲突、校验失败与构建失败事件</p>
        <ul className="mt-4 space-y-2">
          {events.length === 0 && <li className="text-sm text-slate-400">暂无事件</li>}
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 text-sm flex-wrap">
              <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", RESULT_LABEL[e.result]?.cls ?? "bg-slate-100 text-slate-600")}>
                {RESULT_LABEL[e.result]?.label ?? e.result}
              </span>
              <span className="text-slate-600">{e.actor}</span>
              <span className="text-xs text-slate-400">{e.detail ?? ""}</span>
              <span className="ml-auto text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("zh-CN")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default VersionsPage;
