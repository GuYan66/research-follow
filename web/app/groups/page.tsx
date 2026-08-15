import Link from "next/link";
import { ExternalLink, Rss, Users } from "lucide-react";
import { getGroups, getUniqueWorks } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";
import type { Group, Region, GroupKind } from "@/lib/types";
import { groupDisplayName, groupKindClass, groupKindLabel, groupPalette, regionLabel } from "@/lib/utils";

const SECTIONS: { region: Region; kind: GroupKind }[] = [
  { region: "cn", kind: "industry" },
  { region: "cn", kind: "academia" },
  { region: "intl", kind: "industry" },
  { region: "intl", kind: "academia" },
];

export default function GroupsPage() {
  const groups = getGroups();
  const works = getUniqueWorks();

  const countByGroup = new Map<string, number>();
  for (const w of works) {
    for (const gid of w.group_ids) {
      countByGroup.set(gid, (countByGroup.get(gid) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <SiteHeader active="groups" />

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500 dark:border-stone-700">
          暂无组信息。等 GitHub Actions 跑完每日抓取后，这里会显示跟踪的组。
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-stone-600 dark:text-stone-400">
            共跟踪 {groups.length} 个组：国内{" "}
            {groups.filter((g) => g.region === "cn").length} 个、国际{" "}
            {groups.filter((g) => g.region === "intl").length} 个；工业界{" "}
            {groups.filter((g) => g.kind === "industry").length} 个、学术界{" "}
            {groups.filter((g) => g.kind === "academia").length} 个。
          </p>

          <div className="flex flex-col gap-8">
            {SECTIONS.map(({ region, kind }) => {
              const list = groups.filter((g) => g.region === region && g.kind === kind);
              if (list.length === 0) return null;
              return (
                <section key={`${region}-${kind}`}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-200">
                    {regionLabel(region)} · {groupKindLabel(kind)}
                    <span className="rounded bg-stone-100 px-1.5 text-xs font-normal tabular-nums text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                      {list.length}
                    </span>
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((g) => (
                      <GroupCard key={g.id} group={g} works={countByGroup.get(g.id) ?? 0} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

function GroupCard({ group, works }: { group: Group; works: number }) {
  const pal = groupPalette(group.id);
  return (
    <article className="card-hover flex flex-col rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${pal.dot}`} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-stone-900 dark:text-stone-100">
            <Link href={`/groups/${group.id}/`} className="hover:text-sky-700 dark:hover:text-sky-400">
              {groupDisplayName(group)}
            </Link>
          </h3>
          {group.affiliation && group.affiliation !== group.name && (
            <p className="text-xs text-stone-500 dark:text-stone-400">{group.affiliation}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${groupKindClass(
            group.kind
          )}`}
        >
          {groupKindLabel(group.kind)}
        </span>
      </div>

      {group.description && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {group.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400 dark:text-stone-500">
        <span className="tabular-nums">{works} 条工作</span>
        {group.members.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {group.members.length}
          </span>
        )}
        {group.feeds.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Rss className="h-3 w-3" /> {group.feeds.length}
          </span>
        )}
        {group.homepage && (
          <a
            href={group.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 hover:text-stone-700 dark:hover:text-stone-300"
          >
            官网 <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
