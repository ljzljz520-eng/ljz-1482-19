import { DragEvent, useRef, useState } from "react";
import clsx from "clsx";

const STEPS = ["选择素材", "品牌校验", "导出成片"];

const ASSET_STATES = [
  { key: "draft", label: "草稿", varName: "--brand-asset-state-draft" },
  { key: "reviewing", label: "审核中", varName: "--brand-asset-state-reviewing" },
  { key: "approved", label: "已批准", varName: "--brand-asset-state-approved" },
  { key: "published", label: "已 发布", varName: "--brand-asset-state-published" },
  { key: "error", label: "异常", varName: "--brand-asset-state-error" }
];

/** 拖拽排序验证：拖拽中 / 放置目标 的视觉状态 */
const DragSection = () => {
  const [items, setItems] = useState(["片头字幕", "主视频轨", "背景音乐", "导出角标"]);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const onDrop = (index: number) => {
    if (dragIndex.current === null) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    setItems(next);
    dragIndex.current = null;
    setOverIndex(null);
  };

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item}
          draggable
          onDragStart={(e: DragEvent) => {
            dragIndex.current = index;
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDragLeave={() => setOverIndex((i) => (i === index ? null : i))}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(index);
          }}
          onDragEnd={() => {
            dragIndex.current = null;
            setOverIndex(null);
          }}
          className={clsx(
            "flex cursor-grab items-center gap-3 rounded-xl border px-4 py-3 text-sm transition active:cursor-grabbing",
            overIndex === index
              ? "border-[var(--brand-steps-active-bg)] bg-[var(--brand-steps-active-bg)]/10 text-slate-900"
              : "border-slate-200 bg-white/80 text-slate-700 hover:border-[var(--brand-steps-active-bg)]/50"
          )}
        >
          <span className="text-slate-300 select-none">⠿</span>
          {item}
          {overIndex === index && <span className="ml-auto text-xs text-[var(--brand-steps-active-bg)]">释放以移动</span>}
        </li>
      ))}
    </ul>
  );
};

/** 播放器错误态验证 */
const PlayerSection = () => {
  const [errored, setErrored] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--brand-surface-inverse)]">
      {errored ? (
        <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-system-error-fg)]/15 text-[var(--brand-system-error-fg)] text-xl">
            ✕
          </span>
          <p className="text-sm font-medium text-[var(--brand-system-error-fg)]">视频加载失败</p>
          <p className="text-xs text-[var(--brand-text-inverse)]/60">源文件不可用或网络异常，请检查素材状态后重试</p>
          <button
            onClick={() => setErrored(false)}
            className="mt-1 rounded-lg border border-[var(--brand-system-error-fg)]/40 px-3 py-1 text-xs text-[var(--brand-system-error-fg)] transition hover:bg-[var(--brand-system-error-fg)]/10"
          >
            重新加载
          </button>
        </div>
      ) : (
        <video
          className="h-44 w-full object-cover"
          controls
          src="https://invalid.example.com/not-exist.mp4"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
};

const Section = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <section className="rounded-3xl bg-white/90 border border-white/70 shadow-card p-6">
    <h3 className="font-semibold text-slate-900">{title}</h3>
    <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const VerifyPage = () => {
  const [step] = useState(1);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100 px-5 py-4 text-sm text-indigo-800">
        本页所有组件均由当前生效的品牌令牌（CSS 变量）驱动，用于发布前的视觉验证：拖拽、播放器错误、禁用态、键盘焦点与暗色对比。
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="网页编辑按钮" desc="常态 / 悬停 / 禁用 —— 按 Tab 可验证键盘焦点环（系统保护，不可覆盖）">
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-[var(--brand-editor-button-radius)] bg-[var(--brand-editor-button-primary-bg)] px-5 py-2.5 text-sm font-medium text-[var(--brand-editor-button-primary-fg)] transition hover:bg-[var(--brand-editor-button-hover-bg)]">
              导出成片
            </button>
            <button
              disabled
              className="rounded-[var(--brand-editor-button-radius)] bg-[var(--brand-editor-button-disabled-bg)] px-5 py-2.5 text-sm font-medium text-[var(--brand-editor-button-disabled-fg)] cursor-not-allowed"
            >
              导出成片（禁用）
            </button>
            <button className="rounded-[var(--brand-editor-button-radius)] border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-[var(--brand-editor-button-primary-bg)]">
              次要操作
            </button>
          </div>
        </Section>

        <Section title="步骤条" desc="已完成 / 进行中 / 待处理">
          <ol className="flex items-center gap-0">
            {STEPS.map((label, index) => {
              const state = index < step ? "done" : index === step ? "active" : "pending";
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <span
                    className={clsx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      state === "done" && "bg-[var(--brand-steps-done-bg)] text-[var(--brand-steps-done-fg)]",
                      state === "active" && "bg-[var(--brand-steps-active-bg)] text-[var(--brand-steps-active-fg)]",
                      state === "pending" && "bg-[var(--brand-steps-pending-bg)] text-[var(--brand-steps-pending-fg)]"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="ml-2 text-xs text-slate-600 whitespace-nowrap">{label}</span>
                  {index < STEPS.length - 1 && <span className="mx-3 h-0.5 flex-1 rounded bg-[var(--brand-steps-connector)]" />}
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title="素材状态徽章" desc="五种状态标识色（异常态固定引用系统错误色）">
          <div className="flex flex-wrap gap-2">
            {ASSET_STATES.map((s) => (
              <span
                key={s.key}
                className="rounded-full px-3 py-1 text-xs font-medium text-[var(--brand-asset-state-fg)]"
                style={{ backgroundColor: `var(${s.varName})` }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </Section>

        <Section title="拖拽排序" desc="拖动条目验证拖拽中与放置目标的高亮状态">
          <DragSection />
        </Section>

        <Section title="播放器错误态" desc="视频加载失败时的错误语义展示（系统错误色，用户主题不可覆盖）">
          <PlayerSection />
        </Section>

        <Section title="暗色背景对比" desc="暗色场景下的文字、徽章与字幕 —— 发布校验会阻断对比不足的组合">
          <div className="rounded-2xl bg-[var(--brand-surface-inverse)] p-5">
            <p className="text-sm text-[var(--brand-text-inverse)]">暗色背景上的正文文字</p>
            <p className="mt-1 text-xs text-[var(--brand-text-inverse)]/60">辅助说明文字</p>
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <span
                className="rounded-[var(--brand-export-badge-radius)] border border-[var(--brand-export-badge-border)] bg-[var(--brand-export-badge-bg)] px-3 py-1 text-xs text-[var(--brand-export-badge-fg)]"
              >
                云溪出品 · 导出角标
              </span>
              <span className="rounded px-2 py-0.5 text-sm text-[var(--brand-export-subtitle-fg)] bg-[var(--brand-export-subtitle-bg)]">
                字幕样式样本
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default VerifyPage;
