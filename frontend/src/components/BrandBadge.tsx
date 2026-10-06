import { Link } from "react-router-dom";
import { useBrandTheme } from "@/theme/ThemeProvider";

/** 页头品牌版本徽章：展示“实际生效版本”（已加载样式产物的版本），而非假设的最新版本 */
const BrandBadge = () => {
  const { applied, latest, stale, applyLatest } = useBrandTheme();

  if (!applied) {
    return (
      <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        品牌主题加载中…
      </span>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      <Link
        to="/brand"
        title={`令牌哈希 ${applied.version.tokenHash} · 样式哈希 ${applied.version.cssHash}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        生效版本 v{applied.version.versionNumber} · {applied.version.cssHash.slice(0, 6)}
      </Link>
      {stale && latest && (
        <button
          onClick={applyLatest}
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition"
          title="设备缓存了旧包，点击切换到最新版本"
        >
          有 v{latest.version.versionNumber} 可用 · 点击更新
        </button>
      )}
    </div>
  );
};

export default BrandBadge;
