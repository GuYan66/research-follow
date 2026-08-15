"""加载并校验 groups.yaml（跟踪哪些顶组）。

增删关注对象只改 groups.yaml，本模块只负责读取、校验与查询。

校验内容：
- group id / member id 全局唯一
- region ∈ {cn, intl}，kind ∈ {academia, industry}（由 pydantic 保证）
- 每个组至少有一个可抓取入口：成员的某个源 ID，或一个 feed
"""

from __future__ import annotations

from pathlib import Path

import yaml

from models import Author, Feed, Group

YAML_PATH = Path(__file__).resolve().parent / "groups.yaml"


class GroupConfigError(Exception):
    """groups.yaml 配置有误。"""


def _validate(groups: list[Group]) -> None:
    seen_g: set[str] = set()
    seen_m: set[str] = set()
    for g in groups:
        if g.id in seen_g:
            raise GroupConfigError(f"重复的 group id: {g.id}")
        seen_g.add(g.id)

        has_author_source = any(
            m.openalex_id or m.s2_id or m.arxiv_name for m in g.members
        )
        if not (has_author_source or g.feeds):
            raise GroupConfigError(
                f"组 {g.id} 既没有任何作者源 ID，也没有 feed，抓不到任何东西"
            )

        for m in g.members:
            if m.id in seen_m:
                raise GroupConfigError(f"重复的 member id: {m.id}（组 {g.id}）")
            seen_m.add(m.id)


def load_groups(path: Path | str | None = None) -> list[Group]:
    """读取 YAML -> Group 列表。成员的 group_id 自动回填。"""
    p = Path(path) if path else YAML_PATH
    if not p.exists():
        raise GroupConfigError(f"找不到配置文件: {p}")

    raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    items = raw.get("groups")
    if not isinstance(items, list) or not items:
        raise GroupConfigError(f"{p} 里 groups 必须是非空列表")

    groups: list[Group] = []
    for item in items:
        g = Group.model_validate(item)
        for m in g.members:
            m.group_id = g.id
        groups.append(g)

    _validate(groups)
    return groups


def all_members(groups: list[Group]) -> list[Author]:
    return [m for g in groups for m in g.members]


def all_feeds(groups: list[Group]) -> list[Feed]:
    return [f for g in groups for f in g.feeds]
