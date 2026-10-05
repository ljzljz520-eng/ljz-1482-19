import axios from "axios";
import { toast } from "react-hot-toast";
import { storage } from "@/utils/storage";

export const ADMIN_TOKEN_KEY = "brandspec_admin_token";

const api = axios.create({
  // @ts-ignore
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = storage.get<string | null>(ADMIN_TOKEN_KEY, null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message ?? "网络请求失败，请稍后重试";
    if (status === 401) {
      storage.remove(ADMIN_TOKEN_KEY);
      if (window.location.pathname.startsWith("/admin") && window.location.pathname !== "/admin/login") {
        toast.error("登录已过期，请重新登录");
        window.location.href = "/admin/login";
      }
    } else {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
