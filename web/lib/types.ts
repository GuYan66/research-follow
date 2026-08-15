// 与 fetcher/models.py 对应的前端类型。

export type Region = "cn" | "intl";
export type GroupKind = "academia" | "industry";
export type WorkKind = "paper" | "blog" | "model" | "release";

export interface Work {
  work_id: string;
  kind: WorkKind;
  title: string;
  url: string;
  published: string; // ISO
  updated: string; // ISO
  summary: string;
  source: string; // 主来源（首个）
  group_ids: string[];
  member_ids: string[];
  member_names: string[];
  sources: string[]; // 全部命中来源

  // 论文专有
  authors: string[];
  venue: string;
  citation_count: number;
  influential_citation_count: number;
  doi: string;
  arxiv_id: string;
  primary_category: string;
  categories: string[];
  pdf_url: string;

  // 博客专有
  feed_url: string;
  blog_label: string;

  summary_cn: string; // 预留
  fetch_date: string;
}

export interface Member {
  id: string;
  name: string;
  group_id: string;
  role: string;
}

export interface Feed {
  url: string;
  label: string;
  type: string;
}

export interface Group {
  id: string;
  name: string;
  name_cn: string;
  region: Region;
  kind: GroupKind;
  affiliation: string;
  homepage: string;
  description: string;
  tags: string[];
  feeds: Feed[];
  members: Member[];
}

export interface DayBundle {
  date: string;
  groups: string[];
  window_days: number;
  works: Work[];
  source_stats: Record<string, number>;
  kind_stats: Record<string, number>;
}
