---
name: database-migrations
description: 修改 Prisma schema 中的 model、字段、关系或 enum，或排查迁移与 seed 失败时使用。
---

# 数据库迁移

本项目使用 Prisma 7 和 PostgreSQL。开发库也可能有需保留的数据；不要默认重置数据库。

## 流程

1. 确认 `DATABASE_URL` 指向的环境，并检查 `prisma/schema.prisma`、`prisma/seed.ts` 及受影响的代码。
2. 修改 schema。新增必填字段或约束时，为已有记录设计默认值或数据回填；重命名、删除字段时确认数据处理方式。
3. 创建待审查迁移：

   ```bash
   pnpm exec prisma migrate dev --create-only --name <描述>
   ```

   检查新生成的 `prisma/migrations/*/migration.sql`，再运行 `pnpm db:migrate` 应用。随后运行 `pnpm db:generate`。
4. 同步 `prisma/seed.ts`：更新受影响模型的 `create` 和 `update` 数据，为新增必填字段提供值；按需加入新模型或 enum 的 seed 数据。保持 seed 可重复运行。
5. 在确认目标库适合写入 seed 后，运行 `pnpm db:seed` 和 `pnpm exec tsc --noEmit`。项目没有独立的 `typecheck` script。

## 环境边界

- 生产环境使用 `pnpm db:migrate:deploy`；迁移前备份并遵循 [`docs/operations.md`](../../../docs/operations.md) 中的发布约定。
- `pnpm db:seed` 会写入 `DATABASE_URL` 指向的数据库。执行前核对目标环境。
- 只有确认目标是可丢弃的本地开发库后，才使用 `pnpm exec prisma migrate reset`；它会删除库内数据并重新应用迁移、运行 seed。不要删除 PostgreSQL 数据卷来排查普通迁移或 seed 错误。
