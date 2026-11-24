## Agent skills

### Issue tracker

问题和需求使用 GitHub Issues 跟踪；操作前阅读 `docs/agents/issue-tracker.md`。

### Triage labels

分诊时使用项目的五种默认标签；参阅 `docs/agents/triage-labels.md`。

### Domain docs

领域文档采用单上下文布局；探索代码或处理领域术语时阅读 `docs/agents/domain.md`。

### Database migrations

修改 Prisma schema、数据库结构或排查 seed 与 schema 不一致时，使用 `.agents/skills/database-migrations/SKILL.md`。

### 技术约定

实现前先读 `docs/adr/`；与 ADR 冲突时，明确指出是哪一篇并说明重新讨论的理由。

- 读数据：Server Component 直查 Prisma，查询用 `use cache` 包裹；`searchParams`、`locale` 等 request-time 值在缓存作用域外取出后作为参数传入。
- 写数据：只用 Server Actions，不用它取数（客户端串行执行）。
- 不引入 GraphQL、tRPC 或 REST 取数层（ADR 0004）。
- Prisma 钉在 7：better-auth 的 adapter 不支持 Prisma 8（ADR 0005）。
- `@react-three/fiber` 的 peer 是 `react >=19 <19.4`，升 React 前先确认 fiber 跟上。
- 界面文案走 `next-intl`；内容不翻译，保留正文语言（ADR 0001、0006）。
- 新增页面时按 `README.md` 的目录约定决定组件落位。
