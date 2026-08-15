"""为每条工作生成一两句中文简介。

只在配置了 LLM_API_KEY 时启用；已缓存的 work_id 不再请求。
端点与模型走环境变量（与 paper-monitor 相同）：
  LLM_API_KEY    Bearer 鉴权 key
  LLM_BASE_URL   默认 https://open.bigmodel.cn/api/paas/v4
  LLM_MODEL      默认 glm-4.6
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

import requests

from models import Work

DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
TIMEOUT = 60
CACHE_NAME = "summaries.json"

_SYSTEM = (
    "你是中文科技编辑，把 AI 顶组的论文或官方博客压成给研究者看的简介。"
    "只输出 JSON，不要 markdown，不要额外文字。"
)

_SCHEMA = '{"summary_cn": "1-2 句中文简介：做了什么、和谁有关、为什么值得看"}'


def enabled() -> bool:
    return bool(os.environ.get("LLM_API_KEY", "").strip())


def _cache_path(repo_root: Path) -> Path:
    d = repo_root / "data" / "cache"
    d.mkdir(parents=True, exist_ok=True)
    return d / CACHE_NAME


def load_cache(repo_root: Path) -> dict[str, str]:
    p = _cache_path(repo_root)
    if not p.exists():
        return {}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return {k: v for k, v in raw.items() if isinstance(v, str) and v.strip()}
    except Exception:
        return {}


def save_cache(repo_root: Path, cache: dict[str, str]) -> None:
    _cache_path(repo_root).write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _extract_json(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    start = candidate.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(candidate)):
        if candidate[i] == "{":
            depth += 1
        elif candidate[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(candidate[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def _call(title: str, kind: str, summary: str) -> str:
    key = os.environ.get("LLM_API_KEY", "").strip()
    base = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    model = os.environ.get("LLM_MODEL", "glm-4.6").strip()
    kind_cn = "博客" if kind == "blog" else "论文"
    body = (
        f"类型：{kind_cn}\n标题：{title}\n原文摘要：\n{(summary or '')[:1200]}\n\n"
        f"请按如下 schema 输出（仅 JSON）：\n{_SCHEMA}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": body},
        ],
        "temperature": 0.3,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    last_err = ""
    for attempt in range(2):
        try:
            r = requests.post(
                f"{base}/chat/completions",
                headers=headers,
                json=payload,
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            text = (
                (((r.json().get("choices") or [{}])[0].get("message") or {}).get("content"))
                or ""
            )
            parsed = _extract_json(text)
            if parsed:
                cn = str(parsed.get("summary_cn") or "").strip()
                if cn:
                    return cn
            last_err = "empty-or-unparsed"
        except Exception as e:  # noqa: BLE001
            last_err = f"{type(e).__name__}: {e}"
        time.sleep(1.2 * (attempt + 1))
    print(f"      [简介] 生成失败 {title[:40]}: {last_err}")
    return ""


def fill_summaries(works: list[Work], repo_root: Path) -> int:
    """给缺中文简介的条目补 summary_cn。返回新生成条数。"""
    if not enabled():
        print("  （未配置 LLM_API_KEY，跳过中文简介）")
        return 0

    cache = load_cache(repo_root)
    filled = 0
    for w in works:
        if w.summary_cn:
            cache.setdefault(w.work_id, w.summary_cn)
            continue
        if w.work_id in cache:
            w.summary_cn = cache[w.work_id]
            continue
        print(f"  · 简介 {w.kind} {w.title[:50]}")
        cn = _call(w.title, w.kind, w.summary)
        if cn:
            w.summary_cn = cn
            cache[w.work_id] = cn
            filled += 1
        time.sleep(0.4)
    save_cache(repo_root, cache)
    return filled
