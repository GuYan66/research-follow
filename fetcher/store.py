"""读写 data/ JSON：单日 bundle + 全量去重索引 + 团队元信息。

仓库布局：
  data/index.json                  全量去重索引（work_id -> 精简项）
  data/works/works-YYYY-MM-DD.json 单日 bundle（滚动 N 天窗口，论文 + 博客）
  data/groups.json                 团队/成员元信息（供网站导航）
  data/papers/                     历史遗留（只含论文的旧 bundle），网站兼容读取
  data/cache/                      预留（未来 LLM 总结缓存）
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from models import DayBundle, Group, Index, IndexEntry, Work


def _data_dir(repo_root: Path) -> Path:
    d = repo_root / "data"
    (d / "works").mkdir(parents=True, exist_ok=True)
    (d / "cache").mkdir(parents=True, exist_ok=True)
    return d


# ---------- index ----------

def _index_path(repo_root: Path) -> Path:
    return _data_dir(repo_root) / "index.json"


def _migrate_index_payload(payload: dict) -> dict:
    """兼容旧结构：{"papers": {id: {paper_id, ...}}} -> {"works": {id: {work_id, kind, ...}}}。"""
    if "works" in payload:
        return payload
    legacy = payload.get("papers") or {}
    works = {}
    for key, entry in legacy.items():
        if not isinstance(entry, dict):
            continue
        e = dict(entry)
        e["work_id"] = e.pop("paper_id", key)
        e.setdefault("kind", "paper")
        works[e["work_id"]] = e
    return {"works": works, "last_updated": payload.get("last_updated", "")}


def load_index(repo_root: Path) -> Index:
    p = _index_path(repo_root)
    if not p.exists():
        return Index()
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
        return Index.model_validate(_migrate_index_payload(payload))
    except Exception:
        return Index()


def save_index(repo_root: Path, index: Index) -> None:
    p = _index_path(repo_root)
    index.last_updated = datetime.now(timezone.utc).isoformat()
    p.write_text(
        json.dumps(index.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def upsert_index(index: Index, works: list[Work], bundle_rel_path: str) -> None:
    """把当日工作并入索引。已存在的 id 不覆盖（保留首次抓取日）。"""
    for w in works:
        if w.work_id in index.works:
            continue
        index.works[w.work_id] = IndexEntry(
            work_id=w.work_id,
            kind=w.kind,
            title=w.title,
            date=w.fetch_date,
            published=w.published,
            arxiv_id=w.arxiv_id,
            group_ids=w.group_ids,
            venue=w.venue,
            citation_count=w.citation_count,
            path=bundle_rel_path,
        )


# ---------- day bundle ----------

def save_day_bundle(repo_root: Path, bundle: DayBundle) -> str:
    rel = f"works/works-{bundle.date}.json"
    p = _data_dir(repo_root) / rel
    p.write_text(
        json.dumps(bundle.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return rel


# ---------- groups ----------

def save_groups(repo_root: Path, groups: list[Group]) -> None:
    """导出团队/成员元信息供网站导航（不含各源作者 ID）。"""
    p = _data_dir(repo_root) / "groups.json"
    slim = [
        {
            "id": g.id,
            "name": g.name,
            "name_cn": g.name_cn or g.name,
            "region": g.region,
            "kind": g.kind,
            "affiliation": g.affiliation,
            "homepage": g.homepage,
            "description": g.description,
            "tags": g.tags,
            "feeds": [
                {"url": f.url, "label": f.label or g.name, "type": f.type}
                for f in g.feeds
            ],
            "members": [
                {
                    "id": m.id,
                    "name": m.name,
                    "group_id": m.group_id,
                    "role": m.role,
                }
                for m in g.members
            ],
        }
        for g in groups
    ]
    p.write_text(
        json.dumps(slim, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
