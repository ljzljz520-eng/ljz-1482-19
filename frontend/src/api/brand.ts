import api from "./client";

/* ---------- 类型 ---------- */
export interface BrandVersionSummary {
  id: string;
  name: string;
  version: string;
  status: "draft" | "published" | "archived";
  revision: number;
  contentHash: string;
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface BrandVersionDetail extends BrandVersionSummary {
  tokens: Record<string, unknown>;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ContrastCheck {
  pair: string;
  ratio: number;
  min: number;
  pass: boolean;
}

export interface ValidateResponse {
  ok: boolean;
  issues: ValidationIssue[];
  contrast: ContrastCheck[];
}

export interface ProjectInfo {
  id: string;
  slug: string;
  name: string;
  bindMode: "follow" | "pin";
  pinnedVersionId: string | null;
  effectiveVersion: {
    id: string;
    version: string;
    contentHash: string;
    publishedAt: string | null;
  } | null;
}

export interface EffectiveResponse {
  project: { slug: string; name: string; bindMode: "follow" | "pin"; pinnedVersionId: string | null };
  version: { id: string; version: string; contentHash: string; publishedAt: string | null };
}

export interface SubtitleItem {
  id: string;
  content: string;
  status: "approved" | "needs_review";
  color: string;
  approvedVersionId: string;
  approvedVersion: string;
  approvedAt: string;
  approvedBy: string;
}

export interface ExportPreview {
  project: { slug: string; name: string };
  version: { id: string; version: string; contentHash: string; publishedAt: string | null };
  cssVariables: Record<string, string>;
  contrast: ContrastCheck[];
  subtitles: SubtitleItem[];
}

/* ---------- 认证 ---------- */
export const login = async (username: string, password: string) => {
  const { data } = await api.post<{ token: string; username: string }>("/auth/login", { username, password });
  return data;
};

/* ---------- 品牌版本 ---------- */
export const fetchBrandVersions = async () => {
  const { data } = await api.get<BrandVersionSummary[]>("/brands");
  return data;
};

export const fetchBrandVersion = async (id: string) => {
  const { data } = await api.get<BrandVersionDetail>(`/brands/${id}`);
  return data;
};

export const createDraft = async (version: string, baseVersionId?: string) => {
  const { data } = await api.post<BrandVersionDetail>("/brands", { version, baseVersionId });
  return data;
};

export const saveDraft = async (id: string, tokens: unknown, expectedRevision: number) => {
  const { data } = await api.put<BrandVersionDetail>(`/brands/${id}`, { tokens, expectedRevision });
  return data;
};

export const validateTokens = async (tokens: unknown) => {
  const { data } = await api.post<ValidateResponse>("/brands/validate", { tokens });
  return data;
};

export const publishVersion = async (id: string, expectedRevision: number) => {
  const { data } = await api.post<BrandVersionDetail>(`/brands/${id}/publish`, { expectedRevision });
  return data;
};

/* ---------- 项目 ---------- */
export const fetchProjects = async () => {
  const { data } = await api.get<ProjectInfo[]>("/projects");
  return data;
};

export const updateBinding = async (id: string, payload: { mode: "follow" } | { mode: "pin"; versionId: string }) => {
  const { data } = await api.put(`/projects/${id}/binding`, payload);
  return data;
};

export const fetchEffective = async (slug: string) => {
  const { data } = await api.get<EffectiveResponse>(`/projects/${slug}/effective`);
  return data;
};

export const fetchExportPreview = async (slug: string, versionId: string) => {
  const { data } = await api.get<ExportPreview>(`/projects/${slug}/export-preview`, { params: { versionId } });
  return data;
};

export const fetchSubtitles = async (slug: string) => {
  const { data } = await api.get<{ effectiveVersion: { id: string; version: string }; subtitles: SubtitleItem[] }>(
    `/projects/${slug}/subtitles`
  );
  return data;
};

export const reviewSubtitle = async (id: string) => {
  const { data } = await api.post(`/subtitles/${id}/review`);
  return data;
};
