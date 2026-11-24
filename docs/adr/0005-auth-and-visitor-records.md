# 用 better-auth 做 Google 登录，访客记录按内容类型分表

登录用 `better-auth`（锁 1.7.x），只开 Google provider。账号相关的四张表由 CLI 生成进本仓库的 `schema.prisma`，迁移仍走 `prisma migrate`。访客与站长共用同一个 OAuth 客户端，区别只在账号邮箱是否命中环境变量里的站长白名单——站长账号不是单独的表，就是 `user` 表里命中白名单的那一行。会话存数据库（默认 7 天），`signOut` 删会话行，可服务端吊销。

访客记录分 `ArticleVisit` 与 `ProjectVisit` 两张表，各自 `unique(visitorId, articleId/projectId)`，字段为首次访问时间、最近访问时间与次数。写入发生在详情页客户端挂载时调用 Server Action——在 Server Component 渲染时写库会被预取与缓存重复计数。保留 24 个月，由 systemd timer 定期清理；后台提供「删除该访客」，级联删除账号与全部访问记录。

## 考虑过的替代方案

- **`next-auth` / Auth.js**：v5 已 beta 四年未定版，Auth.js 项目并入 Better Auth；其 Prisma adapter 硬引用 `@prisma/client` 类型，在本项目的 Prisma 7 + 自定义 client output 下编译失败。
- **手写 OAuth（`arctic` + `iron-session`）**：`arctic` 已被作者废弃并在 npm 标记 deprecated；`iron-session` 只能做无状态加密 cookie，无法服务端吊销会话。
- **单张 `Visit` + `targetType`/`targetId`**：失去外键约束与级联。
- **单张 `Visit` + 两个可空外键**：需要 CHECK 约束保证恰好一个非空，而 Prisma 不支持 CHECK，得手写迁移 SQL。

## 后果

- Prisma 必须钉在 7：better-auth 的 adapter 不支持 Prisma 8。
- `user.email` 有唯一约束；将来补 GitHub 登录只是加一个 provider 配置块，不改数据结构。
- 会多出一张用不到的 `verification` 表（只开 Google，没有邮箱流程）。
- Google 在中国大陆网络下可能不可达：未登录访客必须能正常读文章，登录只是可选路径。
