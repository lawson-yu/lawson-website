# Lawson 个人网站 Starter

基于 Next.js、Prisma/PostgreSQL 的个人网站全栈骨架。

## 本地启动

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

预置中英文演示文章和站内作品：`pnpm db:seed:demo`。此命令只补充不存在的演示 slug；日常 `pnpm db:seed` 仍只写基础 fixture。

## 目录导航

```text
src/       页面、组件与服务端代码
prisma/    数据模型与迁移
scripts/   部署与备份脚本
deploy/    备份任务配置
caddy/     反向代理配置
docs/      Agent 与运维说明
```

## 目录约定

| 情况 | 落位 |
| --- | --- |
| 只被一个页面使用 | 页面目录下的 `_components/`（下划线目录不进路由） |
| 被两个及以上页面使用 | `src/components/` |
| 被复用的有状态逻辑 | `src/hooks/use-*.ts` |
| 纯函数 | `src/lib/` |
| 数据访问与 Server Actions | `src/server/` |

组件默认是服务端组件，只有需要浏览器 API、动画或交互时才加 `"use client"`。

## 文档

- [部署、备份与恢复](docs/operations.md)
- 架构决策记录：[docs/adr/](docs/adr/)