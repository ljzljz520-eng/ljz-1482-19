import { Link, useLocation } from "react-router-dom";
import { ReactNode, useMemo } from "react";
import { useUIStore } from "@/store/uiStore";
import { useThemeVersion } from "@/theme/ThemeProvider";
import VersionBadge from "./VersionBadge";
import clsx from "clsx";

const navItems = [
  { path: "/", label: "公园总览" },
  { path: "/audiovisual", label: "视听体验" },
  { path: "/timeline", label: "时间轴" }
];

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { isMenuOpen, toggleMenu } = useUIStore();
  const theme = useThemeVersion();

  const activeMatch = useMemo(() => pathname, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 品牌升级提示：本地记录版本 ≠ 服务端实际生效版本（覆盖“设备缓存旧包”场景） */}
      {theme.upgradedFrom && (
        <div className="bg-gradient-to-r from-primary to-accent text-white text-center text-xs py-1.5 px-4">
          品牌规范已更新：v{theme.upgradedFrom} → v{theme.version}，页面样式已按最新生效版本渲染
        </div>
      )}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card flex items-center justify-center text-white font-bold">
              云溪
            </span>
            <div>
              <p className="text-sm text-slate-500">城市微度假</p>
              <h1 className="text-lg font-semibold text-slate-900">云溪公园</h1>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "px-3 py-2 rounded-full text-sm font-medium transition hover:bg-primary/10",
                  activeMatch === item.path
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="hidden md:inline-flex px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:bg-primary/10 hover:text-primary transition"
            >
              品牌管理
            </Link>
            <button
              onClick={toggleMenu}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full border border-slate-200 hover:border-primary hover:text-primary transition"
              aria-label="Toggle menu"
            >
              <span className="block h-0.5 w-5 bg-current relative">
                <span className="block absolute -top-1.5 h-0.5 w-5 bg-current" />
                <span className="block absolute top-1.5 h-0.5 w-5 bg-current" />
              </span>
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95">
            <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    "px-3 py-2 rounded-xl text-sm font-medium transition hover:bg-primary/10",
                    activeMatch === item.path
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600"
                  )}
                  onClick={toggleMenu}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/admin"
                className="px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-primary/10"
                onClick={toggleMenu}
              >
                品牌管理
              </Link>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">© 2026 云溪公园 · 自然与创作共生</p>
          {/* 实际生效品牌版本：来自服务端 effective 接口 */}
          <VersionBadge />
          <div className="flex gap-3 text-sm text-slate-500">
            <span>开放时间：06:00 - 22:00</span>
            <span>服务热线：400-123-4567</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
