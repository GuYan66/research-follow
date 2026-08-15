import { getBundles, getUniqueWorks, getGroups, getStats } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  const bundles = getBundles();
  const uniqueWorks = getUniqueWorks();
  const groups = getGroups();
  const stats = getStats();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <SiteHeader active="feed" />

      {stats.total > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="论文" value={stats.papers} />
          <StatTile label="博客" value={stats.blogs} accent="violet" />
          <StatTile label="跟踪组" value={stats.groups} accent="sky" />
          <StatTile label="抓取天数" value={stats.days} />
        </div>
      )}

      <Dashboard bundles={bundles} uniqueWorks={uniqueWorks} groups={groups} />

      <footer className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-400 dark:border-stone-800">
        每日 UTC 00:17 自动抓取 · 论文按作者多源聚合（OpenAlex + arXiv），博客只接官方 RSS · 不调 LLM ·{" "}
        <a
          href="https://github.com/GuYan66/research-follow"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-stone-600 dark:hover:text-stone-300"
        >
          源码
        </a>
      </footer>
    </main>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "sky" | "violet";
}) {
  const color =
    accent === "sky"
      ? "text-sky-600 dark:text-sky-400"
      : accent === "violet"
      ? "text-violet-600 dark:text-violet-400"
      : "text-stone-800 dark:text-stone-100";
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[11px] text-stone-500 dark:text-stone-400">{label}</div>
    </div>
  );
}
