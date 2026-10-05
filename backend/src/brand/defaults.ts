/**
 * 平台保留令牌（system.*）与默认品牌令牌（种子 v1.0.0）。
 * system.* 由平台注入解析上下文，用户主题不可定义、不可覆盖 —— 保证系统错误语义稳定。
 */
import { LeafEntry } from "./tokens";

export const SYSTEM_TOKENS = {
  system: {
    error: {
      bg: "#DC2626",
      text: "#FFFFFF",
      subtle: "#FEE2E2",
      onSubtle: "#7F1D1D"
    }
  }
} as const;

export const SYSTEM_LEAVES: LeafEntry[] = [
  { path: "system.error.bg", key: "bg", type: "color", value: SYSTEM_TOKENS.system.error.bg },
  { path: "system.error.text", key: "text", type: "color", value: SYSTEM_TOKENS.system.error.text },
  { path: "system.error.subtle", key: "subtle", type: "color", value: "#FEE2E2" },
  { path: "system.error.onSubtle", key: "onSubtle", type: "color", value: "#7F1D1D" }
];

/** 默认品牌令牌 v1.0.0（与站点既有 Tailwind 主题 #165DFF/#FF7D00 对齐） */
export const DEFAULT_TOKENS = {
  color: {
    primary: "#165DFF",
    primaryStrong: "#0E42D2",
    accent: "#FF7D00",
    surface: "#FFFFFF",
    surfaceSoft: "#F1F5FF",
    surfaceDark: "#0B1220",
    text: "#0F172A",
    textSecondary: "#475569",
    textOnDark: "#F8FAFC"
  },
  button: {
    primary: {
      bg: { alias: "color.primary" },
      text: "#FFFFFF",
      border: { alias: "color.primary" },
      hoverBg: "#0E42D2",
      activeBg: "#0A36A8",
      disabledBg: "#E2E8F0",
      disabledText: "#475569",
      radius: "12px"
    },
    secondary: {
      bg: "#FFFFFF",
      text: { alias: "color.primary" },
      border: { alias: "color.primary" },
      hoverBg: "#E8EFFF",
      activeBg: "#D1DFFF",
      disabledBg: "#E2E8F0",
      disabledText: "#475569",
      radius: "12px"
    },
    danger: {
      bg: { alias: "system.error.bg" },
      text: { alias: "system.error.text" },
      border: { alias: "system.error.bg" },
      hoverBg: "#B91C1C",
      activeBg: "#991B1B",
      disabledBg: "#E2E8F0",
      disabledText: "#475569",
      radius: "12px"
    }
  },
  steps: {
    active: { dot: { alias: "color.primary" }, line: { alias: "color.primary" }, label: "#0F172A" },
    completed: { dot: "#16A34A", line: "#16A34A", label: "#166534" },
    pending: { dot: "#CBD5E1", line: "#E2E8F0", label: "#64748B" }
  },
  asset: {
    ready: { bg: "#DCFCE7", text: "#166534", border: "#16A34A" },
    processing: { bg: "#FEF3C7", text: "#92400E", border: "#D97706" },
    error: {
      bg: { alias: "system.error.subtle" },
      text: { alias: "system.error.onSubtle" },
      border: { alias: "system.error.bg" }
    },
    selected: { bg: "#E0E9FF", text: "#0E42D2", border: { alias: "color.primary" } }
  },
  export: {
    badge: {
      bg: { alias: "color.primary" },
      text: "#FFFFFF",
      border: { alias: "color.primaryStrong" },
      radius: "999px"
    },
    subtitle: { color: "#FFE08A", bg: "#0B1220" }
  },
  focus: { ringColor: "#C2410C", ringWidth: "3px" }
};

export const BRAND_NAME = "云溪品牌规范";
export const DEFAULT_VERSION = "1.0.0";
