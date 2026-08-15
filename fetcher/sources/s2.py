"""Semantic Scholar 数据源：按 author id 拉论文，客户端按日期窗口过滤。

无 API key 时 ~1 req/s，每日一次抓取足够；填 S2_API_KEY 可提额。
endpoint: /author/{id}/papers?fields=...
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

import requests

from models import WorkRaw
from sources import arxiv_id_from_doi, strip_arxiv_version

BASE = "https://api.semanticscholar.org/graph/v1"
FIELDS = (
    "paperId,title,abstract,year,publicationDate,authors,venue,"
    "citationCount,influentialCitationCount,externalIds,openAccessPdf"
)
TIMEOUT = 30


def _within(pub: str, days: int) -> bool:
    if not pub:
        return False
    try:
        dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
    except Exception:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt >= datetime.now(timezone.utc) - timedelta(days=days)


def _get_with_retry(url: str, headers: dict, tries: int = 4) -> dict:
    for i in range(tries):
        try:
            r = requests.get(url, headers=headers, timeout=TIMEOUT)
            if r.status_code == 429:
                time.sleep(5 * (i + 1))
                continue
            r.raise_for_status()
            return r.json()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3)
    return {}


def fetch(s2_id: str, days: int, limit: int = 1000) -> list[WorkRaw]:
    headers = {}
    key = os.environ.get("S2_API_KEY", "").strip()
    if key:
        headers["x-api-key"] = key

    out: list[WorkRaw] = []
    # S2 的 /author/{id}/papers 不支持按日期排序，默认顺序非近期优先，
    # 因此一次性拉满（页大小 500，最多 2 页 = 1000 篇，覆盖绝大多数作者全部论文），
    # 再客户端按窗口过滤。S2 限制 offset+limit<=1000。
    offset = 0
    while offset < limit:
        url = (
            f"{BASE}/author/{s2_id}/papers?fields={FIELDS}"
            f"&limit=500&offset={offset}"
        )
        data = _get_with_retry(url, headers)
        items = data.get("data", []) or []
        if not items:
            break
        for it in items:
            pub = it.get("publicationDate") or ""
            if not _within(pub, days):
                continue
            ext = it.get("externalIds") or {}
            arxiv_id = (
                strip_arxiv_version(str(ext.get("ArXiv", "")))
                if ext.get("ArXiv")
                else ""
            )
            doi = ext.get("DOI", "") or ""
            if not arxiv_id:
                arxiv_id = arxiv_id_from_doi(doi)
            authors = [a.get("name", "") for a in (it.get("authors") or [])]
            oa = it.get("openAccessPdf") or {}
            pdf = oa.get("url", "") or ""
            url = (
                f"https://arxiv.org/abs/{arxiv_id}"
                if arxiv_id
                else f"https://www.semanticscholar.org/paper/{it.get('paperId', '')}"
            )
            out.append(
                WorkRaw(
                    kind="paper",
                    title=(it.get("title", "") or "").replace("\n", " ").strip(),
                    authors=authors,
                    summary=(it.get("abstract", "") or "").replace("\n", " ").strip(),
                    published=pub,
                    updated=pub,
                    venue=(it.get("venue", "") or ""),
                    citation_count=int(it.get("citationCount") or 0),
                    influential_citation_count=int(
                        it.get("influentialCitationCount") or 0
                    ),
                    doi=doi,
                    arxiv_id=arxiv_id,
                    pdf_url=pdf,
                    url=url,
                    source="s2",
                )
            )
        if len(items) < 500:
            break
        offset += 500
        time.sleep(1.2)  # 无 key 时 ~1 req/s，保险
    return out
