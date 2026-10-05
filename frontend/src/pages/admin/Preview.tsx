import { DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { ExportPreview, fetchExportPreview } from "@/api/brand";
import { projectSlug, useThemeVersion } from "@/theme/ThemeProvider";
import clsx from "clsx";

/** 视觉验证页：按钮/步骤/素材状态/拖拽/播放器错误/禁用态/导出预览，全部消费品牌令牌 */
const Preview = () => {
  const theme = useThemeVersion();
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!theme.versionId) return;
    fetchExportPreview(projectSlug, theme.versionId)
      .then((data) => {
        setPreview(data);
        setPreviewError(null);
      })
      .catch((err) => {
        setPreviewError(err?.response?.data?.message ?? "导出预览加载失败");
      });
  }, [theme.versionId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">视觉验证</h1>
        <p className="text-sm text-slate-500 mt-1">
          当前生效品牌 <b>v{theme.version || "…"}</b> 的组件级验收：状态、拖拽、播放器错误、禁用态、焦点与导出一致性。
        </p>
      </header>

      <div className="grid xl:grid-cols-2 gap-5">
        <ButtonsSection />
        <StepsSection />
        <AssetsSection />
        <PlayerErrorSection />
        <FocusSection />
        <ExportSection preview={preview} error={previewError} themeVersion={theme.version} />
      </div>
    </div>
  );
};

const Card = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
    <div>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
    {children}
  </section>
);

/* ---------- 按钮：正常/悬停/激活/禁用 ---------- */
const ButtonsSection = () => (
  <Card title="按钮令牌" desc="悬停与按下查看状态色；禁用态使用 disabledBg/disabledText 令牌">
    <div className="space-y-3">
      {(["primary", "secondary", "danger"] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <span className="w-20 text-xs text-slate-400 font-mono">{variant}</span>
          <button className={clsx("bk-btn", `bk-btn-${variant}`)}>正常</button>
          <button className={clsx("bk-btn", `bk-btn-${variant}`)} disabled>
            禁用态
          </button>
        </div>
      ))}
    </div>
  </Card>
);

/* ---------- 步骤条 ---------- */
const StepsSection = () => {
  const steps = [
    { label: "素材上传", state: "completed" },
    { label: "品牌校验", state: "completed" },
    { label: "导出渲染", state: "active" },
    { label: "发布归档", state: "pending" }
  ] as const;
  return (
    <Card title="步骤条令牌" desc="active / completed / pending 三态圆点、连线与文案色">
      <ol className="flex items-center">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="h-4 w-4 rounded-full border-2 border-white shadow"
                style={{ background: `var(--brand-steps-${s.state}-dot)` }}
              />
              <span className="text-xs font-medium whitespace-nowrap" style={{ color: `var(--brand-steps-${s.state}-label)` }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-2 -mt-5 rounded"
                style={{
                  background:
                    s.state === "completed"
                      ? "var(--brand-steps-completed-line)"
                      : s.state === "active"
                        ? "var(--brand-steps-active-line)"
                        : "var(--brand-steps-pending-line)"
                }}
              />
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
};

/* ---------- 素材状态 + 拖拽 ---------- */
const ASSET_STATES = ["ready", "processing", "error", "selected"] as const;
const stateLabel: Record<string, string> = { ready: "就绪", processing: "处理中", error: "错误", selected: "选中" };

const AssetsSection = () => {
  const [dropped, setDropped] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const name = e.dataTransfer.getData("text/plain");
    if (name && !dropped.includes(name)) {
      setDropped((d) => [...d, name]);
      toast.success(`素材「${name}」已放入导出队列`);
    }
  };

  return (
    <Card title="素材状态 + 拖拽" desc="拖动素材卡片到放置区；拖拽高亮使用 selected 令牌">
      <div className="flex flex-wrap gap-2.5">
        {ASSET_STATES.map((s) => (
          <span
            key={s}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", `${stateLabel[s]}素材`)}
            className={clsx("bk-asset-chip cursor-grab active:cursor-grabbing", `bk-asset-${s}`)}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-70" />
            {stateLabel[s]}素材
          </span>
        ))}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={clsx(
          "rounded-2xl border-2 border-dashed p-5 min-h-[84px] transition text-sm",
          dragOver ? "bk-asset-selected" : "border-slate-200 text-slate-400 bg-slate-50/50"
        )}
      >
        {dropped.length === 0 ? (
          <p className="text-center">将素材拖放到此处（dragover 高亮 = asset.selected 令牌）</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dropped.map((d) => (
              <span key={d} className="bk-asset-chip bk-asset-ready">{d}</span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

/* ---------- 播放器错误态 ---------- */
const PlayerErrorSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onError = () => setFailed(true);
    v.addEventListener("error", onError);
    return () => v.removeEventListener("error", onError);
  }, []);

  return (
    <Card title="播放器错误态" desc="错误覆盖层使用 system.error 平台保留令牌，用户主题不可覆盖">
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" controls preload="none" src="/media/not-exist.mp4" />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--brand-system-error-bg)", color: "var(--brand-system-error-text)" }}
            >
              ⚠ 视频加载失败
            </span>
            <p className="text-xs" style={{ color: "var(--brand-system-error-subtle)" }}>
              错误语义由平台 system.* 令牌保证，任何主题不可改写
            </p>
            <button className="bk-btn bk-btn-secondary text-xs" onClick={() => setFailed(false)}>
              重试
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

/* ---------- 键盘焦点 ---------- */
const FocusSection = () => (
  <Card title="键盘焦点可见性" desc="按 Tab 键遍历下方控件：焦点环必须在浅色与深色背景上都清晰可见">
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-white border border-slate-200 p-4 flex justify-center">
        <button className="bk-btn bk-btn-primary bk-focus-demo text-sm">浅色背景</button>
      </div>
      <div className="rounded-xl p-4 flex justify-center" style={{ background: "var(--brand-color-surface-dark)" }}>
        <button className="bk-btn bk-btn-secondary bk-focus-demo text-sm">深色背景</button>
      </div>
    </div>
    <p className="text-xs text-slate-400">
      服务端强制：焦点环与浅/深背景对比度 ≥ 3:1 且宽度 ≥ 2px，否则版本无法发布。
    </p>
  </Card>
);

/* ---------- 导出预览（同版本保障） ---------- */
const ExportSection = ({
  preview,
  error,
  themeVersion
}: {
  preview: ExportPreview | null;
  error: string | null;
  themeVersion: string;
}) => (
  <Card title="导出预览 · 同版本保障" desc="导出样式与网页资源强制来自同一品牌版本；字幕色使用审批快照">
    {error && <p className="text-sm text-red-600">{error}</p>}
    {!preview && !error && <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />}
    {preview && (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bk-badge-export">导出标识 · v{preview.version.version}</span>
          <span
            className={clsx(
              "inline-flex px-2.5 py-1 rounded-full border font-semibold",
              preview.version.version === themeVersion
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            )}
          >
            {preview.version.version === themeVersion
              ? `✓ 与网页版本一致（hash ${preview.version.contentHash.slice(0, 8)}）`
              : "✗ 版本不一致"}
          </span>
        </div>
        {/* 成片字幕：颜色 = 审批快照，未复核不随品牌升级变化 */}
        <div className="rounded-xl overflow-hidden">
          <div className="bk-subtitle-bar px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
            <span>播放器字幕层预览</span>
            <span className="opacity-60">背景 = export.subtitle.bg</span>
          </div>
          <div className="bg-slate-950 px-4 py-3 space-y-2">
            {preview.subtitles.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium" style={{ color: s.color }}>
                  {s.content}
                </p>
                <span
                  className={clsx(
                    "text-[10px] px-2 py-0.5 rounded-full border shrink-0",
                    s.status === "approved"
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-amber-500/40 text-amber-400"
                  )}
                >
                  {s.status === "approved" ? `已批准 v${s.approvedVersion}` : `待复核 · 冻结于 v${s.approvedVersion}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        {preview.contrast.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">对比度实测</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {preview.contrast.slice(0, 8).map((c) => (
                <p key={c.pair} className="text-[11px] flex justify-between gap-2">
                  <span className="text-slate-500 truncate">{c.pair}</span>
                  <span className={clsx("font-mono font-semibold", c.pass ? "text-emerald-600" : "text-red-600")}>
                    {c.ratio.toFixed(2)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </Card>
);

export default Preview;
