"""arXiv 数据源：按作者名检索（au:）。

注意：arXiv 只能按姓名检索，重名风险高（如常见姓名会匹配到无关同名人）。
建议仅对独特姓名启用；对易重名作者留空 arxiv_name 即跳过本源。
复用 PyPI `arxiv` 包。
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import arxiv

from models import WorkRaw

_V = re.compile(r"v\d+$")


def _strip(s: str) -> str:
    return _V.sub("", (s or "").strip())


def fetch(arxiv_name: str, days: int, max_results: int = 200) -> list[WorkRaw]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    client = arxiv.Client(num_retries=3, page_size=100)
    search = arxiv.Search(
        query=f'au:"{arxiv_name}"',
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    out: list[WorkRaw] = []
    seen: set[str] = set()
    for res in client.results(search):
        try:
            published = res.published
        except Exception:
            continue
        if published < cutoff:
            continue
        aid = _strip(res.get_short_id())
        if aid in seen:
            continue
        seen.add(aid)
        title = (res.title or "").replace("\n", " ").strip()
        summary = (res.summary or "").replace("\n", " ").strip()
        out.append(
            WorkRaw(
                kind="paper",
                title=title,
                authors=[str(a) for a in res.authors],
                summary=summary,
                published=published.isoformat(),
                updated=(res.updated.isoformat() if res.updated else published.isoformat()),
                primary_category=res.primary_category or "",
                categories=list(res.categories or []),
                arxiv_id=aid,
                pdf_url=res.pdf_url or f"https://arxiv.org/pdf/{aid}",
                url=f"https://arxiv.org/abs/{aid}",
                source="arxiv",
            )
        )
    return out
