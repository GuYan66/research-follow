import Link from "next/link";
import { ArrowLeft, ExternalLink, Rss, Users } from "lucide-react";
import { getGroups, getGroupById, getWorksForGroup } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";
import { WorkCard } from "@/components/WorkCard";
import type { Group } from "@/lib/types";
import { groupDisplayName, groupKindClass, groupKindLabel, groupPalette, regionLabel, tagLabel } from "@/lib/utils";

const MAX_WORKS = 40;

export function generateStaticParams() {
  const ids = getGroups().map((g) => ({ id: g.id }));
  // Next 15 在 output:export 下要求 generateStaticParams 不能返回空数组。首次抓取前给哨兵占位。
  return ids.length > 0 ? ids : [{ id: "_" }];
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getGroupById(id);

  if (!group) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <SiteHeader active="groups" />
        <p className="text-center text-stone-500">
          未找到该组。<Link href="/groups/" className="text-sky-600 hover:underline">返回组列表</Link>
        </p>
      </main>
    );
  }

  return <GroupDetail group={group} />;
}

function GroupDetail({ group }: { group: Group }) {
  const groups = getGroups();
  const works = getWorksForGroup(group.id);
  const papers = works.filter((w) => w.kind === "paper").length;
  const blogs = works.length - papers;
  const pal = groupPalette(group.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <SiteHeader active="groups" />

      <Link
        href="/groups/"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
      >
        <ArrowLeft className="h-4 w-4" /> 返回组列表
      </Link>

      <section className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${pal.dot}`} />
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{groupDisplayName(group)}</h1>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            {regionLabel(group.region)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${groupKindClass(group.kind)}`}
          >
            {groupKindLabel(group.kind)}
          </span>
        </div>

        {(group.name_cn && group.name_cn !== group.name) || group.affiliation ? (
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {group.name_cn && group.name_cn !== group.name ? group.name : ""}
            {group.name_cn && group.name_cn !== group.name && group.affiliation ? " · " : ""}
            {group.affiliation && group.affiliation !== groupDisplayName(group) ? group.affiliation : ""}
          </p>
        ) : null}
        {group.description && (
          <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            {group.description}
          </p>
        )}

        {group.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {group.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              >
                {tagLabel(t)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {group.homepage && (
            <a
              href={group.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              官网 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {group.feeds.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <Rss className="h-3.5 w-3.5" /> {f.label || "RSS"}
            </a>
          ))}
        </div>

        <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
          已收录 {works.length} 条工作（论文 {papers} · 博客 {blogs}）
          {group.feeds.length === 0 && " · 该组无官方 RSS，只跟论文"}
          {group.members.length === 0 && " · 该组无可靠作者 ID，只跟官方博客"}
        </p>
      </section>

      {group.members.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-200">
            <Users className="h-4 w-4 text-stone-400" /> 跟踪的成员
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {group.members.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-stone-200 px-2.5 py-1 text-sm dark:border-stone-800"
              >
                <span className="text-stone-800 dark:text-stone-200">{m.name}</span>
                {m.role && (
                  <span className="ml-1.5 text-xs text-stone-400 dark:text-stone-500">{m.role}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">最近工作</h2>
        {works.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            该组暂无收录内容。
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {works.slice(0, MAX_WORKS).map((w) => (
              <WorkCard key={w.work_id} work={w} groups={groups} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
