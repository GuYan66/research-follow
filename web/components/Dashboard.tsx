"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Star, Calendar, LayoutGrid, ArrowRight } from "lucide-react";
import type { DayBundle, Group, Work } from "@/lib/types";
import { WorkCard } from "./WorkCard";
import { useFavorites } from "@/lib/favorites";

type SortKey = "date" | "citations";
type Mode = "day" | "all";
type KindFilter = "all" | "paper" | "blog";
type RegionFilter = "all" | "cn" | "intl";
type GroupKindFilter = "all" | "industry" | "academia";

export function Dashboard({
  bundles,
  uniqueWorks,
  groups,
}: {
  bundles: DayBundle[];
  uniqueWorks: Work[];
  groups: Group[];
}) {
  const [mode, setMode] = useState<Mode>("day");
  const [selectedDate, setSelectedDate] = useState(bundles[0]?.date ?? "");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [groupKind, setGroupKind] = useState<GroupKindFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>(""); // "" = 全部
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("date");
  const { ids: favIds } = useFavorites();

  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // 地域/属性筛选先作用在「组」上，再落到工作
  const allowedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      if (region !== "all" && g.region !== region) continue;
      if (groupKind !== "all" && g.kind !== groupKind) continue;
      ids.add(g.id);
    }
    return ids;
  }, [groups, region, groupKind]);

  // 地域/属性收窄后，之前选中的组可能已不在候选里；此时按「全部组」处理，避免出现无法解释的空列表
  const effectiveGroup =
    groupFilter && allowedGroupIds.has(groupFilter) ? groupFilter : "";

  const base: Work[] = useMemo(() => {
    if (mode === "all") return uniqueWorks;
    const b = bundles.find((x) => x.date === selectedDate);
    return b ? b.works : [];
  }, [mode, selectedDate, bundles, uniqueWorks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = base.filter((w) => {
      if (kind !== "all" && w.kind !== kind) return false;
      if (effectiveGroup && !w.group_ids.includes(effectiveGroup)) return false;
      // 组元信息缺失（如历史数据里的旧组）时不因地域/属性筛选被误杀
      if (
        (region !== "all" || groupKind !== "all") &&
        w.group_ids.some((g) => groupMap.has(g)) &&
        !w.group_ids.some((g) => allowedGroupIds.has(g))
      ) {
        return false;
      }
      if (favOnly && !favIds.has(w.work_id)) return false;
      if (q) {
        const hay = `${w.title} ${w.summary} ${w.summary_cn} ${w.authors.join(" ")} ${w.member_names.join(
          " "
        )} ${w.venue} ${w.blog_label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "citations") {
        return b.citation_count - a.citation_count || (a.published < b.published ? 1 : -1);
      }
      return a.published < b.published ? 1 : -1;
    });
    return list;
  }, [
    base,
    query,
    kind,
    effectiveGroup,
    region,
    groupKind,
    allowedGroupIds,
    groupMap,
    favOnly,
    sort,
    favIds,
  ]);

  const currentBundle = bundles.find((x) => x.date === selectedDate);
  const counts = useMemo(() => {
    let paper = 0;
    let blog = 0;
    for (const w of base) {
      if (w.kind === "blog") blog += 1;
      else paper += 1;
    }
    return { paper, blog };
  }, [base]);

  // 组下拉：按 国内/国际 分栏，只列出通过地域/属性筛选的组
  const groupOptions = useMemo(() => {
    const pick = groups.filter((g) => allowedGroupIds.has(g.id));
    return {
      cn: pick.filter((g) => g.region === "cn"),
      intl: pick.filter((g) => g.region === "intl"),
    };
  }, [groups, allowedGroupIds]);

  return (
    <div className="flex flex-col gap-4">
      {/* 分段模式切换 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-stone-800 dark:bg-stone-900">
          <SegBtn active={mode === "day"} onClick={() => setMode("day")}>
            <Calendar className="h-3.5 w-3.5" /> 按日
          </SegBtn>
          <SegBtn active={mode === "all"} onClick={() => setMode("all")}>
            <LayoutGrid className="h-3.5 w-3.5" /> 全部
            <span className="ml-1 rounded bg-stone-300 px-1 text-[10px] tabular-nums text-stone-600 dark:bg-stone-700 dark:text-stone-300">
              {uniqueWorks.length}
            </span>
          </SegBtn>
        </div>
        <Link
          href="/groups/"
          className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
        >
          浏览全部 {groups.length} 个组 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* 日期导航 */}
      {mode === "day" && bundles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bundles.map((b) => (
            <button
              key={b.date}
              onClick={() => setSelectedDate(b.date)}
              className={
                "rounded-full px-3 py-1 text-xs transition " +
                (b.date === selectedDate
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-800")
              }
            >
              {b.date}
              <span className="ml-1 opacity-60">{b.works.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* 维度筛选：类型 / 地域 / 属性 / 具体组 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <FilterRow label="类型">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>全部</Chip>
          <Chip active={kind === "paper"} onClick={() => setKind("paper")}>
            论文 <span className="opacity-50">{counts.paper}</span>
          </Chip>
          <Chip active={kind === "blog"} onClick={() => setKind("blog")}>
            博客 <span className="opacity-50">{counts.blog}</span>
          </Chip>
        </FilterRow>

        <FilterRow label="地域">
          <Chip active={region === "all"} onClick={() => setRegion("all")}>全部</Chip>
          <Chip active={region === "cn"} onClick={() => setRegion("cn")}>国内</Chip>
          <Chip active={region === "intl"} onClick={() => setRegion("intl")}>国际</Chip>
        </FilterRow>

        <FilterRow label="属性">
          <Chip active={groupKind === "all"} onClick={() => setGroupKind("all")}>全部</Chip>
          <Chip active={groupKind === "industry"} onClick={() => setGroupKind("industry")}>
            工业界
          </Chip>
          <Chip active={groupKind === "academia"} onClick={() => setGroupKind("academia")}>
            学术界
          </Chip>
        </FilterRow>

        <label className="inline-flex items-center gap-1.5">
          <span className="text-stone-500 dark:text-stone-400">组</span>
          <select
            value={effectiveGroup}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="max-w-[190px] rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none dark:border-stone-800 dark:bg-stone-900"
          >
            <option value="">全部组</option>
            {groupOptions.cn.length > 0 && (
              <optgroup label="国内">
                {groupOptions.cn.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name_cn || g.name}
                  </option>
                ))}
              </optgroup>
            )}
            {groupOptions.intl.length > 0 && (
              <optgroup label="国际">
                {groupOptions.intl.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name_cn || g.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      {mode === "day" && currentBundle && (
        <p className="text-xs text-stone-500 dark:text-stone-500">
          {currentBundle.date} 的滚动窗口 · 过去 {currentBundle.window_days} 天 ·{" "}
          {currentBundle.works.length} 条
          {Object.keys(currentBundle.source_stats).length > 0 && (
            <>
              {" "}
              · 来源{" "}
              {Object.entries(currentBundle.source_stats)
                .map(([k, v]) => `${k}:${v}`)
                .join(" ")}
            </>
          )}
        </p>
      )}

      {/* 吸附筛选条 */}
      <div className="sticky top-0 z-10 -mx-4 mb-1 bg-[var(--bg)]/85 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题 / 摘要 / 作者…"
              className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-stone-800 dark:bg-stone-900 dark:focus:ring-sky-950"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm outline-none dark:border-stone-800 dark:bg-stone-900"
          >
            <option value="date">按时间</option>
            <option value="citations">按引用</option>
          </select>
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition " +
              (favOnly
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "border-stone-200 text-stone-500 hover:border-stone-300 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600")
            }
          >
            <Star className="h-3 w-3" fill={favOnly ? "currentColor" : "none"} /> 收藏
          </button>
          <span className="ml-auto text-xs text-stone-400 tabular-nums">
            {filtered.length} 条
          </span>
        </div>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500 dark:border-stone-700">
          {base.length === 0
            ? "该日期暂无数据。等 GitHub Actions 跑完每日抓取后，这里会显示论文与博客。"
            : "没有符合条件的内容，试试放宽筛选。"}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((w) => (
            <WorkCard key={w.work_id + w.fetch_date} work={w} groups={groups} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-stone-500 dark:text-stone-400">{label}</span>
      <div className="inline-flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-2 py-0.5 transition " +
        (active
          ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
          : "border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600")
      }
    >
      {children}
    </button>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition " +
        (active
          ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50"
          : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200")
      }
    >
      {children}
    </button>
  );
}