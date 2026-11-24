# 删掉 GraphQL，读走 Server Component 直查，写走 Server Actions

公开页面的读操作由 Server Component 直接查 Prisma，查询函数用 `use cache` 包裹；后台的写操作一律走 Server Actions。仓库里骨架期的 GraphQL Yoga（`src/app/api/graphql/route.ts`、`src/server/graphql/schema.ts`）与 `graphql-yoga`、`graphql` 依赖一并删除。

Next 16 官方要求 Server Component 直接从数据源取数，不经 Route Handler（多一次 HTTP 往返且丢掉静态壳的收益）。GraphQL 在 RSC 里只有两条路：多一次 HTTP 往返，或进程内直接 `execute()`——后者让 GraphQL 只剩查询语言，传输层价值归零。写操作用 Server Actions 是因为它能在同一轮响应里带回重新渲染的 RSC payload；但 Server Actions 在客户端是排队串行执行的，所以绝不用来取数。

## 约束

`next.config.ts` 已开 `cacheComponents: true` 与 `partialPrefetching: true`：

- `use cache` 内不能读 `searchParams`、`cookies`、`headers`；这些值在缓存作用域外取出后作为参数传入，参数进入缓存键。
- `searchParams` 是 request-time API，读它的组件要包在 `<Suspense>` 里。
- Cache Components 要求 Node 运行时，且不允许导出 `runtime` 段。
- Server Action 的引用随构建加密，部署时设 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`（base64，32 字节；构建阶段生效），避免重建期间浏览器里的旧页面报 `Failed to find Server Action`。

## 考虑过的替代方案

- **保留 GraphQL Yoga**：依赖已在仓库，但只服务单个查询，且与 Cache Components 的缓存模型冲突。
- **tRPC**：解决的是客户端取数，而所有公开页面都在 RSC 渲染。
- **REST route handlers**：与 GraphQL 同样的额外往返问题。

## 翻转条件

出现 RSC 之外的消费者（移动端、公开 API）、需要客户端字段级选择、或数据图深到需要一次嵌套取回时，重新讨论。
