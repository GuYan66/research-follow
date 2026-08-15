import fs from "node:fs";
import path from "node:path";
import type { DayBundle, Group, Work } from "./types";

// 数据目录：web/ 的上一级 data/。`next build` 从 web/ 运行，故 ../data 指向仓库 data/。
const DATA_DIR = path.join(process.cwd(), "..", "data");
const WORKS_DIR = path.join(DATA_DIR, "works");
const LEGACY_PAPERS_DIR = path.join(DATA_DIR, "papers");
const GROUPS_PATH = path.join(DATA_DIR, "groups.json");

interface Loaded {
  bundles: DayBundle[];
  works: Work[]; // 全部工作（含跨日重复），按 published 倒序
  dates: string[]; // 去重 fetch_date，倒序
  groups: Group[];
}

let cache: Loaded | null = null;

// 旧 bundle（data/papers/papers-*.json）只有论文，字段名也是旧的：
// papers/paper_id/abstract/abs_url。这里补齐成 Work 结构，避免历史数据白丢。
function normalizeWork(raw: Record<string, unknown>): Work {
  const asStr = (v: unknown) => (typeof v === "string" ? v : "");
  const asArr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const asNum = (v: unknown) => (typeof v === "number" ? v : 0);

  const workId = asStr(raw.work_id) || asStr(raw.paper_id);
  const url = asStr(raw.url) || asStr(raw.abs_url);
  const summary = asStr(raw.summary) || asStr(raw.abstract);

  return {
    work_id: workId,
    kind: (asStr(raw.kind) || "paper") as Work["kind"],
    title: asStr(raw.title),
    url,
    published: asStr(raw.published),
    updated: asStr(raw.updated) || asStr(raw.published),
    summary,
    source: asStr(raw.source),
    group_ids: asArr(raw.group_ids),
    member_ids: asArr(raw.member_ids),
    member_names: asArr(raw.member_names),
    sources: asArr(raw.sources),
    authors: asArr(raw.authors),
    venue: asStr(raw.venue),
    citation_count: asNum(raw.citation_count),
    influential_citation_count: asNum(raw.influential_citation_count),
    doi: asStr(raw.doi),
    arxiv_id: asStr(raw.arxiv_id),
    primary_category: asStr(raw.primary_category),
    categories: asArr(raw.categories),
    pdf_url: asStr(raw.pdf_url),
    feed_url: asStr(raw.feed_url),
    blog_label: asStr(raw.blog_label),
    summary_cn: asStr(raw.summary_cn),
    fetch_date: asStr(raw.fetch_date),
  };
}

function normalizeBundle(raw: Record<string, unknown>): DayBundle {
  const list = Array.isArray(raw.works)
    ? raw.works
    : Array.isArray(raw.papers)
    ? raw.papers
    : [];
  return {
    date: typeof raw.date === "string" ? raw.date : "",
    groups: Array.isArray(raw.groups) ? (raw.groups as string[]) : [],
    window_days: typeof raw.window_days === "number" ? raw.window_days : 7,
    works: (list as Record<string, unknown>[]).map(normalizeWork),
    source_stats: (raw.source_stats as Record<string, number>) ?? {},
    kind_stats: (raw.kind_stats as Record<string, number>) ?? {},
  };
}

function readBundlesFrom(dir: string): DayBundle[] {
  if (!fs.existsSync(dir)) return [];
  const out: DayBundle[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      const bundle = normalizeBundle(raw);
      if (bundle.date) out.push(bundle);
    } catch {
      // 跳过损坏文件
    }
  }
  return out;
}

function load(): Loaded {
  if (cache) return cache;

  // 同一天若同时存在新旧文件，新的（works/）优先
  const byDate = new Map<string, DayBundle>();
  for (const b of readBundlesFrom(LEGACY_PAPERS_DIR)) byDate.set(b.date, b);
  for (const b of readBundlesFrom(WORKS_DIR)) byDate.set(b.date, b);

  const bundles = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  const works: Work[] = bundles.flatMap((b) => b.works);
  works.sort((a, b) => (a.published < b.published ? 1 : -1));

  const dates = bundles.map((b) => b.date);

  let groups: Group[] = [];
  try {
    if (fs.existsSync(GROUPS_PATH)) {
      groups = JSON.parse(fs.readFileSync(GROUPS_PATH, "utf-8")) as Group[];
    }
  } catch {
    // 无 groups.json 时退化为空
  }

  cache = { bundles, works, dates, groups };
  return cache;
}

export function getAllWorks(): Work[] {
  return load().works;
}

export function getUniqueWorks(): Work[] {
  // 按 work_id 去重，保留最新 fetch_date 的版本（滚动窗口下同一条会出现在多日 bundle 里）。
  const { works } = load();
  const byId = new Map<string, Work>();
  for (const w of works) {
    const ex = byId.get(w.work_id);
    if (!ex || w.fetch_date > ex.fetch_date) byId.set(w.work_id, w);
  }
  return [...byId.values()].sort((a, b) => (a.published < b.published ? 1 : -1));
}

export function getDates(): string[] {
  return load().dates;
}

export function getBundles(): DayBundle[] {
  return load().bundles;
}

export function getGroups(): Group[] {
  return load().groups;
}

export function getGroupById(id: string): Group | undefined {
  return load().groups.find((g) => g.id === id);
}

export function getWorkById(id: string): Work | undefined {
  return load().works.find((w) => w.work_id === id);
}

export function getWorksForGroup(groupId: string): Work[] {
  return getUniqueWorks().filter((w) => w.group_ids.includes(groupId));
}

export function getRelated(work: Work, n = 5): Work[] {
  const groupSet = new Set(work.group_ids);
  const all = getUniqueWorks().filter((w) => w.work_id !== work.work_id);
  return all
    .map((w) => {
      const overlap =
        w.group_ids.filter((g) => groupSet.has(g)).length * 2 +
        (w.primary_category && w.primary_category === work.primary_category ? 1 : 0);
      return { w, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || (a.w.published < b.w.published ? 1 : -1))
    .slice(0, n)
    .map((x) => x.w);
}

export function getStats() {
  const works = getUniqueWorks();
  const { dates, groups } = load();
  const srcSet = new Set<string>();
  let papers = 0;
  let blogs = 0;
  for (const w of works) {
    for (const s of w.sources) srcSet.add(s);
    if (w.kind === "blog") blogs += 1;
    else papers += 1;
  }
  return {
    total: works.length,
    papers,
    blogs,
    groups: groups.length,
    cnGroups: groups.filter((g) => g.region === "cn").length,
    industryGroups: groups.filter((g) => g.kind === "industry").length,
    days: dates.length,
    sources: srcSet.size,
  };
}
