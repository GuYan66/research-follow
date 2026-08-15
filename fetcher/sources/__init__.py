"""数据源统一接口、主键规范化与按作者/按 feed 抓取编排。

论文源实现 `fetch(<源内作者 id>, days) -> list[WorkRaw]`。
`fetch_author` 按作者在各可用源上抓取，逐源 try/except，某源失败不致命。
博客源见 `sources.rss`。
"""

from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from models import Author, WorkRaw

_ARXIV_V = re.compile(r"v\d+$")


def strip_arxiv_version(s: str) -> str:
    """去 arXiv id 版本号，如 2401.12345v1 -> 2401.12345。"""
    return _ARXIV_V.sub("", (s or "").strip())


def norm_doi(doi: str) -> str:
    return (doi or "").strip().lower()


# 从 DOI 中解析 arxiv id（OpenAlex 对 arXiv 论文用 10.48550/arxiv.XXXX）
_ARXIV_DOI = re.compile(r"10\.48550/arxiv\.(\S+)", re.IGNORECASE)


def arxiv_id_from_doi(doi: str) -> str:
    m = _ARXIV_DOI.search(doi or "")
    return strip_arxiv_version(m.group(1)) if m else ""


def title_key(w: WorkRaw) -> str:
    """仅按标题+第一作者归一化的键（用于把无强 id 的重复记录并入有 arxiv/doi 的记录）。"""
    first = w.authors[0].split()[-1] if w.authors else ""
    t = re.sub(r"[^a-z0-9]+", " ", (w.title or "").lower()).strip()
    return f"title:{t[:80]}|{first.lower()}" if t else ""


def canonical_key(w: WorkRaw) -> str:
    """论文跨源去重键：arxiv id > DOI > 标题+第一作者。"""
    if w.arxiv_id:
        return f"arxiv:{strip_arxiv_version(w.arxiv_id)}"
    if w.doi:
        return f"doi:{norm_doi(w.doi)}"
    return title_key(w)


def display_id(w: WorkRaw, key: str) -> str:
    """URL / 收藏用的稳定展示 id（论文）。"""
    if w.arxiv_id:
        return strip_arxiv_version(w.arxiv_id)
    if w.doi:
        return "doi-" + re.sub(r"[^A-Za-z0-9]+", "-", norm_doi(w.doi)).strip("-")[:40]
    return "p-" + re.sub(r"[^A-Za-z0-9]+", "-", key).strip("-")[:40]


# ---------- 博客键 ----------

# 常见 tracking 参数：去掉后同一篇文章的不同来源链接才能对上
_TRACKING = re.compile(
    r"^(utm_\w+|ref|referrer|source|fbclid|gclid|mc_cid|mc_eid|spm|from)$",
    re.IGNORECASE,
)


def norm_url(url: str) -> str:
    """规范化 URL：小写 host、去 www、去 tracking 参数、去末尾斜杠与 fragment。"""
    u = (url or "").strip()
    if not u:
        return ""
    try:
        parts = urlsplit(u)
    except ValueError:
        return u.lower()
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    query = urlencode(
        [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
         if not _TRACKING.match(k)]
    )
    path = parts.path.rstrip("/")
    return urlunsplit(("", host, path, query, ""))


def blog_key(w: WorkRaw) -> str:
    """博客去重键：规范化 URL > 标题+发布日。"""
    nu = norm_url(w.url)
    if nu:
        return f"url:{nu}"
    t = re.sub(r"[^a-z0-9]+", " ", (w.title or "").lower()).strip()
    return f"blogtitle:{t[:80]}|{(w.published or '')[:10]}"


def blog_display_id(w: WorkRaw, key: str) -> str:
    """博客展示 id：可读 slug + 短哈希，保证唯一且适合放进 URL / localStorage。"""
    nu = norm_url(w.url)
    basis = nu or key
    digest = hashlib.sha1(basis.encode("utf-8")).hexdigest()[:8]
    tail = basis.rsplit("/", 1)[-1] if "/" in basis else basis
    slug = re.sub(r"[^A-Za-z0-9]+", "-", tail).strip("-").lower()[:40]
    return f"blog-{slug}-{digest}" if slug else f"blog-{digest}"


# ---------- 按作者抓论文 ----------

def _stamp(works: list[WorkRaw], author: Author, source: str) -> list[WorkRaw]:
    """给每条原始记录打上来源与团队/成员标签。"""
    for w in works:
        w.source = source
        w.kind = "paper"
        if author.group_id and author.group_id not in w.group_ids:
            w.group_ids.append(author.group_id)
        if author.id not in w.member_ids:
            w.member_ids.append(author.id)
        if author.name not in w.member_names:
            w.member_names.append(author.name)
    return works


def fetch_author(author: Author, days: int) -> list[WorkRaw]:
    """按作者在各可用源拉最近 days 天论文。逐源独立容错。"""
    out: list[WorkRaw] = []

    if author.openalex_id:
        try:
            from sources.openalex import fetch as _f

            out += _stamp(_f(author.openalex_id, days), author, "openalex")
        except Exception as e:  # noqa: BLE001
            print(f"      [openalex] {author.name} 失败: {type(e).__name__}: {e}")

    if author.s2_id:
        try:
            from sources.s2 import fetch as _f

            out += _stamp(_f(author.s2_id, days), author, "s2")
        except Exception as e:  # noqa: BLE001
            print(f"      [s2] {author.name} 失败: {type(e).__name__}: {e}")

    if author.arxiv_name:
        try:
            from sources.arxiv_source import fetch as _f

            out += _stamp(_f(author.arxiv_name, days), author, "arxiv")
        except Exception as e:  # noqa: BLE001
            print(f"      [arxiv] {author.name} 失败: {type(e).__name__}: {e}")

    return out
