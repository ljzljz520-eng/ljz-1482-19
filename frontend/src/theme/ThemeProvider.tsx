import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { fetchEffective } from "@/api/brand";
import { storage } from "@/utils/storage";

/**
 * 运行时主题注入：
 *  - 页面启动时请求项目“实际生效版本”（no-cache），以 <link> 注入受约束的运行时 CSS 变量；
 *  - index.css 中内置了 v1.0.0 的编译时默认变量作为兜底（设备缓存旧包/接口不可用时仍可渲染）；
 *  - 若本地记录的版本与服务器生效版本不一致，提示“品牌已更新”，覆盖“设备缓存旧包”场景。
 */

const PROJECT_SLUG = (import.meta.env.VITE_PROJECT_SLUG as string | undefined) || "yunxi-park";
const LAST_SEEN_KEY = "brandspec_last_seen_version";

export interface ThemeState {
  loaded: boolean;
  available: boolean;
  version: string;
  versionId: string;
  contentHash: string;
  bindMode: "follow" | "pin" | "";
  upgradedFrom: string | null;
}

const initialState: ThemeState = {
  loaded: false,
  available: false,
  version: "",
  versionId: "",
  contentHash: "",
  bindMode: "",
  upgradedFrom: null
};

const ThemeContext = createContext<ThemeState>(initialState);

export const useThemeVersion = () => useContext(ThemeContext);

function injectThemeLink(versionId: string) {
  const id = "brandspec-runtime-theme";
  const href = `/api/projects/${PROJECT_SLUG}/theme.css?v=${encodeURIComponent(versionId)}`;
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) {
    if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ThemeState>(initialState);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eff = await fetchEffective(PROJECT_SLUG);
        if (cancelled) return;
        injectThemeLink(eff.version.id);
        const lastSeen = storage.get<string | null>(LAST_SEEN_KEY, null);
        const upgradedFrom = lastSeen && lastSeen !== eff.version.version ? lastSeen : null;
        storage.set(LAST_SEEN_KEY, eff.version.version);
        setState({
          loaded: true,
          available: true,
          version: eff.version.version,
          versionId: eff.version.id,
          contentHash: eff.version.contentHash,
          bindMode: eff.project.bindMode,
          upgradedFrom
        });
      } catch {
        // 接口不可用：保留 index.css 内置的编译时默认变量，页面可正常渲染
        if (!cancelled) setState({ ...initialState, loaded: true, available: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ThemeContext.Provider value={state}>{children}</ThemeContext.Provider>;
};

export const projectSlug = PROJECT_SLUG;
