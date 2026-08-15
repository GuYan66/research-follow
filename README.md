# AI 顶组雷达（research-follow）

每日自动刷新的静态网站，追踪**国内外 AI 顶组**（工业界 + 学术界）的工作：

- **论文**：按组内成员的稳定作者 ID，从 OpenAlex / arXiv / Semantic Scholar 多源聚合并跨源去重；
- **博客**：按组的官方 RSS/Atom 收录技术博客与发布公告。

零 LLM 成本，只展示原始元数据。第一期覆盖 22 个组（国内 12 / 国际 10，工业界 13 / 学术界 9）。

## 与 paper-monitor 的关系

复用同一套架构（Python 抓取管线 -> GitHub Actions 每日 cron -> Next.js 静态导出 -> GitHub Pages），核心区别：

- paper-monitor 按**关键词**查 arXiv，并调 GLM 打分；
- 本项目按**组 / 作者**查，多数据源聚合 + 官方博客，不调 LLM。

## 架构

```
GitHub Actions（每日 cron）
  └─ Python 管线 fetcher/run_daily.py
       ├─ groups.yaml           跟踪哪些组（改这里增删关注对象）
       ├─ groups.py             加载并校验 YAML
       ├─ sources/              数据源适配器（统一接口，各源独立 try/except）
       │    ├─ openalex.py      OpenAlex：author id + 服务端日期窗口过滤
       │    ├─ s2.py            Semantic Scholar：author id 拉论文
       │    ├─ arxiv_source.py  arXiv：au: 作者名检索（含机构作者，如 DeepSeek-AI）
       │    └─ rss.py           官方博客 RSS/Atom
       ├─ aggregator.py         按 kind 分别去重（论文：arxiv>DOI>标题+一作；博客：规范化 URL>标题+日期）
       └─ store.py              写 data/works/*.json + data/index.json + data/groups.json
  └─ git commit & push data/
  └─ Next.js 静态导出 -> 部署到 GitHub Pages
```

- **后端逻辑**在 GHA 跑的 Python 管线里，不在网站里。
- **网站**是 Next.js（`output: 'export'`）纯静态站，构建时读 `data/*.json`。筛选/排序/搜索/收藏全在客户端（收藏用 localStorage）。
- **统一工作项**：论文与博客都是 `Work`，用 `kind` 区分（`paper` / `blog`，预留 `model` / `release`），首页是一条混合时间线。
- **滚动 N 天窗口**：每日抓过去 N 天（默认 7，含当天）。同一条工作跨源 / 跨日去重，合并各源最全字段。

## 目录

```
fetcher/        Python 数据管线（groups.yaml 为唯一配置入口）
data/works/     每日 bundle（论文 + 博客）
data/groups.json  组元信息（供网站导航）
data/papers/    历史遗留的旧格式 bundle，网站仍会兼容读取
web/            Next.js 静态站（App Router + Tailwind v4）
```

网站页面：

| 路径 | 内容 |
| --- | --- |
| `/` | 混合时间线，可按类型 / 地域 / 属性 / 组筛选 |
| `/groups` | 组名录，按 地域 × 属性 分四栏 |
| `/groups/[id]` | 组详情：简介、成员、官网与 RSS、该组最近工作 |
| `/paper/[id]` | 论文详情（博客不建详情页，卡片直接外链原文） |

## 配置关注的组

只改 [`fetcher/groups.yaml`](fetcher/groups.yaml)：

```yaml
groups:
  - id: berkeley-bair
    name: Berkeley AI Research (BAIR)
    region: intl          # cn | intl
    kind: academia        # academia | industry
    affiliation: UC Berkeley
    homepage: https://bair.berkeley.edu
    description: 强化学习与机器人学习重镇。
    tags: [rl, robotics]
    feeds:
      - url: https://bair.berkeley.edu/blog/feed.xml
        label: BAIR Blog
    members:
      - id: pieter-abbeel
        name: Pieter Abbeel
        role: PI
        openalex_id: A5049349154
        arxiv_name: "Abbeel, Pieter"
```

校验规则（`groups.py` 启动即检查）：group id 与 member id 全局唯一；每个组至少要有**一个作者源 ID 或一个 feed**，否则抓不到任何东西直接报错。

### 怎么填作者 ID 才靠得住

- `openalex_id` / `s2_id` 是稳定 ID，优先用。本仓库里的每个 ID 都是**从该人确实署名的论文反查**得到的，而不是按姓名搜索取第一个结果 —— OpenAlex 上中文姓名重名与合档非常严重（如 "Yu Qiao" / "Jie Tang" 按名搜索的首位都不是目标本人）。
- `arxiv_name` 只能按姓名检索，重名风险高，只对**姓名足够独特**的人启用。`He Wang`、`Wenhai Wang` 这类就故意留空，只靠 OpenAlex 跟踪。
- `s2_id` 目前全部留空（OpenAlex + arXiv 已够用），需要时按同样方式补。

### 国内大厂怎么跟

国内大厂普遍没有官方 RSS，但技术报告会以**机构作者**署名投 arXiv，因此这些组主要靠 `arxiv_name` 跟踪，已逐个用 arXiv API 验证过命中：

`DeepSeek-AI`、`Qwen Team`、`Kimi Team`、`ByteDance Seed`、`MiniMax`、`StepFun`、`GLM-V Team`。

### 博客只接稳定 RSS

不写 HTML 爬虫。加组前先用 `--only blogs --dry-run` 验证 feed 能解析出条目。已知情况：

- 可用且更新活跃：OpenAI News、Google DeepMind / Google Research（走 `blog.google` 分类源）、Microsoft Research、BAIR Blog、MIT News · AI、ML@CMU。
- **没有**官方 feed，因此只跟论文：Anthropic、DeepSeek、智谱、月之暗面、字节 Seed、MiniMax、阶跃星辰、上海 AI Lab、清华 AIR、北大。
- 官方 feed 存在但已停更/更新很慢：Qwen Blog、MSRA。保留配置，恢复更新即可自动收录。
- 注意 OpenAI News 数量大且含不少商业/政策类内容，用首页「类型 / 组」筛选或搜索来收敛。

## 本地运行

```bash
pip install -r fetcher/requirements.txt
cp .env.example .env          # 选填 S2_API_KEY / OPENALEX_MAILTO

# 只验证博客源（最快，不打论文 API）
python fetcher/run_daily.py --days 30 --only blogs --dry-run

# 只验证论文源
python fetcher/run_daily.py --days 7 --only papers --dry-run

# 全量 dry-run（不写文件）
python fetcher/run_daily.py --days 7 --dry-run

# 正式运行，写 data/
python fetcher/run_daily.py --days 7

# 本地预览网站
cd web && npm install && npm run dev
# 或静态构建：NEXT_PUBLIC_BASE_PATH= npm run build && npx serve out
```

`npm run dev` 会读取上一级 `data/` 的 JSON；没有数据时页面显示占位提示。

## 数据源的时效性差异

同一天的抓取里，各源的新鲜度差别很大，属正常现象：

- **arXiv**：实时，当天提交当天可见 —— 论文时间线的主力。
- **官方 RSS**：实时。
- **OpenAlex**：索引有明显滞后（常达数周到数月），且很多条目的 `publication_date` 被规整到月初。因此 7 天窗口里 OpenAlex 常常一条都不返回，等它补录后才会出现。这也是为什么只靠 OpenAlex 跟踪的组（如北大、上海 AI Lab）看起来更新更慢。

## 部署

推到 GitHub 后，`.github/workflows/daily-fetch.yml` 每日 UTC 00:17 自动抓取并部署到 GitHub Pages。

1. 仓库 Settings → Pages → Source 选 **GitHub Actions**。
2. 可选 Secrets / Variables：
   - `S2_API_KEY`（secret，可选）：提高 Semantic Scholar 速率。
   - `OPENALEX_MAILTO`（variable，可选）：礼貌联系邮箱。
3. Actions → `Daily fetch & deploy` → Run workflow 手动跑一次。

若部署在 `https://<user>.github.io/<repo>/`（项目站），workflow 会自动设置 `basePath=/<repo>`。

## 验证清单

- [ ] `python fetcher/run_daily.py --days 30 --only blogs --dry-run` 各 feed 有命中且无解析报错。
- [ ] `python fetcher/run_daily.py --days 7 --only papers --dry-run` 无源级异常（某位作者 0 篇是正常的）。
- [ ] `python fetcher/run_daily.py --days 7` 生成 `data/works/works-YYYY-MM-DD.json` 与 `data/groups.json`。
- [ ] `cd web && NEXT_PUBLIC_BASE_PATH= npm run build` 生成 `web/out/index.html`、`web/out/groups/index.html` 且无报错。

## 故障排查

- **某个组一直没内容**：先看它是「只有 feed」还是「只有作者 ID」。只有作者 ID 且只填了 `openalex_id` 的组，受 OpenAlex 滞后影响会慢很多（见上文时效性说明）。
- **某个 feed 报解析失败**：`rss.py` 会打印具体异常并跳过该 feed，不影响其他源。多半是官网改了 feed 路径，用浏览器确认新地址后改 `groups.yaml`。
- **`groups.yaml` 报 GroupConfigError**：按提示修 —— 重复 id，或某个组既没作者源 ID 也没 feed。
- **Pages 404 / 样式丢失**：通常是 basePath 不对。项目站必须是 `<user>.github.io/<repo>/`；本地可用 `NEXT_PUBLIC_BASE_PATH=/<repo> npm run build` 复现。
- **论文详情页 404**：静态站只预渲染已存在的 id；新论文需等下一次构建。博客没有详情页，卡片直接跳原文。
