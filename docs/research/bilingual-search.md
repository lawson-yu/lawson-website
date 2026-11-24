# 中英文关键词搜索匹配验证

- 对应问题：[lawson-yu/lawson-website#5](https://github.com/lawson-yu/lawson-website/issues/5)（标签 `wayfinder:research`）
- 结论一句话：用「写入时归一化出一列纯文本 + PostgreSQL `ILIKE '%…%'`」即可满足需求共识第 4 节的全部规则，不需要额外服务；中文分词类全文检索与外挂搜索引擎都不满足「连续词组匹配」这条硬要求，或在运维上更重。
- 标记约定：**【文档】**= 官方文档/一手仓库明确写出的内容，附链接；**【实测】**= 本机 `postgres:18-alpine`（PostgreSQL 18.6）实际跑出来的结果，命令见附录；**【推断】**= 我基于前两者的判断，没有直接来源。

## 0. 前置资料缺失（必须先说明）

任务要求先读 `docs/requirements-consensus.md` 第 4 节与 `docs/prd-v0.1.md` 第 3.3 节。**这两份文件在仓库的任何分支上都不存在**【实测】：

- `docs/` 下只有 `operations.md`、`agents/{domain,issue-tracker,triage-labels}.md`；
- `git log --all --diff-filter=AMD -- docs/requirements-consensus.md docs/prd-v0.1.md` 无输出，`origin` 只有 `main` 一个分支；
- 仓库里也没有 `docs/adr/`（issue #13 提到的 ADR 0001 同样不在仓库中）。

因此本文的需求基线来自两处：issue #5 的正文，以及任务书转述的「第 4 节」条目。**如果原文还有更细的规则（标点、多词、摘要来源），本文结论需复核**，详见第 5 节。

把已知条目拆成可验证的判据：

| 编号 | 判据 |
| --- | --- |
| R1 | 关键词覆盖标题、摘要、正文 |
| R2 | 代码块内容可命中 |
| R3 | 链接的可见文字可命中 |
| R4 | 忽略 Markdown 格式符号与链接目标地址（URL 本身不参与匹配） |
| R5 | 中文连续词组匹配 |
| R6 | 英文忽略大小写 |
| R7 | 可与一个标签叠加筛选 |
| R8 | 按首次发布时间倒序，每页 10 篇 |
| R9 | 中英文界面共用同一份内容、同一套索引，不按语言分开索引 |
| R10 | 首版不要语义搜索、同义词、拼写纠错 |

关于 R5，本文采用一个明确的解释（假设 A1）：**查询串必须作为连续子串出现在正文中**，例如查「数据库索引」时，「数据库索引优化」命中；「数据库…索引」中间夹了别的字则不命中。这不是「分词后各自出现即可」。这个解释决定了后面所有路线的取舍；若站长的本意是后者，路线 A 才重新变得可行。

## 1. 先确定的事实基础：PostgreSQL 内置解析器怎么处理中文

**【实测】** `ts_debug('simple', '使用 PostgreSQL 数据库索引优化查询')` 的 token 序列：

```
word=使用 | blank=  | asciiword=PostgreSQL | blank=  | word=数据库索引优化查询
```

**【实测】** 对应 tsvector 只有一个中文词条：`'postgresql':2 '使用':1 '数据库索引优化查询':3`。于是：

```
to_tsvector(...) @@ plainto_tsquery('simple','数据库')      → false
to_tsvector(...) @@ plainto_tsquery('simple','数据库索引')  → false
to_tsvector(...) @@ plainto_tsquery('simple','索引优化查询') → false
```

原因可以回到文档：内置解析器只做「识别合理词边界」，`word` 类型是「全部字母组成的词」，而「字母」由数据库 `lc_ctype` 决定**【文档：[12.5. Parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html)】**。中文在 UTF-8 locale 下都是字母，中间又没有空格，所以一整串连续汉字被切成一个 token**【推断，但已被上面的实测证实】**。

**这条事实是本议题的分水岭**：Postgres 原生全文检索对中文只能整段匹配，不做中文分词就基本不可用。

另外，全文检索的匹配单位是「词条」，不是「子串」**【文档：[8.11. Text Search Types](https://www.postgresql.org/docs/18/datatype-textsearch.html)】**。连英文都会踩到：**【实测】** `to_tsvector('english','PostgreSQL Database') @@ plainto_tsquery('english','postgres')` → `false`（`postgres` 被词干化成 `postgr`，而 `postgresql` 词干化成 `postgresql`）。也就是说，即使用户输入的是文章里出现的词，词干化也会造成漏命中。

## 2. 四条路线的实际行为

### 路线 A：PostgreSQL 全文检索（tsvector + GIN）

| 项目 | 行为 |
| --- | --- |
| 中文连续词组 | **不满足**。需要中文分词器把 token 切开，否则整段汉字一个 token（见第 1 节实测）。 |
| 英文大小写 | 满足。`to_tsvector('simple',…)` 已把 `PostgreSQL` 存成小写 `postgresql`**【实测】**；词典负责归一化。 |
| 代码块 / Markdown | 与路线无关：引擎不会剥 Markdown，必须在写入前生成纯文本。 |
| 排序与分页 | SQL 里 `ORDER BY first_published_at DESC, id DESC LIMIT 10 OFFSET n`，`LIMIT/OFFSET` 语义见**【文档：[7.6. LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)】**。 |
| 运维成本 | 零新增服务（`tsvector` 列 + GIN 索引）。**但**要真正支持中文就得装第三方分词扩展。 |
| 明确不满足 | R5（连续词组）；R10 反向：全文检索自带词干化/停用词，属于首版明确不要的「变形匹配」（`postgres` 命中不了 `PostgreSQL`，反过来 `running` 会命中 `run`）。 |

若要中文可用，必须叠加分词扩展，两条现实选择：

- **zhparser**（SCWS 词典）：仓库 README 说明支持 PostgreSQL 9.2+，但仓库内预构建 Dockerfile 只有 `alpine/16`、`bookworm/16`、`bullseye/15`，官方镜像 tag 形如 `zhparser/zhparser:bookworm-16`**【文档：[amutu/zhparser](https://github.com/amutu/zhparser)】**。当前 `compose*.yaml` 用的是 `postgres:18-alpine`，因此要**自建镜像**：先编译 SCWS 再编译扩展。
- **pg_jieba**：README 的测试版本是 PostgreSQL 9.6.3 / 11.1，需要 cmake + git submodule 编译**【文档：[jaiminpan/pg_jieba](https://github.com/jaiminpan/pg_jieba)】**。对 PG 18 的支持没有任何官方声明。

即使装好了分词器，R5 仍不等于满足：分词是「词表对齐」问题。`<->`（FOLLOWED BY）只保证两个**词条**在位置上相邻**【文档：[9.13. Text Search Functions and Operators](https://www.postgresql.org/docs/18/functions-textsearch.html)】**，**【实测】** `'alpha beta gamma' @@ to_tsquery('simple','alpha <-> beta')` → true，`'alpha x beta gamma'` → false。但中文分词结果与查询分词结果不一致时（如正文切成「数据/库索引」，查询切成「数据库/索引」），相邻性也救不回来；而且要把用户输入的连续中文切成词，还得在应用层再跑一次同一分词器。

### 路线 B：pg_trgm + ILIKE（三字窗口索引）

事实：trigram 是「三个连续字符」，`pg_trgm` 忽略非字母数字字符，每个词视为前置两个空格、后置一个空格；GIN/GiST 索引支持 `LIKE`、`ILIKE`、`~`、`~*`，且「模式里抽不出 trigram 时会退化为全索引扫描」**【文档：[F.35. pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html)】**。

**【实测】** 20000 行表 + `GIN (body gin_trgm_ops)`，匹配行只有 1 行：

```
body ILIKE '%索引%'        → Bitmap Index Scan 返回 20001 个候选，Rows Removed by Index Recheck: 20000，9.1ms，343 buffers
body ILIKE '%数据库索引%'  → 候选 1 行，0.02ms，8 buffers
```

也就是说：**2 字中文查询拿不到任何索引收益（退化为全索引扫描），3 字以上才是真正的三字窗口定位**；两者结果都正确（recheck 兜底，与顺序扫描计数一致）**【实测】**。1 字同理无收益（实测 `%索%` 也是全索引扫描）。

| 项目 | 行为 |
| --- | --- |
| 中文连续词组 | 满足（子串语义，`ILIKE` 直接给到）。索引加速仅对 ≥3 字有效。 |
| 英文大小写 | 满足。**【文档】** `ILIKE` 按当前 locale 做大小写不敏感匹配；**【实测】** `'PostgreSQL' ILIKE '%postgres%'` → true。 |
| 代码块 / Markdown | 同路线 A：必须应用层归一化。trigram 忽略非字母数字，意味着归一化后残留的标点不影响命中，但**标点是否要挡住子串匹配，是归一化层的决定，不是 pg_trgm 的决定**。 |
| 排序与分页 | 纯 SQL，同路线 A。 |
| 运维成本 | 零新增服务；`CREATE EXTENSION pg_trgm` 一行迁移。**【实测】** 官方 `postgres:18-alpine` 镜像自带该扩展（`pg_available_extensions` 可查到，`CREATE EXTENSION` 成功），不需要自建镜像。 |
| 明确不满足 | 严格说没有不满足项；只是 1–2 字中文查询在文章量变大后仍是顺序扫描。 |

补充：`pg_trgm` 索引要生效，被索引的必须是查询里出现的那个列/表达式；如果归一化文本存在普通列里，索引与 `ILIKE` 都直接落在这列上，没有额外机关。

### 路线 C：归一化文本列 + ILIKE（先不加索引）

与 B 的匹配语义完全相同，区别只是暂时不建 trigram 索引，全表顺序扫描。

| 项目 | 行为 |
| --- | --- |
| 中文连续词组 | 满足，任意长度（含 1 字）。 |
| 英文大小写 | 满足（`ILIKE`）。 |
| 代码块 / Markdown | 归一化层是唯一工作点：写入时把 Markdown 渲染成纯文本，代码块保留代码内容、丢掉围栏与反引号；链接保留可见文字、丢掉目标 URL。 |
| 排序与分页 | `ORDER BY first_published_at DESC, id DESC LIMIT 10 OFFSET n`。注意**【文档】**：`LIMIT` 必须配唯一顺序，否则分页会取到不稳定的子集；`OFFSET` 跳过的行仍要在服务器内计算。 |
| 运维成本 | 零。不装扩展、不加容器、不改基础镜像。 |
| 明确不满足 | 无功能缺口；代价是 O(文章数) 扫描。按 20k 行、单列文本的实测口径（全索引扫描 9ms）估算，单人博客几千篇文章量级是毫秒到几十毫秒**【推断】**。 |

### 路线 D：外挂搜索引擎（Meilisearch / Typesense / SQLite FTS5）

三者的共同点是「另建一份索引」，因此都引入第二个存储与同步问题。

**Meilisearch**

- 中文：Charabia 分词器对 Chinese (CMN) 用 jieba 词典分词**【文档：[Language](https://www.meilisearch.com/docs/resources/help/language)】**。
- 匹配语义是 token 匹配 + 前缀搜索，不是子串；短语要用双引号，且「只匹配包含该确切词序列的文档」**【文档：[Search API](https://www.meilisearch.com/docs/reference/api/search)】**。词序列 ≠ 连续字符，分词边界不同就漏。
- 拼写纠错**默认开启**，必须显式关闭**【文档：[Typo tolerance](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings)】**。
- `matchingStrategy` 默认 `last`：结果不够时会逐个丢掉查询词**【文档：Search API】**——这与「关键词搜索」的直觉相反，必须改成 `all`。
- 默认最多返回 1000 条（`pagination.maxTotalHits`）**【文档：Search API】**。
- 运维：多一个容器 + 数据卷 + master key + 索引同步 + dump 备份 + 版本升级**【文档：[Using Meilisearch with Docker](https://www.meilisearch.com/docs/resources/self_hosting/getting_started/docker)】**。**推断**：单人维护下这是最容易被忽略的长期成本——文章每次增删改都要同步，漏同步就是「搜不到刚发的文章」。

**Typesense**

- 中文：字段级 `locale: zh`，走 ICU，文档称「Chinese: character-based segmentation and variant handling」**【文档：[Tips for Locale-Specific Search](https://typesense.org/docs/guide/locale.html)】**。
- `num_typos` 默认 `2`（Damerau–Levenshtein），必须设 0 才符合 R10**【文档：[Search API](https://typesense.org/docs/30.2/api/search.html)】**。
- `per_page` 默认 10，与 R8 的每页数量一致**【文档：同上示例响应】**；排序用 `sort_by`。
- 运维：官方 Docker 镜像 + 数据目录 + API key**【文档：[Install Typesense](https://typesense.org/docs/guide/install-typesense.html)】**，成本结构与 Meilisearch 同类。

**SQLite FTS5**

- 默认 `unicode61` 分词器把「一段连续的 token 字符」当一个 token，且默认 token 类别是 `L* N* Co`**【文档：[FTS5](https://sqlite.org/fts5.html)】**→ 连续中文又是整段一个 token，中文词组搜不到（与第 1 节同病）。
- `trigram` 分词器能做子串匹配，但文档写明：**「少于 3 个 unicode 字符的子串在全文查询中不匹配任何行」**【文档：同上】**。2 字中文查询直接返回空——这不是性能问题，是正确性问题。
- 结论：**FTS5 直接出局**，而且它还要在 Postgres 之外再维护一个库文件。

### 对比表

| 判据 | A 全文检索（内置） | A′ 全文检索 + 中文分词 | B pg_trgm + ILIKE | C 归一化 + ILIKE | D 外挂引擎 | FTS5 trigram |
| --- | --- | --- | --- | --- | --- | --- |
| R1 标题/摘要/正文 | 需拼多列 tsvector | 同左 | 满足 | 满足 | 满足 | 满足 |
| R2 代码块命中 | 满足（归一化后） | 满足 | 满足 | 满足 | 满足 | 满足 |
| R3 链接文字命中 | 满足 | 满足 | 满足 | 满足 | 满足 | 满足 |
| R4 忽略 URL / Markdown | 应用层做 | 应用层做 | 应用层做 | 应用层做 | 应用层做 | 应用层做 |
| R5 中文连续词组 | **不满足** | 依赖分词对齐，可能漏 | 满足 | 满足 | 分词/词序列语义，可能漏 | **1–2 字不满足** |
| R6 英文忽略大小写 | 满足 | 满足 | 满足 | 满足 | 满足（需关纠错） | 满足 |
| R7 单标签筛选 | SQL | SQL | SQL | SQL | filter，需把标签设为 filterable | SQL |
| R8 倒序 + 每页 10 | SQL | SQL | SQL | SQL | sort/分页，有 1000 条上限（Meili） | SQL |
| R9 共用一份索引 | 满足 | 满足 | 满足 | 满足 | 需同一 collection 存双语 | 满足 |
| R10 不要纠错/同义词 | 反向：词干化 | 反向：词干化 | 满足 | 满足 | **默认开启，需显式关闭** | 满足 |
| 额外常驻服务 | 无 | 无（但要自建镜像） | 无 | 无 | **有** | 有（另一份索引库） |
| 主要风险 | 中文不可用 | PG 18 无预构建镜像；分词不一致漏命中 | 2 字查询无索引收益 | 大表全扫描 | 同步与运维 | 正确性缺陷 |

## 3. 推荐：路线 C 起步，路线 B 作为可选加速

**推荐 C（归一化纯文本列 + `ILIKE`），必要时再叠加 B 的 trigram 索引。**理由：

1. **需求本质是子串匹配，不是词匹配。** R5 说的是「连续词组」，`ILIKE '%…%'` 是唯一与之一一对应的语义；A/A′/D 都是词条语义，要靠分词或短语语法去逼近，而中文分词不一致是长期存在的漏命中来源（第 1 节、路线 A 的实测与文档）。
2. **归一化层是四条路线都躲不掉的共同成本。** R2/R3/R4 没有任何引擎会替你做：代码块保留内容、链接保留文字、丢掉 URL 与格式符号，全部发生在写入时。既然这一层无论如何都要写，那么「多出来的只有匹配器」——`ILIKE` 是最小的匹配器。
3. **R7/R8 是纯 SQL 需求。** 标签筛选、按首次发布时间倒序、每页 10 篇，在 Postgres 里是三行子句；用外挂引擎则要额外维护 filterable/sortable 属性、`maxTotalHits`、以及「数据库是真相、索引是副本」的同步纪律。
4. **运维最轻。** 不加容器、不加数据卷、不加第二份备份、不锁死基础镜像版本（zhparser 的预构建镜像只到 PG 16，pg_jieba 只测到 PG 11，都会把 `postgres:18-alpine` 换成自建镜像）。对单人维护者，这比几毫秒的查询延迟重要。
5. **量级不需要索引。** 单人技术博客的文章总量以百/千计，归一化文本列的顺序扫描在毫秒级；`pg_trgm` 官方镜像自带，等真慢了再一行迁移加上，且**加了也不影响正确性**（recheck 兜底）。

推荐的落地边界（供后续实现 ticket 使用，本文不含代码）：

- 新增 `search_text` 一类归一化列（标题 + 摘要 + 正文纯文本），写入/更新时由应用生成，数据库侧只读；
- 查询：`WHERE search_text ILIKE '%' || escaped || '%' AND (tag 条件)`，`ORDER BY first_published_at DESC, id DESC LIMIT 10 OFFSET n`；
- 首次发布时间需要独立字段（不能复用 `updatedAt`，否则改一次文章就跳到列表最前，违反 R8）；
- 用户输入里的 `%` 和 `_` 必须转义，否则 `%` 会变成通配符**【文档：[9.7. Pattern Matching](https://www.postgresql.org/docs/18/functions-matching.html)】**（`ILIKE` 支持 `ESCAPE`）；
- Prisma 侧：Postgres 的大小写不敏感过滤由 `mode: 'insensitive'` 提供**【文档：[Filtering and sorting (v7)](https://www.prisma.io/docs/orm/v7/prisma-client/queries/filtering-and-sorting)、[Case sensitivity](https://www.prisma.io/docs/orm/v6/prisma-client/queries/case-sensitivity)】**；`ILIKE` 也可用 `$queryRaw` 直接写，避免依赖预览特性。**顺带记录一个版本事实**：Prisma 7 的 Postgres 全文检索需要 `fullTextSearchPostgres` 预览特性**【文档：[Full-text search (v7)](https://www.prisma.io/docs/orm/v7/prisma-client/queries/full-text-search)】**，而全文检索在 Prisma 8 才 GA（`fullTextMatches` / `@@fullTextIndex`）**【文档：[Prisma changelog 2026-10-02](https://www.prisma.io/changelog/2026-10-02)】**——这是又一条不选 A 的理由：要么开预览特性，要么等大版本升级。
- 建索引这类 Prisma schema 表达不了的东西，走手工编辑迁移 SQL 的方式**【文档：[Customizing migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/customizing-migrations)】**。

## 4. 验证样本设计（给后续动手验证的清单）

载体建议：仓库已有 `tests/database.integration.mjs`（`pnpm test:integration`，自建临时 PostgreSQL 并清理），把样本与断言放进去即可，不需要碰生产库。

### 4.1 文章样本（10 篇内容样本 + 6 篇分页填充，共 16 篇）

| 编号 | 语言 | 标题 | 摘要 | 正文要点 | 标签 | 首次发布 | 覆盖判据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | 中 | PostgreSQL 索引调优笔记 | 中文摘要，含「数据库索引」 | 正文含「数据库索引优化」连续词组 | Postgres, 性能 | 2026-01-05 | R1 R5 |
| S2 | 英 | Debugging PostgreSQL Lock Contention | 英文摘要 | 正文含 `PostgreSQL`、`Index Scan`、小写 `postgres` | Postgres | 2026-01-12 | R1 R6 |
| S3 | 中英混排 | 用 EXPLAIN 读查询计划 | 中英混排摘要 | 正文「把 EXPLAIN ANALYZE 的输出与 pg_stat_statements 对照」 | Postgres | 2026-01-19 | R1 R6 |
| S4 | 中 | pg_trgm 踩坑记录 | 摘要**不含**代码里的词 | 代码块：`CREATE INDEX CONCURRENTLY idx ON posts USING GIN (search_text gin_trgm_ops);`、`seqScanHelper()` | Postgres | 2026-01-26 | R2 |
| S5 | 中 | 三字窗口与中文检索 | 摘要不含「三字窗口」 | 链接 `[PostgreSQL 官方文档](https://example.com/hidden-target-abc)`；另有一段裸 URL 文本 `https://bare-url-should-not-match.example/x` | 检索 | 2026-02-02 | R3 R4 |
| S6 | 中 | 中文标点与归一化 | 中文摘要 | 正文含「索引，优化」「A（B）」「——」 | 检索 | 2026-02-09 | R4 R5（标点边界） |
| S7 | 英 | Kubernetes Networking Basics | 英文摘要 | 正文小写 `kubernetes` 多次 | 基础设施 | 2026-02-16 | R6 R10 |
| S8 | 中 | Docker Compose 部署清单 | 中文摘要 | 「docker compose」与「Docker Compose」混排 | 基础设施, 部署 | 2026-02-23 | R6 R9 |
| S9 | 中 | 草稿：未发布的搜索实验 | 中文摘要 | 含「数据库索引」 | 检索 | **无（草稿）** | 安全边界 |
| S10 | 中 | 索引优化的十个小技巧 | 摘要**不含**「数据库索引」 | 正文含「数据库索引」，与 S1 **同一天**发布 | Postgres, 性能 | 2026-01-05 | R1 R8（排序并列） |
| P1–P10 | 中 | 分页填充 1–10 | 短摘要 | 正文各含一次「数据库索引」 | Postgres | 2025-12-01 起逐日 | R8（分页） |

设计意图：S1 + S10 + P1–P10 共 12 篇能被「数据库索引」命中，正好验证「第 1 页 10 篇 + 第 2 页 2 篇」。总样本 20 篇（S1–S10 含 1 篇草稿，加 P1–P10），规模控制在一次测试运行内，结果可人工逐条核对。

### 4.2 查询与期望

| 查询 | 期望 | 证明什么 |
| --- | --- | --- |
| Q1 `数据库索引` | 命中 S1 S10 P1–P10（共 12 篇） | R5 连续词组；不因分词失败 |
| Q2 `索引优化` | 命中 S1 S10 | R5，跨词边界 |
| Q3 `索引，优化` | 期望「不命中 S1」 | 标点是否参与匹配——**待产品决策**，见 5.1 |
| Q4 `数据库 索引`（空格） | 期望「按空白切分 AND 命中」 | 多词语义——**待产品决策**，见 5.2 |
| Q5 `postgres` | 命中 S2 S3 S4 | R6，且是子串命中 `PostgreSQL`（全文检索会漏，见第 1 节） |
| Q6 `POSTGRESQL` | 命中 S2 S3 S4 | R6 全大写 |
| Q7 `postgresql 索引` | 命中 S1（若按 Q4 的 AND 语义） | 中英混排 |
| Q8 `CREATE INDEX CONCURRENTLY` | 命中 S4 | R2 代码块 |
| Q9 `seqScanHelper` | 命中 S4 | R2 代码块 + 大小写 |
| Q10 `gin_trgm_ops` | 命中 S4 | R2 + 下划线/符号处理 |
| Q11 `三字窗口` | 命中 S5 | R3 链接可见文字 |
| Q12 `hidden-target-abc` | **不命中**任何文章 | R4 链接目标不参与 |
| Q13 `example.com` | **不命中**任何文章 | R4 URL 不参与 |
| Q14 `bare-url-should-not-match` | 期望「不命中」 | R4 的灰区：正文裸 URL 是否算「链接目标地址」——见 5.3 |
| Q15 `kubernetes` / `KUBERNETES` | 命中 S7 | R6 |
| Q16 `kubernete` | **不命中** | R10 无拼写纠错 |
| Q17 `数据库索引` + 标签 `Postgres` | 命中集合为 Q1 与标签交集 | R7 |
| Q18 `数据库索引` + 标签 `前端` | 空结果 | R7 无匹配标签时的空状态 |
| Q19 `数据库索引` 第 1 页 | 10 篇；第 2 页 2 篇；整体按首次发布时间倒序，同日（S1/S10）用第二排序键稳定 | R8 |
| Q20 更新 S1 正文后重查 Q19 | S1 位置不变 | R8「首次发布时间」而非更新时间 |
| Q21 查询草稿关键词 | **不命中** S9 | 未发布内容不进索引 |
| Q22 `索`（单字） | 命中 S1 S10 P* | 记录 1 字查询行为与性能边界（pg_trgm 无法加速） |
| Q23 `数据库索引` 在中文界面与英文界面各执行一次 | 结果集完全一致 | R9 共用同一索引与行为 |

### 4.3 还要记录的度量

- 每条查询的返回条数与顺序（用于固定期望值）；
- 归一化后的 `search_text` 快照（确认 URL 真的没进文本、代码块内容真的进了文本）；
- 查询耗时（用于判断何时值得加 trigram 索引）；数据量分别按 20 篇 / 500 篇 / 5000 篇三档各跑一次 Q1 与 Q22。

## 5. 不确定项

### 5.1 标点是否参与匹配（影响 R4 的边界）

要求只写「忽略 Markdown 格式符号」，没写中文标点。若归一化保留标点，查「索引优化」不会命中正文「索引，优化」；若归一化删掉全部标点，则「A（B）」会变成「AB」，可能产生用户意料之外的命中。**这是产品决策，不是技术限制**，建议在实现前定一条规则并写进样本 Q3。

### 5.2 多词查询语义

单个输入框里输入「数据库 索引」时：整串子串匹配（几乎必然不命中）还是按空白切分后 AND？要求没有说。我倾向「按空白切分 AND」，但这属于新增规则，需要确认。样本 Q4/Q7 就是为这条准备的。

### 5.3 代码块里的 URL 与正文裸 URL

要求说「链接目标地址」不参与匹配。正文里直接写出的裸 URL（不是 Markdown 链接语法）算不算？代码块里的 URL 算不算？样本 Q14 暴露这个灰区。

### 5.4 摘要的来源

R1 要求覆盖摘要，但摘要可能是手写字段，也可能是自动截取正文首段。若是自动截取，`search_text` 里会出现重复文本，影响不大但需要知道；若是手写，必须显式拼进归一化文本。

### 5.5 规模未知

文章总量与单篇长度未知，这决定「顺序扫描够不够」与「何时加 trigram 索引」。本文的性能判断基于 20000 行小文本的实测，不是真实语料。

### 5.6 未验证的文档声明

- Prisma 7 的 `contains` + `mode: 'insensitive'` 是否真的生成 `ILIKE`：文档说 Postgres 支持大小写不敏感过滤，我没有抓取实际 SQL。
- zhparser / pg_jieba 能否在 PG 18 上编译通过：只核对了 README 的版本声明与预构建镜像目录，没有实测编译。
- `pg_trgm` 的 1–2 字退化在不同 PG 小版本上是否一致：只测了 18.6。
- `ILIKE` 的大小写折叠依赖数据库 locale；我只验证了 ASCII 与 `É` 两种情形，Alpine 镜像 initdb 的具体 locale 参数没有取到（`SHOW lc_ctype` 已不是 GUC）。

### 5.7 如果 Postgres 路线不可行，退路顺序

1. **同一张表上加 trigram 索引**（路线 B）：`CREATE EXTENSION pg_trgm` + `GIN (search_text gin_trgm_ops)`，官方镜像自带，不需要新服务。解决 ≥3 字查询的性能，1–2 字仍靠扫描。
2. **换 2-gram 索引**：`pg_bigm` 提供 bigram GIN 索引，文档明确「1–2 字关键词快」，且支持到 PostgreSQL 18/19**【文档：[pg_bigm](https://github.com/pgbigm/pg_bigm)，`docs/pg_bigm_en.md`】**。代价：**不是 contrib，必须自建镜像**；而且**只支持 `LIKE`，不支持 `ILIKE`**，英文大小写要靠 `lower()` 函数索引 + 查询侧 `lower()`。
3. **外挂 Meilisearch / Typesense**：只有在出现「相关性排序、跨字段权重、文章量到十万级」这类新需求时才值得。前提是接受第二个存储 + 同步纪律 + 关掉纠错（Meili `typoTolerance.enabled=false`、`matchingStrategy=all`；Typesense `num_typos=0`）+ 处理 Meili 的 1000 条上限。
4. **不建议**：SQLite FTS5（2 字中文正确性缺陷）与内置全文检索（中文整段 token）。

## 6. 来源

PostgreSQL 18 官方文档：

- [F.35. pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html) — trigram 定义、忽略非字母数字、GIN/GiST 支持 LIKE/ILIKE、无可用 trigram 时退化为全索引扫描
- [12.5. Parsers](https://www.postgresql.org/docs/18/textsearch-parsers.html) — 内置解析器 23 种 token 类型，`word` = 全部字母，字母由 `lc_ctype` 决定
- [8.11. Text Search Types](https://www.postgresql.org/docs/18/datatype-textsearch.html) — tsvector/tsquery、`<->` FOLLOWED BY、前缀匹配
- [9.13. Text Search Functions and Operators](https://www.postgresql.org/docs/18/functions-textsearch.html) — `to_tsquery` / `phraseto_tsquery` / `tsquery_phrase`
- [9.7. Pattern Matching](https://www.postgresql.org/docs/18/functions-matching.html) — `ILIKE` 按 locale 大小写不敏感、`ESCAPE`
- [7.6. LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) — 分页必须配唯一 `ORDER BY`

中文分词扩展：

- [amutu/zhparser](https://github.com/amutu/zhparser) — SCWS 词典，预构建镜像仅 PG 15/16
- [jaiminpan/pg_jieba](https://github.com/jaiminpan/pg_jieba) — 测试到 PG 11，需 cmake 编译
- [pgbigm/pg_bigm](https://github.com/pgbigm/pg_bigm)（文档：`docs/pg_bigm_en.md`）— 2-gram GIN、支持 PG 18/19、仅 LIKE

外挂搜索引擎与 FTS：

- [Meilisearch — Language](https://www.meilisearch.com/docs/resources/help/language) — Chinese 用 jieba 分词
- [Meilisearch — Typo tolerance](https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings) — 默认开启
- [Meilisearch — Search API](https://www.meilisearch.com/docs/reference/api/search) — 短语语义、`matchingStrategy` 默认 `last`、默认 1000 条上限
- [Meilisearch — Docker 自托管](https://www.meilisearch.com/docs/resources/self_hosting/getting_started/docker) — 容器 + 数据卷 + dump
- [Typesense — Locale](https://typesense.org/docs/guide/locale.html) — `locale: zh`、ICU
- [Typesense — Search API](https://typesense.org/docs/30.2/api/search.html) — `num_typos` 默认 2、`per_page` 默认 10
- [Typesense — Install](https://typesense.org/docs/guide/install-typesense.html) — Docker 镜像与数据目录
- [SQLite FTS5](https://sqlite.org/fts5.html) — unicode61 token 规则、trigram 分词器「<3 字符不匹配任何行」

Prisma：

- [Full-text search (v7)](https://www.prisma.io/docs/orm/v7/prisma-client/queries/full-text-search) — Postgres 需 `fullTextSearchPostgres` 预览特性
- [Filtering and sorting (v7)](https://www.prisma.io/docs/orm/v7/prisma-client/queries/filtering-and-sorting)、[Case sensitivity (v6)](https://www.prisma.io/docs/orm/v6/prisma-client/queries/case-sensitivity) — Postgres 大小写不敏感过滤
- [Customizing migrations](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/customizing-migrations) — 手工编辑迁移 SQL
- [Changelog 2026-10-02](https://www.prisma.io/changelog/2026-10-02) — 全文检索在 Prisma 8 GA

## 附录：实测环境与命令

环境：`postgres:18-alpine`（PostgreSQL 18.6, aarch64-unknown-linux-musl），一次性容器，未改动仓库、未安装任何依赖。

```bash
docker run --rm --name pgprobe -e POSTGRES_PASSWORD=probe -d postgres:18-alpine

# 1) 中文 token 化与全文检索命中
SELECT alias, token FROM ts_debug('simple','使用 PostgreSQL 数据库索引优化查询');
SELECT to_tsvector('simple','使用 PostgreSQL 数据库索引优化查询');
SELECT to_tsvector('simple','使用 PostgreSQL 数据库索引优化查询')
       @@ plainto_tsquery('simple','数据库');           -- false

# 2) 大小写与词干化
SELECT 'PostgreSQL' ILIKE '%postgres%';                  -- true
SELECT to_tsvector('english','PostgreSQL Database')
       @@ plainto_tsquery('english','postgres');         -- false（词干化）

# 3) 短语运算符
SELECT 'alpha beta gamma'::tsvector @@ to_tsquery('simple','alpha <-> beta');  -- true
SELECT 'alpha x beta gamma'::tsvector @@ to_tsquery('simple','alpha <-> beta'); -- false

# 4) pg_trgm 可用性与索引收益（20000 行 + GIN）
CREATE EXTENSION pg_trgm;
CREATE INDEX t_trgm ON t USING GIN (body gin_trgm_ops);
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT id FROM t WHERE body ILIKE '%索引%';
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT id FROM t WHERE body ILIKE '%数据库索引%';
```

实测结论汇总：连续汉字 = 单个 `word` token；`plainto_tsquery('数据库')` 全部 false；`ILIKE` ASCII 大小写不敏感；`pg_trgm` 在该镜像自带且 `CREATE EXTENSION` 成功；2 字中文查询退化为全索引扫描（20001 候选、Recheck 去掉 20000 行、9.1ms），5 字查询 1 候选、0.02ms；两者结果与顺序扫描一致。
