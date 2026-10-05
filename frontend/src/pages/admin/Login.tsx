import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { login } from "@/api/brand";
import { storage } from "@/utils/storage";
import { ADMIN_TOKEN_KEY } from "@/api/client";

const Login = () => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      storage.set(ADMIN_TOKEN_KEY, res.token);
      toast.success(`欢迎回来，${res.username}`);
      navigate("/admin/brands");
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-slate-50 to-accent/10 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-card border border-white/70 p-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent items-center justify-center text-white text-xl font-bold shadow-card">
              牌
            </span>
            <h1 className="text-2xl font-bold text-slate-900">品牌规范中心</h1>
            <p className="text-sm text-slate-500">全栈品牌令牌服务 · 管理控制台</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">用户名</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="admin"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="••••••"
                autoComplete="current-password"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bk-btn bk-btn-primary w-full disabled:opacity-70"
            >
              {loading ? "登录中…" : "登 录"}
            </button>
          </form>
          <p className="text-center text-xs text-slate-400">演示账号：admin / 123456</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
