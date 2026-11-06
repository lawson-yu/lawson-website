# Lawson 个人网站 Starter

基于 Next.js、GraphQL 和 Prisma/PostgreSQL 的个人网站全栈骨架。

## 本地启动

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

## 目录导航

```text
src/       页面、组件与服务端代码
prisma/    数据模型与迁移
scripts/   部署与备份脚本
deploy/    备份任务配置
caddy/     反向代理配置
docs/      Agent 与运维说明
```

- [部署、备份与恢复](docs/operations.md)