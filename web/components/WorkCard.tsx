"use client";

import Link from "next/link";
import { Star, FileText, Quote, Rss, ExternalLink } from "lucide-react";
import type { Group, Work } from "@/lib/types";
import { useFavorites } from "@/lib/favorites";
import { SourceBadge } from "./SourceBadge";
import { displaySummary, formatDate, groupDisplayName, groupPalette } from "@/lib/utils";

export function WorkCard({ work, groups }: { work: Work; groups: Group[] }) {
  const { has, toggle } = useFavorites();
  const fav = has(work.work_id);
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const memberSet = new Set(work.member_names.map((n) => n.toLowerCase()));
  const isBlog = work.kind === "blog";

  return (
    <article className="card-hover group rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {work.group_ids.map((gid) => {
              const g = groupMap.get(gid);
              const pal = groupPalette(gid);
              return (
                <Link
                  key={gid}
                  href={`/groups/${gid}/`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition hover:opacity-80 ${pal.badge}`}
                  title={g?.affiliation || g?.name || gid}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${pal.dot}`} />
                  {g ? groupDisplayName(g) : gid}
                </Link>
              );
            })}
            <SourceBadge sources={work.sources} />
            {isBlog ? (
              work.blog_label && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                  <Rss className="h-3 w-3" /> {work.blog_label}
                </span>
              )
            ) : (
              <>
                {work.venue && work.venue !== "arXiv" && (
                  <span className="text-[11px] text-stone-500 dark:text-stone-400">{work.venue}</span>
                )}
                {work.citation_count > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                    <Quote className="h-3 w-3" /> {work.citation_count}
                  </span>
                )}
              </>
            )}
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              {formatDate(work.published)}
            </span>
          </div>

          <h3 className="font-semibold leading-snug text-stone-900 dark:text-stone-100">
            {isBlog ? (
              // 博客只外链，不建站内详情页
              <a
                href={work.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-700 dark:hover:text-sky-400"
              >
                {work.title}
                <ExternalLink className="ml-1 inline h-3 w-3 -translate-y-0.5 text-stone-400" />
              </a>
            ) : (
              <Link
                href={`/paper/${work.work_id}/`}
                className="hover:text-sky-700 dark:hover:text-sky-400"
              >
                {work.title}
              </Link>
            )}
          </h3>

          {!isBlog && work.authors.length > 0 && (
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {work.authors.map((a, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span
                    className={
                      memberSet.has(a.toLowerCase())
                        ? "font-semibold text-stone-800 dark:text-stone-200"
                        : ""
                    }
                  >
                    {a}
                  </span>
                </span>
              ))}
            </p>
          )}

          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {displaySummary(work) || "（暂无简介）"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => toggle(work.work_id)}
            aria-label={fav ? "取消收藏" : "收藏"}
            className={
              "rounded-lg p-1.5 transition " +
              (fav
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                : "text-stone-300 hover:bg-stone-100 dark:text-stone-600 dark:hover:bg-stone-800")
            }
          >
            <Star className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-stone-100 pt-2.5 text-xs dark:border-stone-800">
        {work.url && (
          <a
            href={work.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          >
            {isBlog ? (
              <>
                <Rss className="h-3 w-3" /> 原文
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" /> {work.arxiv_id ? "arXiv" : "论文页"}
              </>
            )}
          </a>
        )}
        {work.pdf_url && (
          <a
            href={work.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          >
            PDF
          </a>
        )}
        {work.arxiv_id && (
          <span className="text-stone-400 dark:text-stone-500">{work.arxiv_id}</span>
        )}
      </div>
    </article>
  );
}
