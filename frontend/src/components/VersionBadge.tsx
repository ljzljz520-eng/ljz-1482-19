import { useThemeVersion } from "@/theme/ThemeProvider";

/** 页脚“实际生效版本”徽章：数据来自服务端 effective 接口，而非构建期常量 */
const VersionBadge = () => {
  const theme = useThemeVersion();

  if (!theme.loaded) {
    return <span className="text-xs text-slate-400">品牌版本加载中…</span>;
  }
  if (!theme.available) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        运行时主题不可用 · 使用内置默认样式
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
      title={`contentHash: ${theme.contentHash}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      品牌 v{theme.version} · {theme.bindMode === "pin" ? "固定版本" : "跟随最新"} · hash {theme.contentHash.slice(0, 8)}
    </span>
  );
};

export default VersionBadge;
