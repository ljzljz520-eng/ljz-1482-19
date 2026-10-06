import api from "./client";

export interface TokenDef {
  path: string;
  type: "color" | "dimension";
  group: string;
  cssVar: string;
  label: string;
  description: string;
  isSystem?: boolean;
}

export interface GroupMeta {
  key: string;
  title: string;
  desc: string;
}

export interface TokenIssue {
  level: "error" | "warning";
  code: string;
  token?: string;
  message: string;
}

export interface BrandVersion {
  id: string;
  brandId: string;
  versionNumber: number | null;
  status: "draft" | "published" | "archived";
  tokens: Record<string, string>;
  note: string | null;
  tokenHash: string | null;
  cssHash: string | null;
  lockVersion: number;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
  issues?: TokenIssue[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  latestPublished?: BrandVersion | null;
}

export interface BrandDetail extends Brand {
  versions: BrandVersion[];
  draft: BrandVersion | null;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  bindingMode: "follow" | "pin";
  pinnedVersionId: string | null;
  effectiveVersion: { id: string; versionNumber: number; cssHash: string; tokenHash: string } | null;
  pendingAssets: number;
}

export interface Asset {
  id: string;
  projectId: string;
  name: string;
  kind: string;
  watchedTokens: string[];
  tokenSnapshot: Record<string, string>;
  approvedVersionId: string | null;
  reviewStatus: "approved" | "needs_re_review";
  updatedAt: string;
}

export interface EffectiveTheme {
  project: { id: string; slug: string; name: string; bindingMode: "follow" | "pin"; pinnedVersionId: string | null };
  version: { id: string; versionNumber: number; tokenHash: string; cssHash: string; publishedAt: string };
  cssUrl: string;
  runtimeCssUrl: string;
}

export interface SchemaResponse {
  groups: GroupMeta[];
  defs: TokenDef[];
  contrastRules: { fg: string; bg: string; min: number; level: string; label: string }[];
}

export interface ReferenceGraph {
  nodes: { path: string; group: string; type: string; label: string; isSystem: boolean }[];
  edges: { from: string; to: string }[];
  issues: TokenIssue[];
}

export interface ExportPreview {
  versionId: string;
  versionNumber: number | null;
  tokenHash: string;
  css: string;
  inline: {
    exportBadge: Record<string, string>;
    subtitle: Record<string, string>;
    primaryButton: Record<string, string>;
  };
}

export const brandApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string }>("/auth/login", { username, password }).then((r) => r.data),
  schema: () => api.get<SchemaResponse>("/schema").then((r) => r.data),
  brands: () => api.get<Brand[]>("/brands").then((r) => r.data),
  brandDetail: (id: string) => api.get<BrandDetail>(`/brands/${id}`).then((r) => r.data),
  createDraft: (brandId: string, baseVersionId?: string) =>
    api.post<BrandVersion>(`/brands/${brandId}/drafts`, { baseVersionId }).then((r) => r.data),
  saveDraft: (id: string, tokens: Record<string, string>, note: string | null, lockVersion: number) =>
    api.put<BrandVersion>(`/versions/${id}`, { tokens, note, lockVersion }).then((r) => r.data),
  validate: (id: string, tokens: Record<string, string>) =>
    api.post<{ issues: TokenIssue[]; hasErrors: boolean }>(`/versions/${id}/validate`, { tokens }).then((r) => r.data),
  publish: (id: string, lockVersion: number) =>
    api.post<BrandVersion>(`/versions/${id}/publish`, { lockVersion }).then((r) => r.data),
  referenceGraph: (id: string) => api.get<ReferenceGraph>(`/versions/${id}/reference-graph`).then((r) => r.data),
  exportPreview: (id: string) => api.get<ExportPreview>(`/versions/${id}/export-preview`).then((r) => r.data),
  projects: () => api.get<Project[]>("/projects").then((r) => r.data),
  setBinding: (id: string, mode: "follow" | "pin", pinnedVersionId: string | null) =>
    api.put<Project>(`/projects/${id}/binding`, { mode, pinnedVersionId }).then((r) => r.data),
  effectiveTheme: (slug: string) => api.get<EffectiveTheme>(`/projects/${slug}/effective-theme`).then((r) => r.data),
  projectAssets: (id: string) => api.get<Asset[]>(`/projects/${id}/assets`).then((r) => r.data),
  reapproveAsset: (id: string) => api.post<Asset>(`/assets/${id}/reapprove`).then((r) => r.data),
  audit: () =>
    api
      .get<{ id: string; actor: string; result: string; detail: string | null; createdAt: string }[]>("/audit")
      .then((r) => r.data)
};
