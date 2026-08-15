"""博客源：解析各组官方 RSS/Atom。

只接稳定 feed，不爬 HTML。取不到发布时间的条目直接丢弃（否则无法做时间窗口）。
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import feedparser

from models import Feed, WorkRaw

UA = "research-follow/0.2 (+https://github.com/)"
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")
SUMMARY_MAX = 600


def _strip_html(s: str) -> str:
    txt = html.unescape(_TAG.sub(" ", s or ""))
    return _WS.sub(" ", txt).strip()


def _parse_dt(entry: dict) -> datetime | None:
    """尽量解析发布时间，统一成 aware UTC。"""
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime(*st[:6], tzinfo=timezone.utc)
            except Exception:  # noqa: BLE001
                pass
    for key in ("published", "updated", "created"):
        raw = entry.get(key)
        if not raw:
            continue
        try:
            dt = parsedate_to_datetime(raw)
        except Exception:  # noqa: BLE001
            try:
                dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            except Exception:  # noqa: BLE001
                continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


def _entry_summary(entry: dict) -> str:
    raw = entry.get("summary") or ""
    if not raw:
        contents = entry.get("content") or []
        if contents:
            raw = contents[0].get("value", "") or ""
    txt = _strip_html(raw)
    return txt[:SUMMARY_MAX]


def fetch(feed: Feed, days: int, max_entries: int = 60) -> list[WorkRaw]:
    """拉一个 feed 里最近 days 天的条目。解析失败由调用方兜住。"""
    parsed = feedparser.parse(feed.url, agent=UA)
    # bozo=1 常见于轻微不合规的 feed，只要还能解析出 entries 就继续用
    if not parsed.entries and getattr(parsed, "bozo", 0):
        raise RuntimeError(
            f"feed 解析失败: {getattr(parsed, 'bozo_exception', 'unknown')}"
        )

    label = feed.label or _strip_html(getattr(parsed.feed, "title", "")) or feed.url
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    out: list[WorkRaw] = []
    for entry in parsed.entries[:max_entries]:
        dt = _parse_dt(entry)
        if dt is None or dt < cutoff:
            continue
        title = _strip_html(entry.get("title", ""))
        link = (entry.get("link") or "").strip()
        if not title or not link:
            continue
        out.append(
            WorkRaw(
                kind="blog",
                title=title,
                url=link,
                published=dt.isoformat(),
                updated=dt.isoformat(),
                summary=_entry_summary(entry),
                source="blog",
                feed_url=feed.url,
                blog_label=label,
            )
        )
    return out


def fetch_group_feeds(group_id: str, feeds: list[Feed], days: int) -> list[WorkRaw]:
    """按组抓其所有 feed，逐 feed 独立容错。"""
    out: list[WorkRaw] = []
    for f in feeds:
        try:
            got = fetch(f, days)
        except Exception as e:  # noqa: BLE001
            print(f"      [blog] {f.label or f.url} 失败: {type(e).__name__}: {e}")
            continue
        for w in got:
            if group_id not in w.group_ids:
                w.group_ids.append(group_id)
        print(f"      [blog] {f.label or f.url} 命中 {len(got)} 条")
        out += got
    return out
