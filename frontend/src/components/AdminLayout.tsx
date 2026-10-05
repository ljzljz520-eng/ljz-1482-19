import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { storage } from "@/utils/storage";
import { ADMIN_TOKEN_KEY } from "@/api/client";
import VersionBadge from "./VersionBadge";
import clsx from "clsx";

const navItems = [
  { path: "/admin/brands", label: "品牌版本", icon: "🎨" },
  { path: "/admin/projects", label: "项目绑定", icon: "🔗" },
  { path: "/admin/preview", label: "视觉验证", icon: "🧪" }
];

const AdminLayout = () => {
  const token = storage.get<string | null>(ADMIN_TOKEN_KEY, null);
  const location = useLocation();
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  const logout = () => {
    storage.remove(ADMIN_TOKEN_KEY);
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shadow-card">
              牌
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">品牌规范中心</p>
              <p className="text-xs text-slate-400">BrandSpec Console</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition",
                  isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                )
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-3">
          <VersionBadge />
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xs text-slate-500 hover:text-primary transition">
              ← 返回站点
            </Link>
            <button onClick={logout} className="text-xs text-slate-500 hover:text-red-600 transition">
              退出登录
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
