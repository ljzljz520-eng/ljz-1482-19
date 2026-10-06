import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { toast } from "react-hot-toast";
import api from "@/api/client";
import { EffectiveTheme } from "@/api/brand";

const PROJECT_SLUG = "official-site";
const POLL_INTERVAL = 15000;

interface ThemeState {
  /** 实际生效（已应用到页面 <link>）的版本 */
  applied: EffectiveTheme | null;
  /** 服务端返回的最新生效版本 */
  latest: EffectiveTheme | null;
  /** latest 与 applied 不一致：当前设备仍在使用旧包 */
  stale: boolean;
  applyLatest: () => void;
}

const ThemeContext = createContext<ThemeState>({ applied: null, latest: null, stale: false, applyLatest: () => undefined });

export const useBrandTheme = () => useContext(ThemeContext);

function mountThemeLink(info: EffectiveTheme): void {
  let link = document.getElementById("brand-theme") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "brand-theme";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = info.cssUrl;
  link.dataset.version = String(info.version.versionNumber);
  link.dataset.hash = info.version.cssHash;
}

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [applied, setApplied] = useState<EffectiveTheme | null>(null);
  const [latest, setLatest] = useState<EffectiveTheme | null>(null);
  const notifiedRef = useRef<string | null>(null);

  const fetchEffective = useCallback(async (): Promise<EffectiveTheme | null> => {
    try {
      const { data } = await api.get<EffectiveTheme>(`/projects/${PROJECT_SLUG}/effective-theme`, {
        // @ts-ignore 轮询请求静默失败
        silent: true
      } as never);
      setLatest(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const applyTheme = useCallback((info: EffectiveTheme) => {
    mountThemeLink(info);
    setApplied(info);
  }, []);

  // 首次加载：应用当前生效版本
  useEffect(() => {
    (async () => {
      const data = await fetchEffective();
      if (data) applyTheme(data);
    })();
  }, [fetchEffective, applyTheme]);

  // 轮询：检测设备是否缓存了旧包
  useEffect(() => {
    const timer = setInterval(async () => {
      const data = await fetchEffective();
      if (!data) return;
      setApplied((current) => {
        if (current && current.version.cssHash !== data.version.cssHash) {
          if (notifiedRef.current !== data.version.cssHash) {
            notifiedRef.current = data.version.cssHash;
            toast(`品牌规范已发布 v${data.version.versionNumber}，当前页面仍生效 v${current.version.versionNumber}`, {
              icon: "🎨",
              duration: 6000
            });
          }
        }
        return current;
      });
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchEffective]);

  const applyLatest = useCallback(() => {
    if (latest) {
      applyTheme(latest);
      toast.success(`已切换到品牌规范 v${latest.version.versionNumber}`);
    }
  }, [latest, applyTheme]);

  const stale = !!(latest && applied && latest.version.cssHash !== applied.version.cssHash);

  return (
    <ThemeContext.Provider value={{ applied, latest, stale, applyLatest }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
