"""OpenAlex 数据源：按 author id 拉论文，服务端按日期窗口过滤。

无需 API key，带 polite mailto。覆盖所有学科；摘要由倒排索引重建。
"""

from __future__ import annotations

import datetime
import os

import requests

from models import WorkRaw
from sources import arxiv_id_from_doi

BASE = "https://api.openalex.org"
MAILTO = os.environ.get("OPENALEX_MAILTO", "research-follow@example.com").strip()
FIELDS = (
    "id,title,abstract_inverted_index,publication_date,updated_date,authorships,"
    "primary_location,best_oa_location,cited_by_count,doi,ids,type"
)


def _reconstruct_abstract(inv: dict | None) -> str:
    if not inv:
        return ""
    pos: list[tuple[int, str]] = []
    for word, idxs in inv.items():
        for i in idxs:
            pos.append((i, word))
    pos.sort()
    return " ".join(w for _, w in pos)


def fetch(openalex_id: str, days: int, max_pages: int = 20) -> list[WorkRaw]:
    cutoff = (
        datetime.datetime.now(datetime.timezone.utc)
        - datetime.timedelta(days=days)
    ).strftime("%Y-%m-%d")
    headers = {"User-Agent": f"research-follow/0.2 (mailto:{MAILTO})"}
    out: list[WorkRaw] = []
    page = 1
    while page <= max_pages:
        url = (
            f"{BASE}/works?filter=author.id:{openalex_id},"
            f"from_publication_date:{cutoff}"
            f"&per-page=50&page={page}&sort=publication_date:desc"
            f"&select={FIELDS}&mailto={MAILTO}"
        )
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        d = r.json()
        results = d.get("results", []) or []
        if not results:
            break
        for w in results:
            pub = w.get("publication_date") or ""
            doi = (w.get("doi") or "").replace("https://doi.org/", "")
            arxiv_id = arxiv_id_from_doi(doi)
            authors = [
                a["author"]["display_name"]
                for a in (w.get("authorships") or [])
                if a.get("author")
            ]
            pl = w.get("primary_location") or {}
            src = pl.get("source") or {}
            venue = src.get("display_name", "") or ""
            best = w.get("best_oa_location") or {}
            pdf = pl.get("pdf_url") or best.get("pdf_url") or ""
            landing = (
                pl.get("landing_page_url")
                or best.get("landing_page_url")
                or ""
            )
            if arxiv_id:
                url = f"https://arxiv.org/abs/{arxiv_id}"
            elif landing:
                url = landing
            else:
                url = f"https://openalex.org/{(w.get('id','') or '').split('/')[-1]}"
            out.append(
                WorkRaw(
                    kind="paper",
                    title=(w.get("title", "") or "").replace("\n", " ").strip(),
                    authors=authors,
                    summary=_reconstruct_abstract(w.get("abstract_inverted_index")),
                    published=pub,
                    updated=(w.get("updated_date", "") or pub),
                    venue=venue,
                    citation_count=int(w.get("cited_by_count") or 0),
                    doi=doi,
                    arxiv_id=arxiv_id,
                    pdf_url=pdf or "",
                    url=url,
                    source="openalex",
                )
            )
        if len(results) < 50:
            break
        page += 1
    return out
