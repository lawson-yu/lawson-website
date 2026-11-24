# 媒体上传与分享图（issue #26）

调研时间：2026-11-24（UTC）。价格、额度、厂商政策都会变，本文的数字只代表调研当日官方页面所述。

标注约定：

- **[事实]** 官方文档原文或官方仓库/源码可查，附来源链接。
- **[实测]** 我在本机跑出来的结果，命令与输出写在第 9 节，可复现。
- **[推断]** 我的判断，没有官方依据，决策票需要自己复核。

产出位置说明：仓库 `main` 上此前没有 `docs/research/`，本文与 `research/bilingual-search`、`research/email-login-delivery` 两个分支上的同类文档保持同一约定；`docs/adr/0001-media-assets.md` 曾被引用但不存在，媒体素材 ADR 的 0002 编号由决策票 #27 在 main 上补写，本文不产出 ADR。

---

## 0. 仓库现状里与本题相关的约束

**[事实]**

- 部署走 `scripts/deploy.sh` + `compose.prod.yaml`，应用是 `output: "standalone"` 的 Next.js 容器，前置 Caddy（`caddy/Caddyfile` 只做反代与压缩，没有静态文件服务与图片处理）。
- 备份只覆盖 PostgreSQL：`scripts/backup-postgres.sh` 导出 `pg_dump` 后 `coscli cp` 到 `cos://$COS_ALIAS/lawson-website/postgres/`。**媒体文件目前不在任何备份链路里。**
- 运行账号已配置 COSCLI（`docs/operations.md`），存储桶别名走 `deploy/backup.env` 的 `COS_ALIAS`。
- `.env.example` / `.env.production.example` 目前只有数据库与邮件变量，没有任何存储相关配置项。
- `prisma/schema.prisma` 只有 `Project` 模型，还没有文章、封面、媒体表。
- 需求侧硬约束（#22 第 6 节）：正文图片在 Markdown 里以引用方式插入；封面可选；未设置封面时分享预览用站点默认图；撤下内容后原地址返回 404；已发布地址稳定。
- 公开界面 `/zh` 与 `/en` 共用同一份内容（ADR 0001），所以同一张封面会被两种界面语言引用，分享预览的语言由正文语言决定，图片本身不需要分语言。

**[事实] 需求里没有明说、但会影响方案的一条**：`next.config.ts` 目前没有 `images` 配置，`public/` 只有 svg 与 3D 模型，没有位图。

---

## 1. 结论速览

| 问题 | 推荐 | 一句话理由 |
| --- | --- | --- |
| 存储 | 腾讯云 COS 标准存储，与现有备份同账号同地域 | 已经在用，增量成本几乎为零 |
| 读取 | 存储桶**公有读私有写** + 已备案**自定义域名**，不开 CDN | COS 默认域名 2024 年起强制下载，页面内无法内嵌显示 |
| 签名 | 读取不签名；写入用服务端签名（不走预签名直传） | 分享抓取方不会带签名；单用户后台不需要直传那套 CORS |
| 上传链路 | 后台 → Next 路由处理器 → sharp 归一化 → COS SDK 写入 | 一条代码路径，可校验格式与体积，无 CORS |
| 归一化 | 封面输出 1200×630 JPEG；正文图片输出最长边 1600 的 WebP | 分享抓取格式兼容性优先；正文单尺寸，不做 srcset 矩阵 |
| 分享图 | `og:image` 用 COS 自定义域名的原图 URL；未设封面时用站内 `public/og-default.png` | 绝对地址、稳定 URL、不经过 `/_next/image` 的内容协商 |
| 引用形态 | 正文与封面都存**相对 key**（如 `media/2026/11/xxx.webp`），渲染时拼 base URL | 换域名或换存储只改一处，不用批量改写 Markdown |
| 本地开发 | `MEDIA_DRIVER=local`，写 `public/uploads/`（gitignore） | MinIO 开源版已归档，不值得为本站再养一个容器 |
| 备份 | COS 开版本控制；`backup-postgres.sh` 追加一次 `coscli sync` | 媒体与数据库同一套恢复口径 |

---

## 2. 存储与读取

### 2.1 为什么必须用自定义域名（本方案最硬的约束）

**[事实]** 存储桶默认权限是「私有读写」；可选「公有读私有写」，此时匿名用户可直接通过链接访问对象，数据存在泄露风险。<https://cloud.tencent.com/document/product/436/13312>

**[事实]** 2024 年 1 月 1 日后创建的存储桶，使用默认域名（含存储桶默认域名、静态网站域名、全球加速域名）访问任意类型文件**不支持预览、直接下载**，响应会带：

```
x-cos-force-download: true
Content-Disposition: attachment
```

<https://cloud.tencent.com/document/product/436/96243>

这条决定了：只要桶是 2024 年后新建的（本站必然是），**用 COS 默认域名做不了站内图片**——`<img>` 会把图片当附件下载。必须配自定义域名（或 CDN 加速域名）。

**[事实]** 自定义域名指向**中国大陆地域**的存储桶时必须已备案；备案流程见官方指引。<https://cloud.tencent.com/document/product/436/102509>

**[推断]** 文档只对中国大陆地域要求备案，因此香港/新加坡地域的桶配自定义域名应当不需要备案，代价是大陆访客的访问延迟与稳定性都不如境内桶。这条对「域名还没定、备案没做」（#2 域名待定）是唯一的绕行路径，但没实测过。

### 2.2 公开读 vs 签名 URL

**[事实]** 预签名 URL 可以限定到单个对象与有效期；仅支持单个对象、仅支持简单上传（最大 5GB、不支持分块）；**预签名 URL 不支持 CDN 域名**。<https://cloud.tencent.com/document/product/436/14114>

**[实测]** 在腾讯云公开读示例桶上：匿名 GET 200 正常返回图片；未签名 PUT 返回 403 `AccessDenied`；带伪造/过期签名的 GET 返回 403 `Request has expired`（即签名优先于公有读 ACL 判定）。

**[推断]** 分享抓取方（Facebook/X/微信/Slack 等）不会、也没法携带签名，因此**任何签名方案都会让 `og:image` 失效**。正文图片同理：签名 URL 会过期，等于给已发布文章埋定时炸弹。所以读取必须是公有读。

公开读的边界（建议写进 ADR 0002）：

- 桶只放媒体对象，不放任何非公开内容；桶内前缀固定为 `media/`。
- 上传与删除只允许站长后台的服务端调用，密钥只存服务器 `.env.production`，且用**子账号密钥**只授予该桶的 `cos:PutObject` / `cos:DeleteObject`。
- 对象 key 用随机 ID（不含原始文件名），降低被穷举与信息泄露风险。
- 公开读的代价是「拿到链接就能读」；本站内容本身就是公开的，接受这个代价，不引入防盗链。

### 2.3 图片被撤下 / 文章被撤下

**[推断]** 需求里「撤下」只要求公开入口消失、原地址 404（#22 第 6 节），没有要求删除媒体。因此建议：

- 撤下文章：数据库状态改为撤下，正文里的 COS 对象**保留**（再次发布恢复原地址时图片还在）。
- 删除单张图片：先从正文移除引用，对象**延迟清理**（人工或定期脚本对比「被引用 key 集合」，孤儿对象过 30 天再删）。
- 因为读取是公有读，撤下后图片 URL 仍可访问；这不是漏洞，但要在隐私说明与 ADR 里明说「撤下不回收图片」。
- 若将来要真正回收：删对象后旧链接 404，抓取方缓存的预览图可能仍显示（见 4.4）。

---

## 3. 上传链路

### 3.1 直传 vs 经服务端

| 维度 | 预签名直传（浏览器 → COS） | 经服务端（浏览器 → Next → COS） |
| --- | --- | --- |
| 官方支持 | 有完整实践文档 <https://cloud.tencent.com/document/product/436/9067> | SDK 普通上传 |
| 需要额外配置 | 桶的 CORS 规则、前端拿签名的接口、直传失败重试 | 无 |
| 能否在落盘前校验/压缩 | 不能（客户端校验可绕过） | 能（sharp 归一化、格式白名单、体积上限） |
| 凭据暴露面 | 签名接口可被反复请求，需限流 | 密钥只在服务端进程内 |
| 大文件 | 支持到 5GB（简单上传） | 受 Node 进程内存与反代超时约束 |

**[推断] 选经服务端**：站长是唯一上传者，单张图片几 MB，没有并发压力；直传省的带宽对本站没有意义，却要多维护一套 CORS + 签名接口。服务端路径还能顺手做格式白名单与归一化，避免把 8MB 的 PNG 直接塞进正文。

### 3.2 格式与体积

**[推断]** 建议的上限（决策票可调）：

- 允许输入：JPEG、PNG、WebP、AVIF（`sharp` 能读的都行，但只放行这四种，其余拒绝）。
- 单文件上限 10MB，超限直接拒绝并提示（服务端读 body 前先看 `Content-Length`）。
- 上传后统一转码，原始文件不落盘、不入库（避免存储翻倍）。
- 不接受 SVG 上传：SVG 可内嵌脚本，`next/image` 默认也禁（`dangerouslyAllowSVG: false`）。

**[事实]** `sharp` 已作为 `next` 的 optionalDependency 存在于 `node_modules`（`sharp@0.35.5`），但**直接使用它仍需在 `package.json` 里显式声明依赖**，否则依赖提升是偶然的。

### 3.3 正文图片与封面的差别

| | 正文图片 | 封面 |
| --- | --- | --- |
| 输出尺寸 | 最长边 1600，等比 | 1200×630，居中裁切 |
| 输出格式 | WebP（质量 82） | **JPEG**（质量 82） |
| 用途 | Markdown `![]()` 引用 | 文章详情头图 + `og:image` |
| 是否必须 | 否 | 否（缺省用站点默认图） |
| 替代文本 | 编辑器强制填写（Markdown 的 `alt`） | 存到数据库字段，输出为 `og:image:alt` |
| 多尺寸 | 首版不做（见取舍） | 不需要 |

**[推断] 封面用 JPEG 不用 WebP**：分享抓取方对 WebP/AVIF 的支持没有官方保证，JPEG 是唯一能确定被所有抓取器接受的格式。1200×630 是业界通行尺寸（1.91:1），见 4.2 的验证状态。

**[推断] 不做 srcset**：正文单尺寸 1600 WebP 对手机略大（约 150–300KB），但换来「Markdown 里只有一条 URL、不依赖渲染器改造、换存储不用改正文」。真要做多尺寸，最省事的是上传时多存一个 800 宽版本、渲染器拼 `srcset`，属于后续优化，不进首版。

---

## 4. 分享抓取（og:image）

### 4.1 绝对地址

**[事实]** Open Graph 协议的 `og:image` 是 URL 类型，规范里 URL 被定义为「所有使用 `http://` 或 `https://` 协议的合法 URL」，并且示例全部是绝对地址；`og:image` 还支持 `og:image:width`、`og:image:height`、`og:image:type`、`og:image:alt`，其中「页面给了 `og:image` 就应该给 `og:image:alt`」。<https://ogp.me/>

**[事实]** Next.js 的 `metadataBase` 用于给需要完整 URL 的 metadata 字段补前缀；文档明确「使用相对 URL 时必须显式设置 `metadataBase`，否则社交图片会用回退 origin 并产生警告」。<https://nextjs.org/docs/app/api-reference/functions/generate-metadata>

**[推断]** 落地方式：根 layout 设 `metadataBase: new URL(APP_URL)`，文章页 `openGraph.images` 用媒体域名拼出的绝对 URL（封面）或 `/og-default.png`（缺省），并显式给 `width`/`height`/`alt`。

### 4.2 尺寸与格式

**[事实]** 协议层没有规定尺寸与格式，只要求是 URL 且（按类型定义）为 http/https。

**[未直接验证]** 1200×630、最小 200×200、1.91:1 这些具体数字来自 Meta 的分享最佳实践，但 `developers.facebook.com` 在当前网络下无法访问（见 9.6），我只能读到二手转述（例如 Wix 帮助页明确写着「取自 Facebook Sharing Best Practices」：1.91:1、最小 200×200）。**决策票若要写死尺寸，应先由站长在能访问的网络上核对 Meta 原文。**

**[推断]** 在无法核对原文的情况下，1200×630 JPEG 仍然是安全的：它同时满足常见抓取器对宽高比与体积的直觉，且不依赖任何一方文档。

### 4.3 不要用 `/_next/image` 做 `og:image`

**[实测]** 本地 `next dev` 的 `/_next/image?url=%2F__probe.jpg&w=384&q=75`：

| 请求 | 响应 |
| --- | --- |
| `Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8` | 200，`Content-Type: image/webp`，13926 字节 |
| `Accept: */*` | 200，`Content-Type: image/jpeg`，13984 字节 |

两者都带 `Vary: Accept`。

**[事实]** 源码里同样的逻辑：优化器按请求的 `Accept` 协商输出格式（`getSupportedMimeType(..., req.headers['accept'])`），并设置 `Vary: Accept`；生产环境缓存头是 `public, max-age=<minimumCacheTTL>, must-revalidate`，`minimumCacheTTL` 默认 14400 秒；默认 `formats` 只有 `image/webp`；默认 `path` 是 `/_next/image`。（本仓库 `next@16.4.5` 的 `node_modules/next/dist/server/image-optimizer.js`、`dist/shared/lib/image-config.js`）

**[推断]** 结论：`/_next/image` 的同一个 URL 会因请求头返回不同字节，它不是一个稳定的资源标识，抓取方缓存与去重都可能踩坑。`og:image` 必须指向 COS 上的原图 URL。

**[事实]** 远程图片必须登记在 `images.remotePatterns` 里，否则优化器直接拒绝。官方文档：「An absolute external URL (must be configured with remotePatterns)」；源码在 `dist/server/image-optimizer.js` 里对未匹配的 host 返回 400。

**[实测]** 未登记 COS 域名时请求优化器返回 `400`，body 是 `"url parameter is not allowed"`。

### 4.4 缓存与失效

**[事实]** Next 侧（页面 HTML）由 `cacheComponents` / 路由缓存控制；图片优化器侧默认缓存 14400 秒（4 小时），且 `must-revalidate`。

**[推断] 抓取方侧**（无法验证，见 9.6）：抓取器按页面 URL 缓存预览元信息，改封面后旧图可能继续显示，直到抓取器重新抓取或缓存过期。可控做法：

- **封面换文件**：每次上传封面生成新的随机 key，`og:image` 随之变化，抓取器视为新资源。
- 不覆盖同一个对象名（覆盖会让抓取器继续用旧缓存，且 CDN/浏览器缓存也难失效）。
- 页面 `og:image` 指向的 URL 必须是长期有效的（不签名、不过期），撤下文章后该 URL 仍可访问（见 2.3）。

### 4.5 站点默认分享图

**[推断]**

- 放站内 `public/og-default.png`，1200×630，体积控制在 200KB 内，**不放 COS**：桶策略变更、密钥吊销、域名迁移都不该影响首页与列表页的分享预览。
- 通过 `metadataBase` 拼成绝对地址输出，不依赖 `APP_URL` 之外的配置。
- 每篇文章有封面时覆盖它；作品卡片同理（首版作品无封面字段，统一用默认图）。
- 默认图是唯一的「设计资产」，需要与首页视觉一起批准（属于视觉工单，不在本票范围）。

---

## 5. 成本

**[事实] 腾讯云 COS 刊例价（广州地域，官方计费示例）** <https://cloud.tencent.com/document/product/436/6241>

| 计费项 | 单价 |
| --- | --- |
| 标准存储容量 | 0.118 元/GB/月（示例按 0.118/30 元/GB/天折算） |
| 标准存储读请求 | 0.01 元/万次 |
| 标准存储写请求 | 0.01 元/万次 |
| CDN 回源流量 | 0.15 元/GB |
| 归档存储容量 | 0.03 元/GB/月 |

**[事实]** 外网下行流量（不走 CDN 直接访问对象）按量计费；国际站计费示例给出的中国大陆参考价是 0.1 美元/GB，人民币单价需在定价中心确认（该页面为 JS 渲染，本次未取到数字）。<https://www.tencentcloud.com/zh/document/product/436/33776>

**[事实]** 新用户免费额度：个人 50GB 标准存储容量包，6 个月。<https://cloud.tencent.com/document/buy-guide/436/6240>

**[事实]** 数据万象基础图片处理 0.025 元/GB/月（按**源文件大小**计量），每月免费额度 10TB。<https://cloud.tencent.com/document/product/460/36380>、<https://cloud.tencent.com/document/product/460/36381>

**[推断] 本站规模的增量成本**

假设：30 篇文章 × 5 张正文图 × 300KB ≈ 45MB，封面 30 × 150KB ≈ 4.5MB，加默认图与零散素材，存量按 100MB 计；月外网下行按 5GB 计（远高于单作者站点的真实量级）。

- 存储：0.1GB × 0.118 ≈ **0.01 元/月**
- 读请求：5GB / 200KB ≈ 2.5 万次 → 0.025 元/月
- 外网下行：5GB × 人民币单价（待确认；若按美元示例 0.1 折算约 0.7 元/GB）→ **约 3.5 元/月**
- 数据万象缩放（若使用）：远低于 10TB 免费额度 → **0 元**

结论：**月成本量级是个位数人民币**，即使图片量翻十倍也不到一顿饭钱。真正的成本不是钱，而是**备案周期**与**域名决策**（见第 8 节）。这也是不建议为此引入 CDN 的原因：CDN 会再加一层回源流量与下行流量计费，而本站没有高并发。

---

## 6. 运维：备份、失效、迁移

### 6.1 备份（当前缺口）

**[事实]** 现有备份脚本只备份 PostgreSQL，媒体文件没有任何备份。

**[推断] 最小改动**（不在本票实现，交给实现票）：

1. 给存储桶开**版本控制**：覆盖与删除都保留历史版本，是防误删最便宜的手段（不需要额外存储桶与脚本）。
2. `scripts/backup-postgres.sh` 末尾追加一次媒体同步，例如 `coscli sync cos://$COS_ALIAS/lawson-website/media/ cos://$COS_ALIAS/lawson-website/media-backup/`，与数据库备份同频（每周）。增量同步的成本按流量算，100MB 量级可忽略。
3. 恢复演练要覆盖媒体：数据库恢复后，正文里的 key 必须都能在桶里取到（可用脚本对比引用集合与实际对象列表）。

**[推断] 谁维护**：站长本人，与现有备份定时任务同一账号、同一 `backup.env`。

### 6.2 失效模式

| 失效 | 影响 | 缓解 |
| --- | --- | --- |
| 对象被误删 | 该图 404，正文出现破图 | 版本控制 + 孤儿对象延迟清理 |
| 桶策略被改成私有 | 全部图片 403 | 部署/运维文档写明「读取依赖公有读」；改策略前先看 `docs/operations.md` |
| 密钥吊销 | 只能影响上传，不影响读取（公有读不需要签名） | 上传失败提示明确 |
| 自定义域名/证书失效 | 全部图片与分享预览失效 | 与站点主域同一套解析与证书管理 |
| COS 欠费停服 | 图片与备份上传同时停 | 与数据库备份同一账号，一处告警覆盖两处 |

### 6.3 迁移风险

**[推断]** 最大的迁移风险是「正文里写死绝对 URL」：一旦换域名或换存储商，需要批量改写所有 Markdown。规避方式在 1 节已经定了：**正文与数据库只存相对 key**（`media/2026/11/<random>.webp`），渲染时拼 `MEDIA_PUBLIC_BASE_URL`。这样换域名只改一个环境变量，换存储商只改 base URL + 一次性 `coscli sync` 到新桶。

次大风险是**封面与分享预览的缓存**：迁移后旧 URL 的预览图可能被抓取方缓存一段时间（见 4.4）。

---

## 7. 本地开发与预览环境

### 7.1 MinIO 不再是默认答案

**[事实]** MinIO 开源仓库已归档并标注「THIS REPOSITORY IS NO LONGER MAINTAINED」，官方建议转向 AIStor 免费版/企业版。<https://github.com/minio/minio/>

**[实测]** `https://dl.min.io/server/minio/release/darwin-arm64/minio` 与 `.../client/mc/...` 现在返回 **410 Gone**，正文说明社区版二进制不再分发；本机 `docker pull minio/minio` 也失败（镜像源报错，属本机环境问题，不构成证据）。

结论：**不要为本站引入 MinIO 作为本地 S3 替身**。一个已归档、二进制下架的项目，不适合作为新项目的开发依赖。

### 7.2 推荐：文件系统驱动

**[推断]** 存储层抽一个最小接口（`put(key, bytes, contentType)` / `delete(key)` / `publicUrl(key)`），两个实现：

- `local`（开发/预览）：写 `public/uploads/`，URL 前缀 `http://localhost:3000/uploads/`。`public/uploads/` 加进 `.gitignore`，Docker 构建时排除（`.dockerignore` 已排除部分路径，需要加一条）。
- `cos`（生产）：写 COS，URL 前缀 `https://media.<域名>/`。

由 `MEDIA_DRIVER` 与 `MEDIA_PUBLIC_BASE_URL` 切换，默认按 `NODE_ENV` 推断。这样 `pnpm dev` 不需要任何额外容器，断网也能写文章。

**[推断] 如果确实需要 S3 协议一致性**（例如想验证 SDK 的分块/签名行为）：Garage、SeaweedFS、LocalStack 都可以，但每个都要多养一个容器与一份配置，对单人博客不划算。本机 Docker 镜像源当前拉不动镜像（实测），也说明这条路的摩擦成本不低。

### 7.3 预览环境

**[事实]** 仓库没有预览环境：`scripts/deploy.sh` 直接在生产 compose 上构建并发布，`compose.yaml` 只有数据库与 Mailpit。

**[推断]** 预览就用 `pnpm dev` + `local` 驱动。若需要验证真实 COS（比如签名、CORS、自定义域名），用一个独立的 dev 桶 + 只读密钥，靠 `.env` 切换，不要复用生产桶。

---

## 8. 需要新增的配置项与待决策点

### 8.1 环境变量（建议）

| 变量 | 生产 | 开发 | 说明 |
| --- | --- | --- | --- |
| `MEDIA_DRIVER` | `cos` | `local` | 可选，默认按 `NODE_ENV` 推断 |
| `COS_SECRET_ID` / `COS_SECRET_KEY` | 子账号密钥 | 空 | 只授 `PutObject`/`DeleteObject` 于媒体前缀 |
| `COS_BUCKET` | `lawson-media-<appid>` | 空 | 独立桶，不与备份桶混用 |
| `COS_REGION` | 与服务器同地域 | 空 | |
| `COS_MEDIA_PREFIX` | `media` | 空 | 对象 key 前缀 |
| `MEDIA_PUBLIC_BASE_URL` | `https://media.<域名>` | `http://localhost:3000/uploads` | 渲染时拼 URL |
| `APP_URL` | `https://<主域>` | `http://localhost:3000` | `metadataBase` 用；也可复用 `APP_DOMAIN` |

另需（非环境变量）：

- `next.config.ts` 增加 `images.remotePatterns`（登记 `media.<域名>`），否则 `next/image` 渲染 COS 图片会被拒绝（实测 400）。
- `public/og-default.png`（1200×630，<200KB）。
- `.gitignore` / `.dockerignore` 增加 `public/uploads/`。
- `deploy/backup.env.example` 增加媒体同步用的前缀变量（若采纳 6.1 的第 2 步）。

### 8.2 需要站长或决策票拍板的点

1. **媒体域名**：用 `media.<主域>` 子域，还是主域路径 `/media`？（后者省一张证书，但换存储时更难剥离。）依赖 #2「域名待定」。
2. **桶的地域与备案**：境内桶（需 ICP 备案，速度好）还是香港桶（免备案，延迟高）？备案是唯一有外部等待期的项，越早启动越好。
3. **是否开 CDN**：本调研建议不开（成本翻倍、收益在本站规模不可见）。
4. **撤下后是否回收图片**：建议保留；若要求回收，需要额外定「孤儿对象清理」的周期。
5. **是否需要多尺寸 srcset**：本调研建议首版不做。
6. **上传体积上限**：建议 10MB，是否更严由站长定。
7. **`og:image` 尺寸**：建议 1200×630，但 Meta 原文未核对（见 4.2）。

---

## 9. 实测记录与无法验证的部分

### 9.1 COS 公开读 + 数据万象按需缩放

```
curl -sS -D h1 -o a.jpg 'https://examples-1251000004.cos.ap-shanghai.myqcloud.com/sample.jpeg'
→ 200, image/jpeg, Content-Length: 158421, Server: tencent-cos
file a.jpg → JPEG 960x540

curl -sS -o b.jpg '.../sample.jpeg?imageMogr2/thumbnail/!25p'
→ 200, 13838 字节
file b.jpg → JPEG 240x135
```

结论：公有读桶匿名可读；数据万象在**读取时**按参数缩放可用，无需预先生成多尺寸（但见 3.3：正文仍建议上传时归一化，避免依赖处理服务）。

### 9.2 公有读不放行写、签名优先

```
PUT https://examples-1251000004.cos.ap-shanghai.myqcloud.com/__probe_test.txt   (未签名)
→ 403 AccessDenied

GET .../sample.jpeg?q-sign-algorithm=sha1&q-ak=AKIDfake&q-sign-time=1;2&...&q-signature=deadbeef
→ 403, <Code>AccessDenied</Code>, <Message>Request has expired</Message>
```

结论：公有读桶不会顺带放开写；带上无效签名时签名优先于公有读 ACL（所以读取 URL 绝对不能带过期签名参数）。

### 9.3 `/_next/image` 的内容协商

见 4.3 的表格，命令：

```
curl -H 'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8' \
  'http://127.0.0.1:3123/_next/image?url=%2F__probe.jpg&w=384&q=75'
curl -H 'Accept: */*' 'http://127.0.0.1:3123/_next/image?url=%2F__probe.jpg&w=384&q=75'
```

（`public/__probe.jpg` 是临时测试图，测完已删除，未提交。）

### 9.4 `remotePatterns` 拦截

```
curl 'http://127.0.0.1:3123/_next/image?url=https%3A%2F%2Fexamples-1251000004.cos...%2Fsample.jpeg&w=384&q=75'
→ 400, body: "url parameter is not allowed"
```

### 9.5 环境侧发现（实现时要注意）

- 本机 `pnpm dev` 启动时，Next 自动生成/改写了 `AGENTS.md`（日志：`✓ Generated AGENTS.md for AI agents. Set agentRules: false in next.config to disable.`）。本次已 `git checkout -- AGENTS.md` 还原，未提交。实现票在加开发脚本时要注意这个副作用。
- `next@16.4.5` 的 `node_modules` 里存在 `sharp@0.35.5` 与 `@img/sharp-darwin-arm64`；`.next/standalone` 的构建 trace 里也包含 `sharp` 与对应平台二进制，说明 standalone 输出会带上图片优化所需的 sharp。**但这只验证了 darwin 构建**，Linux/alpine 容器里是否带 `@img/sharp-linuxmusl-*` 未验证。

### 9.6 无法验证的部分与验证方法

| 项 | 为什么没验证 | 怎么验 |
| --- | --- | --- |
| 各平台抓取器实际行为（Meta/X/Slack/微信） | 需要公网域名 + 各平台账号；`developers.facebook.com` 当前网络不可达 | 部署到临时公网域名后，用 Facebook Sharing Debugger、X Card Validator 各抓一次；国内用微信「分享给朋友」实测缩略图 |
| 抓取方缓存时长与失效规则 | 同上 | 换封面后重复抓取，记录旧图残留时间 |
| Meta 官方推荐的 1200×630 / 最小 200×200 | 官方页面不可达，只有二手转述 | 在可访问网络下核对 `developers.facebook.com/docs/sharing/webmasters/images` |
| 自定义域名 + 备案 | 需要真实域名与备案主体 | 按 <https://cloud.tencent.com/document/product/436/102509> 走一遍 |
| 香港地域桶免备案 | 文档只写明中国大陆地域需备案，未直接说境外不需要 | 用香港桶配一个未备案域名试绑 |
| 中国大陆地域外网下行流量人民币单价 | 定价中心为 JS 渲染，未取到 | 在 <https://buy.cloud.tencent.com/price/cos> 查，或用费用中心的用量明细反推 |
| Linux 容器内 sharp 是否被打包 | 只验证了 darwin 构建 | `docker build` 后检查 `.next/standalone/node_modules/.pnpm/@img+sharp-linuxmusl-*` |
| COS 防盗链 / referer 规则对本方案的影响 | 未配置过 | 若要启用，先测抓取器不带 referer 时是否被拦（很可能被拦，故本方案不启用） |

---

## 10. 参考来源

- COS 存储桶概述（权限类型、默认私有读写）：<https://cloud.tencent.com/document/product/436/13312>
- COS 存储桶域名使用安全管理通知（默认域名强制下载）：<https://cloud.tencent.com/document/product/436/96243>
- COS 存储桶切换自定义域名（备案要求）：<https://cloud.tencent.com/document/product/436/102509>
- COS 预签名授权上传（单对象、5GB、不支持 CDN 域名）：<https://cloud.tencent.com/document/product/436/14114>
- COS Web 端直传实践：<https://cloud.tencent.com/document/product/436/9067>
- COS 计费示例（刊例价）：<https://cloud.tencent.com/document/product/436/6241>
- COS 计费概述：<https://cloud.tencent.com/document/product/436/16871>
- COS 流量费用：<https://www.tencentcloud.com/zh/document/product/436/33776>
- COS 请求费用：<https://www.tencentcloud.com/zh/document/product/436/40100>
- COS 免费额度：<https://cloud.tencent.com/document/buy-guide/436/6240>
- 数据万象图片处理费用与费用示例：<https://cloud.tencent.com/document/product/460/58117>、<https://cloud.tencent.com/document/product/460/36380>
- 数据万象免费额度（基础图片处理 10TB/月）：<https://cloud.tencent.com/document/product/460/36381>
- 数据万象图片缩放：<https://cloud.tencent.com/document/product/460/36540>
- COSCLI 下载与安装配置：<https://cloud.tencent.com/document/product/436/63144>
- Open Graph 协议：<https://ogp.me/>
- Next.js `next/image` 组件文档：<https://nextjs.org/docs/app/api-reference/components/image>
- Next.js `generateMetadata` / `metadataBase`：<https://nextjs.org/docs/app/api-reference/functions/generate-metadata>
- MinIO 仓库归档说明：<https://github.com/minio/minio/>
