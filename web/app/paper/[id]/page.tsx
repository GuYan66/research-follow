import Link from "next/link";
import { ArrowLeft, FileText, Quote, Users } from "lucide-react";
import { getAllWorks, getWorkById, getRelated, getGroups } from "@/lib/data";
import { SourceBadge } from "@/components/SourceBadge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { displaySummary, formatDate, groupDisplayName, groupPalette } from "@/lib/utils";
import type { Work } from "@/lib/types";

export function generateStaticParams() {
  // 只为论文建详情页；博客卡片直接外链原文。
  const ids = getAllWorks()
    .filter((w) => w.kind !== "blog")
    .map((w) => ({ id: w.work_id }));
  // Next 15 在 output:export 下要求 generateStaticParams 不能返回空数组。首次抓取前给哨兵占位。
  return ids.length > 0 ? ids : [{ id: "_" }];
}

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Inner id={id} />;
}

function Inner({ id }: { id: string }) {
  const work = getWorkById(id);
  if (!work) {
    const total = getAllWorks().length;
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center text-stone-500">
        {total === 0
          ? "暂无数据。等 GitHub Actions 跑完每日抓取后，这里会显示论文。"
          : "未找到该论文。"}
        <div className="mt-4">
          <Link href="/" className="text-sky-600 hover:underline">返回列表</Link>
        </div>
      </main>
    );
  }
  return <PaperDetail work={work} />;
}

function PaperDetail({ work }: { work: Work }) {
  const related = getRelated(work, 5);
  const groups = getGroups();
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const memberSet = new Set(work.member_names.map((n) => n.toLowerCase()));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
        <ArrowLeft className="h-4 w-4" /> 返回列表
      </Link>

      <article className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {work.group_ids.map((gid) => {
            const g = groupMap.get(gid);
            const pal = groupPalette(gid);
            return (
              <Link
                key={gid}
                href={`/groups/${gid}/`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80 ${pal.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${pal.dot}`} />
                {g ? groupDisplayName(g) : gid}
              </Link>
            );
          })}
          <SourceBadge sources={work.sources} />
          {work.venue && <span className="text-xs text-stone-500">{work.venue}</span>}
          {work.citation_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-stone-500">
              <Quote className="h-3 w-3" /> {work.citation_count} 引用
            </span>
          )}
          {work.primary_category && (
            <span className="text-xs text-stone-500">{work.primary_category}</span>
          )}
        </div>

        <h1 className="text-xl font-bold leading-snug text-stone-900 dark:text-stone-100">
          {work.title}
        </h1>

        {work.authors.length > 0 && (
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            <Users className="mr-1 inline h-3.5 w-3.5 -translate-y-0.5 text-stone-400" />
            {work.authors.map((a, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <span className={memberSet.has(a.toLowerCase()) ? "font-semibold text-stone-900 dark:text-stone-200" : ""}>
                  {a}
                </span>
              </span>
            ))}
          </p>
        )}

        <p className="mt-1 text-xs text-stone-400">
          发布 {formatDate(work.published)} · 更新 {formatDate(work.updated)} · 抓取 {work.fetch_date}
          {work.member_names.length > 0 && <> · 被关注：{work.member_names.join("、")}</>}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {work.url && (
            <a href={work.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">
              <FileText className="h-4 w-4" /> {work.arxiv_id ? "arXiv 页" : "论文页"}
            </a>
          )}
          {work.pdf_url && (
            <a href={work.pdf_url} target="_blank" rel="noopener noreferrer"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">
              PDF
            </a>
          )}
          <FavoriteButton id={work.work_id} />
        </div>

        {work.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {work.categories.map((c) => (
              <span key={c} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {c}
              </span>
            ))}
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">简介</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {displaySummary(work) || "（暂无简介）"}
          </p>
        </section>
        {work.summary_cn && work.summary && work.summary_cn.trim() !== work.summary.trim() && (
          <section className="mt-4">
            <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">原文摘要</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              {work.summary}
            </p>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">同组相关</h2>
            <ul className="mt-2 space-y-1.5">
              {related.map((r) =>
                r.kind === "blog" ? (
                  <li key={r.work_id} className="text-sm">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 hover:underline dark:text-sky-400"
                    >
                      {r.title}
                    </a>
                    <span className="ml-2 text-xs text-stone-400">
                      博客 · {formatDate(r.published)}
                    </span>
                  </li>
                ) : (
                  <li key={r.work_id} className="text-sm">
                    <Link href={`/paper/${r.work_id}/`} className="text-sky-700 hover:underline dark:text-sky-400">
                      {r.title}
                    </Link>
                    <span className="ml-2 text-xs text-stone-400">
                      {r.citation_count > 0 ? `${r.citation_count} 引用 · ` : ""}{formatDate(r.published)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
