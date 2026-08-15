"""跨源 / 跨作者 / 跨组去重合并。

论文去重键：arxiv id > DOI > 标题+第一作者。
博客去重键：规范化 URL > 标题+发布日。
论文与博客不互相合并（kind 不同的记录各走一套桶）。
合并时 union 来源与团队/成员标签，并取各源最全字段。
"""

from __future__ import annotations

import html

from models import Work, WorkRaw
from sources import (
    blog_display_id,
    blog_key,
    canonical_key,
    display_id,
    strip_arxiv_version,
    title_key,
)


def _norm_venue(v: str) -> str:
    v = html.unescape(v or "").strip()
    if not v:
        return ""
    if "arxiv" in v.lower():
        return "arXiv"
    return v


def _union_labels(merged: Work, items: list[WorkRaw]) -> None:
    """union 来源、团队、成员、分类标签。"""
    sources: list[str] = []
    gids: list[str] = []
    mids: list[str] = []
    mnames: list[str] = []
    cats: list[str] = list(merged.categories)
    for r in items:
        if r.source and r.source not in sources:
            sources.append(r.source)
        for g in r.group_ids:
            if g not in gids:
                gids.append(g)
        for m in r.member_ids:
            if m not in mids:
                mids.append(m)
        for m in r.member_names:
            if m not in mnames:
                mnames.append(m)
        for c in r.categories:
            if c not in cats:
                cats.append(c)
    merged.sources = sources
    merged.group_ids = gids
    merged.member_ids = mids
    merged.member_names = mnames
    merged.categories = cats


def _aggregate_papers(raws: list[WorkRaw]) -> list[Work]:
    # 先建 标题 -> 强 id 键 的映射，供无 arxiv/doi 的重复记录（如 OpenAlex 自身重复）
    # 并入有强 id 的桶，避免同篇因一条有 DOI 一条没有而分成两份。
    strong_by_title: dict[str, str] = {}
    for r in raws:
        if r.arxiv_id or r.doi:
            tk = title_key(r)
            if tk and tk not in strong_by_title:
                strong_by_title[tk] = canonical_key(r)

    def final_key(r: WorkRaw) -> str:
        k = canonical_key(r)
        if not (r.arxiv_id or r.doi):
            tk = title_key(r)
            if tk and tk in strong_by_title:
                return strong_by_title[tk]
        return k

    bucket: dict[str, list[WorkRaw]] = {}
    for r in raws:
        bucket.setdefault(final_key(r), []).append(r)

    out: list[Work] = []
    for key, items in bucket.items():
        # 选“最全”的代表做基底：摘要非空 > 有 arxiv id > 引用高
        items_sorted = sorted(
            items,
            key=lambda r: (-len(r.summary), -len(r.arxiv_id), -r.citation_count),
        )
        base = items_sorted[0]
        merged = Work(**base.model_dump())
        merged.work_id = display_id(base, key)
        # 反转义 HTML 实体（OpenAlex 标题常含 &amp; 等）
        merged.title = html.unescape(merged.title)
        merged.summary = html.unescape(merged.summary)
        merged.venue = _norm_venue(merged.venue)
        _union_labels(merged, items)

        # 取更全字段
        for r in items_sorted[1:]:
            if not merged.summary and r.summary:
                merged.summary = r.summary
            if not merged.venue and r.venue:
                merged.venue = r.venue
            if r.citation_count > merged.citation_count:
                merged.citation_count = r.citation_count
            if r.influential_citation_count > merged.influential_citation_count:
                merged.influential_citation_count = r.influential_citation_count
            if not merged.pdf_url and r.pdf_url:
                merged.pdf_url = r.pdf_url
            if not merged.doi and r.doi:
                merged.doi = r.doi
            if not merged.arxiv_id and r.arxiv_id:
                merged.arxiv_id = strip_arxiv_version(r.arxiv_id)
            if not merged.primary_category and r.primary_category:
                merged.primary_category = r.primary_category
            if not merged.authors and r.authors:
                merged.authors = list(r.authors)

        # 有 arxiv id 时，链接统一指向 arXiv（对 CS/机器人方向最实用）
        if merged.arxiv_id:
            merged.url = f"https://arxiv.org/abs/{merged.arxiv_id}"
            if not merged.pdf_url:
                merged.pdf_url = f"https://arxiv.org/pdf/{merged.arxiv_id}"

        out.append(merged)
    return out


def _aggregate_blogs(raws: list[WorkRaw]) -> list[Work]:
    bucket: dict[str, list[WorkRaw]] = {}
    for r in raws:
        bucket.setdefault(blog_key(r), []).append(r)

    out: list[Work] = []
    for key, items in bucket.items():
        # 摘要更长的条目做基底
        items_sorted = sorted(items, key=lambda r: -len(r.summary))
        base = items_sorted[0]
        merged = Work(**base.model_dump())
        merged.work_id = blog_display_id(base, key)
        merged.title = html.unescape(merged.title)
        merged.summary = html.unescape(merged.summary)
        _union_labels(merged, items)
        for r in items_sorted[1:]:
            if not merged.summary and r.summary:
                merged.summary = r.summary
        out.append(merged)
    return out


def aggregate(raws: list[WorkRaw]) -> list[Work]:
    """按 kind 分别去重，再按发布时间倒序合成一条时间线。"""
    papers = [r for r in raws if r.kind == "paper"]
    blogs = [r for r in raws if r.kind == "blog"]
    works = _aggregate_papers(papers) + _aggregate_blogs(blogs)
    works.sort(key=lambda w: w.published, reverse=True)
    return works
