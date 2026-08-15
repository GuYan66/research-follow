"""每日编排入口：抓论文 + 抓官方博客 -> 跨源去重 -> 写 data/。

用法：
  python fetcher/run_daily.py --days 7 --dry-run          # 只抓取+去重，不写文件
  python fetcher/run_daily.py --days 7 --only blogs --dry-run  # 只验证 RSS
  python fetcher/run_daily.py --days 7                    # 正式运行，写 data/

环境变量（可选，.env 会自动加载）：
  S2_API_KEY        Semantic Scholar API key（提额，不填也能用）
  OPENALEX_MAILTO   OpenAlex 礼貌联系邮箱
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# 让 `python fetcher/run_daily.py` 能 import 同目录模块
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except Exception:
    pass  # 无 python-dotenv 也无所谓

from aggregator import aggregate  # noqa: E402
from groups import all_feeds, all_members, load_groups  # noqa: E402
from models import DayBundle, Group, WorkRaw  # noqa: E402
from sources import fetch_author  # noqa: E402
from sources.rss import fetch_group_feeds  # noqa: E402
import glm_summarizer  # noqa: E402
import store  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent

# 组数上到 20+ 后，作者维度请求量成倍增长；每位作者之间歇一下，避免触发限流。
MEMBER_SLEEP_SEC = 1.0


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _fetch_papers(groups: list[Group], days: int) -> tuple[list[WorkRaw], dict[str, int]]:
    raws: list[WorkRaw] = []
    counts: dict[str, int] = {}
    members = all_members(groups)
    if not members:
        print("  （无成员配置，跳过论文抓取）")
        return raws, counts
    for i, m in enumerate(members):
        print(f"  · {m.name}（{m.group_id}）")
        got = fetch_author(m, days)
        print(f"      命中 {len(got)} 篇原始")
        raws += got
        for r in got:
            counts[r.source] = counts.get(r.source, 0) + 1
        if i < len(members) - 1:
            time.sleep(MEMBER_SLEEP_SEC)
    return raws, counts


def _fetch_blogs(groups: list[Group], days: int) -> tuple[list[WorkRaw], dict[str, int]]:
    raws: list[WorkRaw] = []
    counts: dict[str, int] = {}
    with_feeds = [g for g in groups if g.feeds]
    if not with_feeds:
        print("  （无 feed 配置，跳过博客抓取）")
        return raws, counts
    for g in with_feeds:
        print(f"  · {g.name}（{g.id}）")
        got = fetch_group_feeds(g.id, g.feeds, days)
        raws += got
        for r in got:
            counts[r.source] = counts.get(r.source, 0) + 1
    return raws, counts


def main() -> int:
    ap = argparse.ArgumentParser(
        description="AI 顶组雷达每日抓取（论文多源聚合 + 官方博客 RSS）"
    )
    ap.add_argument("--days", type=int, default=7, help="抓取最近 N 天（默认 7，含当天）")
    ap.add_argument(
        "--only",
        choices=["all", "papers", "blogs"],
        default="all",
        help="只跑某一类来源，便于分开调试（默认 all）",
    )
    ap.add_argument("--dry-run", action="store_true", help="只抓取与去重，不写文件")
    ap.add_argument("--repo-root", default=str(REPO_ROOT), help="仓库根目录")
    args = ap.parse_args()

    repo_root = Path(args.repo_root)
    groups = load_groups()
    members = all_members(groups)
    feeds = all_feeds(groups)
    print(
        f"[0/5] 配置：{len(groups)} 个组 / {len(members)} 位作者 / {len(feeds)} 个 feed"
        f"（国内 {sum(1 for g in groups if g.region == 'cn')}"
        f" · 工业 {sum(1 for g in groups if g.kind == 'industry')}）"
    )

    raws: list[WorkRaw] = []
    src_counts: dict[str, int] = {}

    if args.only in ("all", "papers"):
        print(f"[1/5] 抓论文（最近 {args.days} 天）…")
        got, counts = _fetch_papers(groups, args.days)
        raws += got
        src_counts.update(counts)
    else:
        print("[1/5] 跳过论文抓取（--only blogs）")

    if args.only in ("all", "blogs"):
        print(f"[2/5] 抓官方博客（最近 {args.days} 天）…")
        got, counts = _fetch_blogs(groups, args.days)
        raws += got
        for k, v in counts.items():
            src_counts[k] = src_counts.get(k, 0) + v
    else:
        print("[2/5] 跳过博客抓取（--only papers）")

    works = aggregate(raws)
    kind_counts: dict[str, int] = {}
    for w in works:
        kind_counts[w.kind] = kind_counts.get(w.kind, 0) + 1
    print(
        f"[3/5] 去重合并后 {len(works)} 条（原始 {len(raws)}）。"
        f"来源: {src_counts} · 类型: {kind_counts}"
    )

    print("[4/5] 补中文简介…")
    n_cn = glm_summarizer.fill_summaries(works, repo_root)
    have_cn = sum(1 for w in works if w.summary_cn)
    print(f"      新生成 {n_cn} 条，已有中文简介 {have_cn}/{len(works)}")

    if args.dry_run:
        print("\n-- dry-run：合并后工作（前 40）--")
        for w in works[:40]:
            tag = "论文" if w.kind == "paper" else "博客"
            print(f"  [{w.published[:10]}] {tag} {w.work_id}  {w.title[:70]}")
            extra = (
                f"venue={w.venue or '-'} 引用={w.citation_count}"
                if w.kind == "paper"
                else f"feed={w.blog_label or '-'}"
            )
            print(f"      来源={w.sources} 团队={w.group_ids} {extra}")
        print(f"\n共 {len(works)} 条。dry-run 结束，未写文件。")
        return 0

    today = _today_utc()
    for w in works:
        w.fetch_date = today

    bundle = DayBundle(
        date=today,
        groups=[g.id for g in groups],
        window_days=args.days,
        works=works,
        source_stats=src_counts,
        kind_stats=kind_counts,
    )
    rel = store.save_day_bundle(repo_root, bundle)
    store.save_groups(repo_root, groups)

    index = store.load_index(repo_root)
    store.upsert_index(index, works, rel)
    store.save_index(repo_root, index)

    print(f"[5/5] 已写入 {rel}（{len(works)} 条）；索引共 {len(index.works)} 条")
    papers = [w for w in works if w.kind == "paper"]
    if papers:
        top = sorted(papers, key=lambda x: x.citation_count, reverse=True)[:3]
        print("      引用 Top3:")
        for w in top:
            print(f"        {w.citation_count} 引  {w.work_id}  {w.title[:60]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
