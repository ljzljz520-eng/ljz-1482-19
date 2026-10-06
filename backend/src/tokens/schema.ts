/**
 * 品牌令牌规范（Schema）
 * 服务端只接受此处声明的令牌键 —— 任何未知键都会被拒绝，
 * 这是“服务端不接收任意脚本或不受限 CSS 作为主题配置”的第一道防线。
 */

export type TokenType = "color" | "dimension";
export type TokenGroup =
  | "surface"
  | "editorButton"
  | "steps"
  | "assetState"
  | "exportBadge"
  | "system";

export interface TokenDef {
  path: string;
  type: TokenType;
  group: TokenGroup;
  cssVar: string;
  label: string;
  description: string;
  /** 系统保护令牌：承载错误语义 / 键盘焦点可见性，受额外约束 */
  isSystem?: boolean;
}

const v = (name: string) => `--brand-${name}`;

export const GROUP_META: { key: TokenGroup; title: string; desc: string }[] = [
  { key: "surface", title: "基础色板", desc: "页面背景与正文层级，暗色背景用于播放器与暗色场景" },
  { key: "editorButton", title: "网页编辑按钮", desc: "编辑器主按钮的常态 / 悬停 / 禁用 / 焦点" },
  { key: "steps", title: "步骤", desc: "流程步骤条的已完成 / 进行中 / 待处理状态" },
  { key: "assetState", title: "素材状态", desc: "素材在草稿、审核、发布等状态下的标识色" },
  { key: "exportBadge", title: "导出标识", desc: "导出成片的角标与字幕样式" },
  { key: "system", title: "系统保护", desc: "错误语义与键盘焦点可见性，用户主题不得覆盖" }
];

export const TOKEN_DEFS: TokenDef[] = [
  // ---------- 基础色板 ----------
  { path: "surface.base", type: "color", group: "surface", cssVar: v("surface-base"), label: "基础背景", description: "页面基础背景色" },
  { path: "surface.raised", type: "color", group: "surface", cssVar: v("surface-raised"), label: "浮层背景", description: "卡片 / 弹层背景色" },
  { path: "surface.inverse", type: "color", group: "surface", cssVar: v("surface-inverse"), label: "暗色背景", description: "播放器、暗色场景的背景" },
  { path: "text.primary", type: "color", group: "surface", cssVar: v("text-primary"), label: "主要文字", description: "正文主文字颜色" },
  { path: "text.muted", type: "color", group: "surface", cssVar: v("text-muted"), label: "次要文字", description: "辅助说明文字颜色" },
  { path: "text.inverse", type: "color", group: "surface", cssVar: v("text-inverse"), label: "暗底文字", description: "暗色背景上的文字颜色" },
  { path: "brand.primary", type: "color", group: "surface", cssVar: v("brand-primary"), label: "品牌主色", description: "品牌识别主色" },
  { path: "brand.accent", type: "color", group: "surface", cssVar: v("brand-accent"), label: "品牌强调色", description: "品牌强调 / 点缀色" },

  // ---------- 网页编辑按钮 ----------
  { path: "editor.button.primary.bg", type: "color", group: "editorButton", cssVar: v("editor-button-primary-bg"), label: "主按钮背景", description: "编辑器主按钮常态背景" },
  { path: "editor.button.primary.fg", type: "color", group: "editorButton", cssVar: v("editor-button-primary-fg"), label: "主按钮文字", description: "编辑器主按钮文字颜色" },
  { path: "editor.button.hover.bg", type: "color", group: "editorButton", cssVar: v("editor-button-hover-bg"), label: "主按钮悬停背景", description: "鼠标悬停时的按钮背景" },
  { path: "editor.button.disabled.bg", type: "color", group: "editorButton", cssVar: v("editor-button-disabled-bg"), label: "禁用按钮背景", description: "禁用态按钮背景" },
  { path: "editor.button.disabled.fg", type: "color", group: "editorButton", cssVar: v("editor-button-disabled-fg"), label: "禁用按钮文字", description: "禁用态按钮文字" },
  { path: "editor.button.radius", type: "dimension", group: "editorButton", cssVar: v("editor-button-radius"), label: "按钮圆角", description: "按钮圆角尺寸" },

  // ---------- 步骤 ----------
  { path: "steps.active.bg", type: "color", group: "steps", cssVar: v("steps-active-bg"), label: "进行中步骤背景", description: "当前步骤节点背景" },
  { path: "steps.active.fg", type: "color", group: "steps", cssVar: v("steps-active-fg"), label: "进行中步骤文字", description: "当前步骤节点文字" },
  { path: "steps.done.bg", type: "color", group: "steps", cssVar: v("steps-done-bg"), label: "已完成步骤背景", description: "已完成步骤节点背景" },
  { path: "steps.done.fg", type: "color", group: "steps", cssVar: v("steps-done-fg"), label: "已完成步骤文字", description: "已完成步骤节点文字" },
  { path: "steps.pending.bg", type: "color", group: "steps", cssVar: v("steps-pending-bg"), label: "待处理步骤背景", description: "未到达步骤节点背景" },
  { path: "steps.pending.fg", type: "color", group: "steps", cssVar: v("steps-pending-fg"), label: "待处理步骤文字", description: "未到达步骤节点文字" },
  { path: "steps.connector", type: "color", group: "steps", cssVar: v("steps-connector"), label: "步骤连接线", description: "步骤节点之间的连接线颜色" },

  // ---------- 素材状态 ----------
  { path: "asset.state.draft", type: "color", group: "assetState", cssVar: v("asset-state-draft"), label: "草稿状态", description: "素材草稿状态标识色" },
  { path: "asset.state.reviewing", type: "color", group: "assetState", cssVar: v("asset-state-reviewing"), label: "审核中状态", description: "素材审核中状态标识色" },
  { path: "asset.state.approved", type: "color", group: "assetState", cssVar: v("asset-state-approved"), label: "已批准状态", description: "素材已批准状态标识色" },
  { path: "asset.state.published", type: "color", group: "assetState", cssVar: v("asset-state-published"), label: "已发布状态", description: "素材已发布状态标识色" },
  { path: "asset.state.error", type: "color", group: "assetState", cssVar: v("asset-state-error"), label: "异常状态", description: "素材异常状态标识色（固定引用系统错误色）" },
  { path: "asset.state.fg", type: "color", group: "assetState", cssVar: v("asset-state-fg"), label: "状态徽章文字", description: "状态徽章上的文字颜色" },

  // ---------- 导出标识 ----------
  { path: "export.badge.bg", type: "color", group: "exportBadge", cssVar: v("export-badge-bg"), label: "导出角标背景", description: "导出成片角标背景" },
  { path: "export.badge.fg", type: "color", group: "exportBadge", cssVar: v("export-badge-fg"), label: "导出角标文字", description: "导出成片角标文字" },
  { path: "export.badge.border", type: "color", group: "exportBadge", cssVar: v("export-badge-border"), label: "导出角标描边", description: "导出成片角标描边" },
  { path: "export.badge.radius", type: "dimension", group: "exportBadge", cssVar: v("export-badge-radius"), label: "角标圆角", description: "导出角标圆角尺寸" },
  { path: "export.subtitle.fg", type: "color", group: "exportBadge", cssVar: v("export-subtitle-fg"), label: "字幕文字", description: "导出成片字幕文字颜色" },
  { path: "export.subtitle.bg", type: "color", group: "exportBadge", cssVar: v("export-subtitle-bg"), label: "字幕底色", description: "导出成片字幕底色" },

  // ---------- 系统保护 ----------
  { path: "system.error.fg", type: "color", group: "system", cssVar: v("system-error-fg"), label: "错误文字", description: "系统错误语义色，必须保持红色色相", isSystem: true },
  { path: "system.error.bg", type: "color", group: "system", cssVar: v("system-error-bg"), label: "错误背景", description: "错误提示背景色", isSystem: true },
  { path: "system.success", type: "color", group: "system", cssVar: v("system-success"), label: "成功语义", description: "系统成功语义色", isSystem: true },
  { path: "system.focus.ring.color", type: "color", group: "system", cssVar: v("system-focus-ring-color"), label: "焦点环颜色", description: "键盘焦点环颜色，必须在明暗背景上都可见", isSystem: true },
  { path: "system.focus.ring.width", type: "dimension", group: "system", cssVar: v("system-focus-ring-width"), label: "焦点环宽度", description: "键盘焦点环宽度，不得小于 2px", isSystem: true }
];

export const DEF_BY_PATH = new Map(TOKEN_DEFS.map((d) => [d.path, d]));

/** 对比度规则：fg 在 bg 上的 WCAG 对比度不得低于 min */
export interface ContrastRule {
  fg: string;
  bg: string;
  min: number;
  level: "error" | "warning";
  label: string;
}

export const CONTRAST_RULES: ContrastRule[] = [
  { fg: "text.primary", bg: "surface.base", min: 4.5, level: "error", label: "正文可读性" },
  { fg: "text.muted", bg: "surface.base", min: 4.5, level: "error", label: "次要文字可读性" },
  { fg: "text.inverse", bg: "surface.inverse", min: 4.5, level: "error", label: "暗色背景文字可读性" },
  { fg: "editor.button.primary.fg", bg: "editor.button.primary.bg", min: 4.5, level: "error", label: "主按钮文字" },
  { fg: "editor.button.disabled.fg", bg: "editor.button.disabled.bg", min: 2.8, level: "warning", label: "禁用按钮可辨识" },
  { fg: "steps.active.fg", bg: "steps.active.bg", min: 4.5, level: "error", label: "进行中步骤" },
  { fg: "steps.done.fg", bg: "steps.done.bg", min: 4.5, level: "error", label: "已完成步骤" },
  { fg: "steps.pending.fg", bg: "steps.pending.bg", min: 4.5, level: "error", label: "待处理步骤" },
  { fg: "asset.state.fg", bg: "asset.state.draft", min: 4.5, level: "error", label: "草稿状态徽章" },
  { fg: "asset.state.fg", bg: "asset.state.reviewing", min: 4.5, level: "error", label: "审核中状态徽章" },
  { fg: "asset.state.fg", bg: "asset.state.approved", min: 4.5, level: "error", label: "已批准状态徽章" },
  { fg: "asset.state.fg", bg: "asset.state.published", min: 4.5, level: "error", label: "已发布状态徽章" },
  { fg: "asset.state.fg", bg: "asset.state.error", min: 4.5, level: "error", label: "异常状态徽章" },
  { fg: "export.badge.fg", bg: "export.badge.bg", min: 4.5, level: "error", label: "导出角标（暗色背景）" },
  { fg: "export.badge.border", bg: "export.badge.bg", min: 3, level: "error", label: "导出角标描边（暗色背景）" },
  { fg: "export.subtitle.fg", bg: "surface.inverse", min: 4.5, level: "error", label: "暗色画面上的字幕" },
  { fg: "system.error.fg", bg: "system.error.bg", min: 4.5, level: "error", label: "错误提示可读性" },
  { fg: "system.error.fg", bg: "surface.inverse", min: 3, level: "error", label: "暗色背景上的错误标识" },
  { fg: "system.focus.ring.color", bg: "surface.base", min: 3, level: "error", label: "浅色背景焦点环可见性" },
  { fg: "system.focus.ring.color", bg: "surface.inverse", min: 3, level: "error", label: "暗色背景焦点环可见性" }
];

/** 默认令牌（种子数据 / 新草稿基底） */
export const DEFAULT_TOKENS: Record<string, string> = {
  "surface.base": "#F8FAFC",
  "surface.raised": "#FFFFFF",
  "surface.inverse": "#0F172A",
  "text.primary": "#0F172A",
  "text.muted": "#475569",
  "text.inverse": "#F8FAFC",
  "brand.primary": "#165DFF",
  "brand.accent": "#FF7D00",

  "editor.button.primary.bg": "{brand.primary}",
  "editor.button.primary.fg": "#FFFFFF",
  "editor.button.hover.bg": "#0E42C8",
  "editor.button.disabled.bg": "#E2E8F0",
  "editor.button.disabled.fg": "#64748B",
  "editor.button.radius": "12px",

  "steps.active.bg": "{brand.primary}",
  "steps.active.fg": "#FFFFFF",
  "steps.done.bg": "#DCFCE7",
  "steps.done.fg": "#15803D",
  "steps.pending.bg": "#F1F5F9",
  "steps.pending.fg": "#475569",
  "steps.connector": "#CBD5E1",

  "asset.state.draft": "#475569",
  "asset.state.reviewing": "#B45309",
  "asset.state.approved": "#15803D",
  "asset.state.published": "{brand.primary}",
  "asset.state.error": "{system.error.fg}",
  "asset.state.fg": "#FFFFFF",

  "export.badge.bg": "{surface.inverse}",
  "export.badge.fg": "{text.inverse}",
  "export.badge.border": "{brand.accent}",
  "export.badge.radius": "999px",
  "export.subtitle.fg": "#FFFFFF",
  "export.subtitle.bg": "rgba(15, 23, 42, 0.72)",

  "system.error.fg": "#CF222E",
  "system.error.bg": "#FEF2F2",
  "system.success": "#15803D",
  "system.focus.ring.color": "#2563EB",
  "system.focus.ring.width": "2px"
};
