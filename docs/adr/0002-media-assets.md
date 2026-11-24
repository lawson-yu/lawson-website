# 媒体素材存 COS，服务端归一化后只存相对 key

图片存腾讯云 COS 标准存储，桶设为公有读私有写，通过已备案的自定义域名读取。COS 默认域名自 2024 年起对任意类型文件强制下载（响应带 `Content-Disposition: attachment`），无法在页面内嵌显示，所以自定义域名是这套方案最硬的约束。

上传只有一条路径：后台 → Next 路由处理器 → sharp 归一化 → COS SDK 写入。读取不签名。封面输出 1200×630 JPEG，正文图片输出最长边 1600 的 WebP。数据库只存相对 key（如 `media/2026/11/xxx.webp`），渲染时拼 base URL，换域名或换存储只改一处。

`og:image` 用 COS 自定义域名的原图绝对地址；未设封面时用站内 `public/og-default.png`。本地开发 `MEDIA_DRIVER=local` 写 `public/uploads/`（gitignore）。

## 考虑过的替代方案

- **预签名直传**：单用户后台，不需要 CORS 与直传链路；服务端一条路径更容易校验格式与体积。
- **MinIO 作本地替身**：开源版已归档、二进制下架，不值得为本站再养一个容器。
- **CDN**：本站无高并发，多一层回源与下行计费。
- **数据万象读时缩放**：公有读桶可以按参数在读取时缩放，但正文图仍在上传时归一化，避免依赖处理服务。

## 后果

媒体目前不在备份链路里：`scripts/backup-postgres.sh` 需追加一次 `coscli sync`，存储桶开启版本控制，与数据库同一套恢复口径。

读取不签名意味着拿到 URL 即可访问；这是公有读桶的既有风险，已接受（桶内只有公开内容）。

调研依据见 issue #26 与 `docs/research/media-assets.md`（research 分支）。
