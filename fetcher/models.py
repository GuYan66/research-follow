"""数据模型（pydantic v2）。

按「顶组」跟踪其工作（Work）：目前 kind = paper | blog，预留 model / release。
论文来自 OpenAlex / arXiv / S2，博客来自各组官方 RSS/Atom。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Region = Literal["cn", "intl"]
GroupKind = Literal["academia", "industry"]
WorkKind = Literal["paper", "blog", "model", "release"]


class Author(BaseModel):
    """被关注的研究者。各源 ID 可选，缺哪个就跳过哪个源。"""

    id: str  # 内部稳定 id，如 "pieter-abbeel"
    name: str  # 显示名
    group_id: str = ""  # 由 groups.py 加载时按所属组回填
    role: str = ""  # 可选说明，如 "PI" / "Research Lead"
    s2_id: str = ""  # Semantic Scholar author id
    openalex_id: str = ""  # OpenAlex author id，如 A5049349154
    arxiv_name: str = ""  # arXiv 作者检索名，如 "Abbeel, Pieter"


class Feed(BaseModel):
    """一个组的官方 RSS/Atom 源。只接稳定 feed，不爬 HTML。"""

    url: str
    label: str = ""  # 展示名，如 "OpenAI News"
    type: str = "rss"  # 预留：将来可能有 atom 之外的类型


class Group(BaseModel):
    """一个顶组（实验室 / 工业界研究团队）。"""

    id: str
    name: str
    name_cn: str = ""  # 中文显示名；空则前端用 name
    region: Region = "intl"
    kind: GroupKind = "academia"
    affiliation: str = ""
    homepage: str = ""
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    feeds: list[Feed] = Field(default_factory=list)
    members: list[Author] = Field(default_factory=list)


class WorkRaw(BaseModel):
    """单源抓到的一条原始工作（带来源与团队标签）。aggregator 跨源合并。"""

    work_id: str = ""  # aggregator 填：论文用 arxiv/doi，博客用 URL 派生
    kind: WorkKind = "paper"
    title: str
    url: str = ""  # 主链接：论文详情页 / 博客原文
    published: str  # ISO 8601
    updated: str = ""  # ISO 8601
    summary: str = ""  # 论文摘要 / 博客摘要
    source: str = ""  # openalex / s2 / arxiv / blog
    group_ids: list[str] = Field(default_factory=list)
    member_ids: list[str] = Field(default_factory=list)
    member_names: list[str] = Field(default_factory=list)

    # --- 论文专有 ---
    authors: list[str] = Field(default_factory=list)
    venue: str = ""
    citation_count: int = 0
    influential_citation_count: int = 0
    doi: str = ""
    arxiv_id: str = ""  # 不带版本，如 2401.12345
    primary_category: str = ""
    categories: list[str] = Field(default_factory=list)
    pdf_url: str = ""

    # --- 博客专有 ---
    feed_url: str = ""
    blog_label: str = ""  # feed 展示名，如 "DeepMind Blog"

    # 预留：日后接 LLM 中文总结
    summary_cn: str = ""
    fetch_date: str = ""


class Work(WorkRaw):
    """跨源合并后的完整记录。"""

    sources: list[str] = Field(default_factory=list)  # 命中来源列表


class DayBundle(BaseModel):
    """单日数据文件 works-YYYY-MM-DD.json 的结构。"""

    date: str
    groups: list[str] = Field(default_factory=list)  # 涉及的 group id
    window_days: int = 7
    works: list[Work] = Field(default_factory=list)
    source_stats: dict[str, int] = Field(default_factory=dict)  # 各源原始命中数
    kind_stats: dict[str, int] = Field(default_factory=dict)  # 各 kind 合并后条数


class IndexEntry(BaseModel):
    """index.json 里每条工作的精简索引项。"""

    work_id: str
    kind: WorkKind = "paper"
    title: str
    date: str  # 首次抓到日期
    published: str = ""
    arxiv_id: str = ""
    group_ids: list[str] = Field(default_factory=list)
    venue: str = ""
    citation_count: int = 0
    path: str  # 相对 data/ 的 bundle 文件路径


class Index(BaseModel):
    """data/index.json：全部工作的去重汇总索引。"""

    works: dict[str, IndexEntry] = Field(default_factory=dict)
    last_updated: str = ""
