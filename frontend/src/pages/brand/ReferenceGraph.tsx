import { useMemo } from "react";
import { ReferenceGraph as GraphData } from "@/api/brand";

const GROUP_ORDER = ["surface", "editorButton", "steps", "assetState", "exportBadge", "system"];
const GROUP_TITLES: Record<string, string> = {
  surface: "基础色板",
  editorButton: "编辑按钮",
  steps: "步骤",
  assetState: "素材状态",
  exportBadge: "导出标识",
  system: "系统保护"
};

const COL_W = 150;
const ROW_H = 26;
const TOP = 34;

/** 令牌引用图：按组分列布局，别名以有向边展示，循环边标红 */
const ReferenceGraph = ({ graph }: { graph: GraphData }) => {
  const { positions, edges, height } = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; label: string; isSystem: boolean }>();
    GROUP_ORDER.forEach((group, gi) => {
      const nodes = graph.nodes.filter((n) => n.group === group);
      nodes.forEach((node, ni) => {
        positions.set(node.path, {
          x: gi * COL_W + COL_W / 2,
          y: TOP + ni * ROW_H,
          label: node.path.split(".").pop() ?? node.path,
          isSystem: node.isSystem
        });
      });
    });
    const maxRows = Math.max(...GROUP_ORDER.map((g) => graph.nodes.filter((n) => n.group === g).length), 1);
    const cycleTokens = new Set(
      graph.issues.filter((i) => i.code === "ALIAS_CYCLE").map((i) => i.token)
    );
    const edges = graph.edges.map((e) => ({
      ...e,
      cycle: cycleTokens.has(e.from) || cycleTokens.has(e.to)
    }));
    return { positions, edges, height: TOP + maxRows * ROW_H + 12 };
  }, [graph]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-3">
      <svg width={GROUP_ORDER.length * COL_W} height={height} className="min-w-full">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="#6366F1" />
          </marker>
          <marker id="arrow-cycle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="#DC2626" />
          </marker>
        </defs>
        {GROUP_ORDER.map((group, gi) => (
          <text key={group} x={gi * COL_W + COL_W / 2} y={18} textAnchor="middle" fontSize="12" fill="#475569" fontWeight={600}>
            {GROUP_TITLES[group]}
          </text>
        ))}
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const color = edge.cycle ? "#DC2626" : "#6366F1";
          const mx = (from.x + to.x) / 2;
          return (
            <path
              key={`${edge.from}->${edge.to}`}
              d={`M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke={color}
              strokeWidth={edge.cycle ? 2 : 1.2}
              strokeDasharray={edge.cycle ? "5 3" : undefined}
              markerEnd={`url(#${edge.cycle ? "arrow-cycle" : "arrow"})`}
              opacity={0.85}
            >
              <title>{`${edge.from} → ${edge.to}${edge.cycle ? "（循环引用）" : ""}`}</title>
            </path>
          );
        })}
        {Array.from(positions.entries()).map(([path, pos]) => (
          <g key={path}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={5}
              fill={pos.isSystem ? "#0F172A" : "#fff"}
              stroke={pos.isSystem ? "#0F172A" : "#6366F1"}
              strokeWidth={1.5}
            >
              <title>{path}</title>
            </circle>
            <text x={pos.x + 9} y={pos.y + 4} fontSize="10" fill="#64748B">
              {pos.label}
            </text>
          </g>
        ))}
      </svg>
      {graph.edges.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-400">当前版本没有别名引用</p>
      )}
    </div>
  );
};

export default ReferenceGraph;
