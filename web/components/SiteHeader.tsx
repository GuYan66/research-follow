import Link from "next/link";
import { Radar } from "lucide-react";

export function SiteHeader({ active }: { active: "feed" | "groups" }) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
          <Radar className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            AI 顶组雷达
          </span>
          <span className="block text-xs text-stone-500 dark:text-stone-400">
            追踪国内外 AI 顶组的工作 · 论文 + 官方博客 · 每日自动刷新
          </span>
        </span>
      </Link>

      <nav className="ml-auto inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-sm dark:border-stone-800 dark:bg-stone-900">
        <NavLink href="/" active={active === "feed"}>
          动态
        </NavLink>
        <NavLink href="/groups/" active={active === "groups"}>
          组
        </NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-md px-3 py-1 font-medium transition " +
        (active
          ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50"
          : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200")
      }
    >
      {children}
    </Link>
  );
}
