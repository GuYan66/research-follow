import clsx from "clsx";

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function cn(...inputs: Parameters<typeof clsx>) {
  return clsx(inputs);
}

// 数据源展示名与配色
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  arxiv: { label: "arXiv", cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" },
  openalex: { label: "OpenAlex", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  s2: { label: "S2", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" },
  blog: { label: "官方博客", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
};

export function sourceLabel(s: string): string {
  return SOURCE_META[s]?.label ?? s;
}

export function sourceClass(s: string): string {
  return SOURCE_META[s]?.cls ?? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300";
}

// 团队配色：按 group id 哈希到固定调色板，保证稳定
interface Palette {
  dot: string;
  badge: string;
}
const PALETTE: Palette[] = [
  { dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" },
  { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
  { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  { dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { dot: "bg-teal-500", badge: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" },
];

export function groupPalette(id: string): Palette {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// 组的地域 / 属性展示
export function regionLabel(region: string): string {
  return region === "cn" ? "国内" : "国际";
}

export function groupKindLabel(kind: string): string {
  return kind === "industry" ? "工业界" : "学术界";
}

export function groupKindClass(kind: string): string {
  return kind === "industry"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    : "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300";
}

// 工作类型展示
export function workKindLabel(kind: string): string {
  if (kind === "blog") return "博客";
  if (kind === "model") return "模型";
  if (kind === "release") return "发布";
  return "论文";
}

const TAG_CN: Record<string, string> = {
  llm: "大模型",
  agents: "智能体",
  multimodal: "多模态",
  rl: "强化学习",
  science: "科学计算",
  robotics: "机器人",
  systems: "系统",
  ml: "机器学习",
  applied: "应用",
  alignment: "对齐",
  interpretability: "可解释性",
  "self-supervised": "自监督",
  vision: "视觉",
  embodied: "具身智能",
  vla: "视觉语言动作",
  "foundation-models": "基础模型",
  reasoning: "推理",
  moe: "混合专家",
  "long-context": "长上下文",
  "open-weights": "开源权重",
  "efficient-attention": "高效注意力",
  "autonomous-driving": "自动驾驶",
  "3d-vision": "三维视觉",
  manipulation: "操作",
  efficiency: "效率",
};

export function tagLabel(tag: string): string {
  return TAG_CN[tag] || tag;
}

export function groupDisplayName(group: { name: string; name_cn?: string }): string {
  return (group.name_cn || "").trim() || group.name;
}

/** 卡片和详情优先展示中文简介，没有时再退回原文摘要。 */
export function displaySummary(work: { summary_cn?: string; summary?: string }): string {
  const cn = (work.summary_cn || "").trim();
  if (cn) return cn;
  return (work.summary || "").trim();
}
