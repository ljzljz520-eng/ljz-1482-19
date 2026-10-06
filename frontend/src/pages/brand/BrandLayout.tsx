import { FormEvent, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import { brandApi } from "@/api/brand";
import { TOKEN_KEY } from "@/api/client";

const subNav = [
  { path: "/brand", label: "令牌控制台", end: true },
  { path: "/brand/versions", label: "版本与审计" },
  { path: "/brand/projects", label: "项目绑定" },
  { path: "/brand/assets", label: "素材复核" },
  { path: "/brand/verify", label: "视觉验证" }
];

const LoginPanel = ({ onLogin }: { onLogin: () => void }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await brandApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, token);
      toast.success("登录成功");
      onLogin();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 rounded-3xl bg-white/90 border border-white/70 shadow-card p-8">
      <h2 className="text-xl font-semibold text-slate-900">品牌规范后台</h2>
      <p className="mt-1 text-sm text-slate-500">令牌编辑、发布与项目绑定需要管理员身份</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-600">用户名</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-white font-medium transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
};

const BrandLayout = () => {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const onExpired = () => setAuthed(false);
    window.addEventListener("brand-auth-expired", onExpired);
    return () => window.removeEventListener("brand-auth-expired", onExpired);
  }, []);

  if (!authed) {
    return <LoginPanel onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">品牌规范服务</h1>
          <p className="text-sm text-slate-500 mt-1">设计令牌 → 校验 → 发布 → 项目绑定 → 素材复核 的全链路管理</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            setAuthed(false);
          }}
          className="rounded-full border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:border-primary hover:text-primary transition"
        >
          退出登录
        </button>
      </header>
      <nav className="mt-6 flex flex-wrap gap-2">
        {subNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                isActive ? "bg-primary text-white shadow-card" : "bg-white/80 text-slate-600 hover:bg-primary/10 hover:text-primary"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
};

export default BrandLayout;
