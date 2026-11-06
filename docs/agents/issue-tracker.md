# 问题跟踪：GitHub

本仓库的问题和需求存放在 GitHub Issues 中，使用 `gh` 操作。

## 常用操作

- 创建问题：`gh issue create --title "..." --body "..."`。多行正文使用临时文件和 `--body-file`。
- 查看问题：`gh issue view <number> --json number,title,body,labels,comments`。
- 列出问题：使用 `gh issue list`，按需指定 `--label` 和 `--state`。
- 添加或移除标签：`gh issue edit <number> --add-label "..."` 或 `--remove-label "..."`。
- 评论：`gh issue comment <number> --body "..."`。
- 关闭：先发表评论说明原因，再运行 `gh issue close <number>`。

在仓库内执行时，`gh` 从 Git 远程地址推断仓库。每次会话首次创建问题前，使用 `gh repo view --json nameWithOwner` 确认目标；如果不是用户的仓库，先向用户确认。

## 子问题和依赖

- 子问题：使用 `gh issue create --parent <parent> ...` 或 `gh issue edit <parent> --add-sub-issue <child>`（需要 `gh` 2.94 及以上）。旧版本可通过 GitHub API 的 `sub_issues` 端点添加；不可用时在子问题正文顶部写 `Part of #<parent>`。
- 阻塞关系：优先使用 GitHub 原生问题依赖，通过 `gh issue create --blocked-by <n>,<n> ...` 或 `gh issue edit <child> --add-blocked-by <blocker>` 添加（需要 `gh` 2.94 及以上）。旧版本可通过 `dependencies/blocked_by` API 添加，使用阻塞问题的数据库 ID；不可用时在正文顶部写 `Blocked by: #<n>, #<n>`。所有阻塞问题关闭后，该问题才解除阻塞。
- 查询未关闭的阻塞项：`gh api repos/{owner}/{repo}/issues/<n> --jq .issue_dependencies_summary.blocked_by`；结果为 0 表示没有未关闭的阻塞项。

## 拉取请求分诊

**PRs as a request surface: no.**

将此值改为 `yes` 后，`triage` 使用 `gh pr` 查看、评论、标记和关闭外部拉取请求，并按问题的标签和状态处理。问题和拉取请求共用编号；需要区分时先运行 `gh pr view <number>`，失败后运行 `gh issue view <number>`。

## 技能操作

- “发布到问题跟踪器”：创建 GitHub issue。
- “获取相关工单”：按上述查看问题的方式读取。

## Wayfinder 操作

- 地图：一个带 `wayfinder:map` 标签的问题，保存笔记、已有决定和待澄清内容。
- 子工单：链接到地图的 GitHub 子问题，使用 `wayfinder:<type>` 标签，其中类型为 `research`、`prototype`、`grilling` 或 `task`。若子问题不可用，在地图正文中列出任务，并在子问题顶部写 `Part of #<map>`。
- 查找可处理工单：按地图顺序查找开放、无未关闭阻塞项且未分配的子工单。
- 认领：开始工作前运行 `gh issue edit <n> --add-assignee @me`。
- 完成：评论记录答案，关闭工单，再将摘要和链接补充到地图的已有决定中。
