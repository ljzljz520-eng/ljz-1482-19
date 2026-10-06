import axios from "axios";
import { toast } from "react-hot-toast";

export const TOKEN_KEY = "brand_spec_token";

const api = axios.create({
  // @ts-ignore
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 轮询等场景可标记 silent，避免错误提示刷屏
    const silent = (error?.config as { silent?: boolean } | undefined)?.silent;
    const status: number | undefined = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("brand-auth-expired"));
    }
    if (!silent) {
      const message = error?.response?.data?.message ?? "网络请求失败，请稍后重试";
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
