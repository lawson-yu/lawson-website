# 邮件登录发信验证（issue #3）

调研时间：2026-11-24（UTC）。所有价格与额度均为当日官方页面所述，会变动。
产出目录说明：仓库此前没有 `docs/research/`，本文件为第一篇；参考 `docs/operations.md` 的文档风格。

标注约定：**[事实]** 来自官方文档原文；**[推断]** 是我的判断，没有官方依据；**[厂商宣传]** 是服务商自己的营销数字，不能当作送达率证据。

---

## 0. 前置：本次实际读到的仓库约束（含一处文档缺失）

**[事实] 仓库现状**

- `docs/operations.md` 存在：部署走 `scripts/deploy.sh` + `compose.prod.yaml`，生产配置放服务器上的 `.env.production`，备份同步到腾讯云 COS。说明部署环境很可能是国内云主机，且运维者已接受腾讯云。
- `.env.example` 已预留邮件变量：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`；开发环境用 compose 里的 Mailpit（`localhost:1025`）。
- `.env.production.example` 注明「生产邮件发送。服务商待定，接入前登录链接不会真正发信」。
- `prisma/schema.prisma` 目前只有 `Project` 模型，没有 User / Session / Token 表。
- 相关工单：#1 地图、#2 域名待定、#3 本工单、#12 后台结构与运营流程。

**[事实] 一处缺失，影响结论确定性**

工单 #1 引用的需求基线 `docs/requirements-consensus.md` 在 `main` 上不存在（GitHub Contents API 返回 404，`git ls-tree origin/main` 也没有该文件）。因此任务里要求「尤其第 3、6 节关于后台与登录的约束」我无法读到，只能改用 #1、#3、#12 的正文和 `GLOSSARY.md` 反推约束：后台单用户、只允许预配置的站长邮箱、无密码、双语站点。

**这会让本文关于「登录链接有效期」「限流阈值」的建议缺少需求侧硬约束（例如是否有「长期免登录」的期望）。建议在决策前补齐该文档，或由站长直接确认第 4 节参数。**

---

## 1. 方案对比总表

| 方案 | 免费额度 / 起步成本 | 自有域名发信 | DNS 记录 | 发信地址形态 | SMTP | API | 需要的账号与凭据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Resend** | 免费 $0：3,000 封/月、100 封/天、3 个域名；Pro $20/月 5 万封 | 必须，且必须是自己的域名 | DKIM TXT + SPF（TXT + MX 或 CNAME）+ 可选 `_dmarc` TXT | 已验证域名下任意地址；Return-Path 默认 `send.<域名>` | 有 | 有（REST） | Resend 账号 + 域名 + API Key |
| **Postmark** | 免费 100 封/月（永不过期、不允许超量）；Basic $15/月 1 万封 | 必须；域名或单地址签名 | DKIM TXT + Return-Path CNAME（`pm_bounces` → `pm.mtasv.net`）+ DMARC | 已验证域名下任意地址 | 有 | 有（REST） | Postmark 账号 + 域名 + Server API Token |
| **Amazon SES** | 无月费，按量 $0.16/千封（Essentials，0–10M 档）；Pro 档另有 $105/月/区域 | 必须（域名身份） | 3 条 DKIM CNAME；MAIL FROM 默认用 amazonses.com 子域，SPF 不落在自己域名上；DMARC 需自己加 | 已验证域名下任意地址 | 有 | 有 | AWS 账号（需绑卡）+ IAM 用户 + 专用 SMTP 凭据 + 沙箱转生产审批 |
| **腾讯云 SES** | 1000 封免费额度，不限有效期，用完即止；之后 0.0019 元/封 | 必须 | MX + SPF + DKIM + DMARC | 控制台创建的「发信地址」（每域名 10 个） | **个人实名新号已关闭** | 有 | 腾讯云账号（实名）+ 发信域名 + 发信地址 |
| **阿里云 DirectMail** | 2000 封总量，每天最多免费 200 封；之后 2 元/千封 | 必须 | 所有权 TXT + SPF TXT + DKIM TXT + MX + DMARC | 控制台创建的「发信地址」（每账号 100 个），需单独设 SMTP 密码 | 有 | 有 | 阿里云账号（实名）+ 发信域名 + 发信地址 |
| **SendGrid** | 免费计划已下线；新号 60 天试用 100 封/天；付费 $19.95/月起 | 必须 | SPF + DKIM + DMARC | 已验证域名下任意地址 | 有 | 有 | Twilio/SendGrid 账号 + 付费 |
| **Gmail SMTP（过渡）** | 免费，受个人 Gmail 500 封/天限制 | 不需要 | 无 | 只能是该 Gmail 地址 | 有 | 无 | 该 Gmail 账号开启两步验证 + 应用专用密码 |

---

## 2. 逐个方案

### 2.1 Resend

**[事实] 额度与价格**：免费 $0，3,000 封/月、**每天上限 100 封**、3 个域名、3 个收件箱、30 天数据保留；Pro $20/月 5 万封，超量 $0.90/千封。所有档位都包含 REST API、SMTP 中继、DKIM/SPF/DMARC、webhook。来源：<https://resend.com/pricing>

**[事实] 域名要求**：必须添加并验证至少一个自有域名；建议用子域（如 `notifications.example.com`）隔离信誉；只验证子域时，`from` 必须落在该子域，否则报 403 domain mismatch。Return-Path 默认是 `send.example.com`，可改。来源：<https://resend.com/docs/add-a-domain>、<https://resend.com/docs/dashboard/domains/introduction>

**[事实] DNS 记录**：DKIM 与 SPF 配置以 TXT 加 MX 或 CNAME 给出，需逐条照抄；CNAME 不能开 Cloudflare 橙色云代理；通常 15 分钟内验证完成，最长 72 小时。DMARC 需另加 `_dmarc` TXT，官方建议先 `p=none` 再收紧。来源：<https://resend.com/docs/add-a-domain>、<https://resend.com/docs/dashboard/domains/dmarc>

**[事实] SMTP**：`smtp.resend.com`，端口 25 / 465 / 587 / 2465 / 2587；用户名固定 `resend`，**密码就是 API Key**；465、2465 为隐式 TLS，25、587、2587 为 STARTTLS；SMTP 受与 API 相同的速率限制；支持 `Resend-Idempotency-Key` 头防重。来源：<https://resend.com/docs/send-with-smtp>

**[事实] API**：`https://api.resend.com`，`Authorization: Bearer re_...`，**必须带 `User-Agent`**，否则 403（错误码 1010）；默认速率限制 **10 请求/秒/团队**，超限返回 429。来源：<https://resend.com/docs/api-reference/introduction>

**[事实] 测试域名限制**：未验证域名时用 `onboarding@resend.dev` 发信，只能发给 Resend 账号自己的邮箱，否则返回 403 `validation_error`。来源：<https://resend.com/docs/api-reference/errors>

**[推断] Gmail 送达**：Resend 是新厂商（相对 SES/Postmark），共享 IP 池。本场景每天 1–3 封，共享池的历史信誉通常比新域名自建 IP 更好，但没有任何官方数据能证明「到 Gmail 必进收件箱」。Resend 的自有域名 + DKIM/SPF + DMARC 恰好满足 Gmail 对普通发信人的最低要求。

**[推断] 对本项目的适配**：Auth.js 官方就有 Resend provider（`AUTH_RESEND_KEY`），意味着后续若选 Auth.js，接入成本最低。来源：<https://authjs.dev/getting-started/authentication/email>

### 2.2 Postmark

**[事实] 额度与价格**：免费 $0.00/月 **100 封/月**，永不过期，**不允许超量**；Basic $15/月 1 万封（超量 $1.80/千封）、Pro $16.50/月、Platform $18/月；Basic 含 5 个自定义发信域名。来源：<https://postmarkapp.com/pricing>

**[事实] 域名验证**：DKIM（TXT）+ 自定义 Return-Path（CNAME `pm_bounces` → `pm.mtasv.net`，这条才让邮件通过 SPF）+ DMARC 设置三部分；验证最长 48 小时，可手动点 Verify。来源：<https://postmarkapp.com/support/article/1046-how-do-i-verify-a-domain>

**[事实] SMTP**：`smtp.postmarkapp.com`（事务流）或 `smtp-broadcasts.postmarkapp.com`（群发流），端口 25 / 2525 / 587，STARTTLS；**Server API Token 同时当用户名和密码**（用 Account API Token 会认证失败）；也可用 SMTP Token；不指定 message stream 头 `X-PM-MESSAGE-STREAM` 时默认走 transactional 流。来源：<https://postmarkapp.com/developer/user-guide/send-email-with-smtp>

**[事实] API**：REST，凭 Server API Token；有 Sandbox 模式可生成假退信做测试。来源：<https://postmarkapp.com/pricing>（功能表）、<https://postmarkapp.com/developer/user-guide/send-email-with-api>

**[事实] 专用 IP 门槛**：$50/月起，且只对月发 30 万封以上的客户开放。来源：<https://postmarkapp.com/pricing>

**[推断] Gmail 送达**：Postmark 长期以事务邮件送达口碑著称，但**100 封/月的免费额度只够验证，不够长期跑**（如果每天登录一次、加上重发，一个月大约 30–90 封，正好卡在边缘）。$15/月的 Basic 才是有余量的选择。

**[推断] 对本项目的适配**：功能最贴合事务邮件，但免费额度对「每天登录」这种低频长期用途偏紧，属于「花钱买省心」的选项。

### 2.3 Amazon SES

**[事实] 沙箱限制**：所有新账号都在沙箱；只能发给已验证的地址或域名（或 SES 邮箱模拟器）；**24 小时最多 200 封、每秒最多 1 封**；转生产需提交申请（选 Marketing/Transactional、填网站 URL 等）。来源：<https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html>

**[事实] 价格**：Essentials 档 0–10M 封每月 $0.16/千封；Pro 档 $0.22/千封另加 $105/账号/区域/月；Enterprise $0.23/千封另加 $500/月。2026-07-21 起无计量活动的新账号默认进 Essentials 档。来源：<https://aws.amazon.com/ses/pricing/>

**[事实] DKIM**：Easy DKIM 自动生成 2048 位密钥，需要在 DNS 添加 **3 条 CNAME** 记录；验证最长 72 小时。来源：<https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html>、<https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html>

**[事实] SPF/MAIL FROM**：默认 MAIL FROM 是 amazonses.com 的子域，因此 SPF 对齐落在 amazonses.com 而不是你的域名；要让自己域名通过 SPF 必须配置 custom MAIL FROM domain（额外 TXT + MX）。来源：<https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html>

**[事实] SMTP 凭据**：SES SMTP 用户名/密码**不等于** AWS access key，需要单独在 IAM 生成，且**按区域区分**；STARTTLS 用 25/587/2587，TLS Wrapper 用 465/2465；EC2 默认对 25 端口限流。来源：<https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html>

**[推断] Gmail 送达**：SES 共享 IP 池里混有大量低质量发信人，Gmail 侧对 SES 的观感通常不如专业事务邮件服务商；在极低量级下这不是致命问题，但也没有优势。真正的问题在运维成本：要绑卡、要申请转生产、SMTP 凭据按区域管理、SPF 默认不对齐自己域名。

**[推断] 对本项目的适配**：只在「本来就有 AWS 账号」时考虑。为一天几封登录邮件新开 AWS 账号不划算。

### 2.4 腾讯云 SES

**[事实] 额度**：每个账号 1000 封免费额度，不限有效期，用完转日结后付费；后付费 0.0019 元/封。来源：<https://cloud.tencent.com/document/product/1288/47930>

**[事实] 初始日额度**：新账号 500 封/天，可随信誉等级实时提升。来源：<https://cloud.tencent.com/document/product/1288/55127>

**[事实] 个人账号 SMTP 已关闭（关键）**：自北京时间 2026-03-02 00:00 起，**新增开通的个人实名认证用户不再支持 SMTP 协议发信**，只能用 API 或控制台；此前已开通的个人用户暂不受影响，企业认证用户不变。来源：<https://cloud.tencent.com/announce/detail/2212>

**[事实] 发信频率**：同一 appId 20 次/秒；**同一发信人对同一收信人 10 次/1 小时**。来源：<https://cloud.tencent.com/document/product/1288/65749>

**[事实] DNS 与域名**：需配置 MX、SPF、DKIM、DMARC，验证后须长期保持；不可使用企业邮箱域名；每账号最多 10 个域名；域名仅用于发信时**不强制备案**，但 A 记录指向大陆服务器则需要备案。来源：<https://cloud.tencent.com/document/product/1288/60652>、腾讯云 SES 常见问题 PDF <https://main.qcloudimg.com/raw/document/product/pdf/1288_52769_cn.pdf>

**[厂商宣传] 送达**：官网标称 `@gmail.com` 送达 97%。来源：<https://cloud.tencent.com/product/ses>。这是营销数字，不能当作验证结果。

**[推断] 对本项目的适配**：免费额度对本站完全够用（1000 封能用一年多），且服务器与备份已在腾讯云体系内，网络路径最顺。但个人账号 SMTP 关闭意味着**必须走 API**，而仓库现有的 `SMTP_*` 变量路线要改；且「同一发信人对同一收信人 10 次/小时」是硬上限，限流设计必须低于它（见第 4 节）。

### 2.5 阿里云 DirectMail

**[事实] 额度**：每个主账号**共 2000 封免费额度，每天最多免费发 200 封**；按量 2 元/千封（约 0.002 元/封）；资源包 1 万封 19.98 元 / 6 个月。来源：<https://help.aliyun.com/zh/direct-mail/billing-methods>

**[事实] 规格限制**：发信域名上限 5 个；发信地址 100 个（每月最多删 10 个）；初始日额度 2000 封，随信誉等级调整。来源：<https://help.aliyun.com/zh/direct-mail/product-overview/limits>

**[事实] SMTP 与频率**：SMTP 需先在控制台为「发信地址」单独设置 SMTP 密码；SMTP 频率上限 12000 次/180 秒（按账号维度）；单发 API 100 次/秒；**服务端不限制「同一发信人对同一收信人」的频率，需要自行约束**。来源：<https://help.aliyun.com/zh/direct-mail/getting-started/three-mail-sending-methods>

**[事实] DNS**：需配置域名所有权 TXT、SPF TXT（只能有一条，多出口 IP 需合并）、DKIM TXT、MX、DMARC；建议用子域，且不得与企业邮箱域名冲突。来源：<https://help.aliyun.com/zh/direct-mail/how-to-verify-if-the-configured-dns-resolution-takes-effect>、<https://www.alibabacloud.com/help/zh/direct-mail/domain-name-configuration-faqs/>

**[事实] 欠费**：账户欠费会导致所有发信功能不可用。来源：<https://help.aliyun.com/zh/direct-mail/billing-methods>

**[推断] 对本项目的适配**：功能与腾讯云接近，免费额度更宽（2000 封），SMTP 仍可用。但「同一收件人不限频」意味着限流全靠自己，反而更需要严格自限；另外国内云厂商对个人开通邮件推送通常有信誉等级与人工审核环节，实际可用性需要注册后实测（见第 6 节）。

### 2.6 SendGrid（结论：不推荐）

**[事实]** 免费计划已下线：2025-05-27 公告停止 Free Email API / Free Marketing 计划，过渡 60 天后免费账户发信暂停。新账号改为 **60 天试用，100 封/天**，之后必须升级；付费从 $19.95/月起。来源：<https://www.twilio.com/en-us/changelog/sendgrid-free-plan>、<https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan>、<https://www.twilio.com/en-us/products/email-api/pricing>

**[推断]** 60 天后要么付费要么断信，对一个每天几封的个人后台来说没有理由选它。

### 2.7 Gmail SMTP（零 DNS 的过渡方案）

**[事实]** 应用专用密码是 16 位，**只有开启了两步验证的账号才能创建**；改 Google 密码后应用专用密码会被吊销。来源：<https://support.google.com/accounts/answer/185833>

**[事实]** 个人 Gmail 每天上限约 500 个收件人 / 500 封，超限后 1–24 小时内恢复发送。来源：<https://support.google.com/mail/answer/22839>

**[推断]** 发信地址只能是该 Gmail 本身，所以登录邮件会以 `xxx@gmail.com` 发出，看起来像个人邮件而不是站点邮件；但对「发给站长自己」这个场景，它反而最不容易进垃圾箱（自己给自己发、域名信誉极高）。适合域名未定期间临时跑通流程，不适合长期正式形态。

---

## 3. 域名未定期间的过渡路径（这一节很关键）

工单 #2 还没定域名，而除 Gmail SMTP 外的所有方案都要求先有自有域名才能配 DKIM/SPF。三条可选过渡路径：

1. **Resend + `onboarding@resend.dev`**：官方限制是「只能发给 Resend 账号自己的邮箱」，而本站的收件人恰好**永远只有站长一个人**，所以这个限制在功能上不成立障碍。**[推断]** 这是最省事的过渡：注册即可发，不改 DNS。风险是 `resend.dev` 共享域名的信誉不可控，且一旦上线正式域名要重做一次配置。
2. **SES 沙箱 + 已验证的 Gmail 地址身份**：沙箱只允许发给已验证地址，同样被「只有一个收件人」化解，200 封/天足够。**[推断]** 代价是要开 AWS 账号并绑卡，不划算。
3. **Gmail SMTP + 应用专用密码**：零 DNS、零第三方账号，`SMTP_*` 变量直接可用。**[推断]** 作为「先让流程跑通」的临时方案最省事，但会把 Google 账号凭据放进服务器环境变量。

**[推断] 建议**：过渡期用方案 1 或 3 打通链路并做真实送达测试（第 6 节），域名定下来后立刻切到自有域名（Resend 或腾讯云 API）。

---

## 4. 关键问题：链接有效期、一次性、失败重试与限流

### 4.1 事实依据

- **[事实] OWASP**：token 必须用密码学安全随机数生成、足够长、安全存储、**一次性且会过期**；应对「按账号维度」的过量提交做限流，否则攻击者可以刷爆用户邮箱；对存在与不存在的账号返回一致的信息与一致的响应时间。来源：<https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- **[事实] Auth.js**：magic link token 只能使用一次，默认有效期 **1 天**，可通过 `maxAge` 配置；同一个用户可以有多个未过期的 token。来源：<https://authjs.dev/concepts/database-models>
- **[事实] Supabase**：magic link **一次性**；默认同一用户 **60 秒**才能再申请一次，链接 **1 小时**过期。来源：<https://supabase.com/docs/guides/auth/auth-email-passwordless>
- **[事实] 腾讯云 SES**：同一发信人对同一收信人的发信频率硬上限 **10 次/小时**。来源：<https://cloud.tencent.com/document/product/1288/65749>
- **[事实] Gmail 发信人要求**：所有发信人需配置 SPF 或 DKIM、使用 TLS、垃圾投诉率低于 0.3%；≥5000 封/天还需 SPF 与 DKIM 同时配置并加 DMARC（策略可为 `none`）。2025 年 11 月起 Gmail 对不合规流量的处置在加强。来源：<https://support.google.com/a/answer/81126>、<https://support.google.com/mail/answer/14229414>

### 4.2 建议值

| 项 | 建议值 | 依据 |
| --- | --- | --- |
| 链接有效期 | **30 分钟** | Auth.js 默认 24 小时太宽松；Supabase 1 小时偏长。站长点邮件是即时行为，30 分钟足够覆盖「先去垃圾箱找一下」的情况。**[推断]** |
| 一次性 | **消费即作废**，同一 token 只允许成功一次；作废通过数据库状态位而非删除记录（便于审计） | OWASP、Auth.js、Supabase 一致要求 **[事实]** |
| 并行 token | **只保留最新 1 个有效 token**，新申请使旧的失效 | Auth.js 允许并存多个，但那扩大了泄漏窗口；单用户后台没有多设备并发需求。**[推断]** |
| 申请冷却 | **同一邮箱 60 秒 1 次** | 与 Supabase 默认值一致 **[事实]**；低于腾讯云 10 次/小时硬上限 **[事实]** |
| 小时上限 | **同一邮箱 5 次/小时**、**10 次/天** | 5 < 腾讯云硬上限 10，留出余量给「重发 + 人工补发」。**[推断]** |
| IP 级限流 | **同一 IP 10 次/小时**，超限返回同一文案 | OWASP 要求防自动化刷信 **[事实]**；阈值是经验值 **[推断]** |
| 失败重试（发信） | 服务商 429/5xx 时**最多重试 2 次**，指数退避（1s、4s）；4xx 参数错误不重试，直接提示失败 | **[推断]**，依据是 Resend 429 语义与幂等键设计 **[事实]**：<https://resend.com/docs/send-with-smtp> |
| 失败重试（链接消费） | 过期/已用**不自动重发**，页面给「重新发送登录链接」按钮 | 自动重发会让「点错链接」变成无限循环，且放大发信量。**[推断]** |
| 链接消费方式 | 邮件里的链接走 **GET 落地页**，页面上的「确认登录」按钮走 **POST** 才真正消费 token | 邮件安全网关会预取链接，GET 直接消费会导致链接「还没点就失效」。**[推断]**，无官方文档依据，但这是同类系统的常见做法 |
| token 存储 | 只存 **SHA-256 哈希**，不存明文 | OWASP「安全存储」**[事实]**，具体算法是 **[推断]** |
| 会话有效期 | **30 天**，滚动续期；退出登录立即失效 | 单人后台，30 天免登录体验合理；安全性由「只允许一个邮箱」兜底。**[推断]** |
| 登录入口暴露 | 只对 `ADMIN_EMAIL` 有效，其他邮箱一律返回同一句「如果该邮箱可登录，我们已发送」 | OWASP 防枚举 **[事实]** |

### 4.3 明确不建议的做法

- 不要把有效期设成 24 小时（Auth.js 默认值）。邮件一旦被转发或长期留在收件箱，链接就成了长期后门。
- 不要允许多个链接同时有效且都能用。
- 不要在登录链接里带上「自动登录并跳转」的一步式 GET 消费。
- 不要把限流做成只在前端做（前端限流等于没有）。

---

## 5. 部署时需要提供的配置项清单

共 **20 条**：沿用现有 5 条（`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`），新增 15 条。

### 5.1 服务商与凭据（7 条）

| 变量 | 必需 | 说明 / 示例 |
| --- | --- | --- |
| `MAIL_PROVIDER` | 是 | 选路：`resend` / `postmark` / `ses` / `smtp`。决定走 API 还是 SMTP |
| `MAIL_API_KEY` | 条件 | 走 API 时的凭据。Resend 填 `re_...`；Postmark 填 Server API Token；走纯 SMTP 可留空 |
| `SMTP_HOST` | 条件 | 现有变量。Resend `smtp.resend.com`；Postmark `smtp.postmarkapp.com`；腾讯云按区域取 `gz-smtp.qcloudmail.com`（广州）/ `smtp.qcloudmail.com`（香港）/ `sg-smtp.qcloudmail.com`（国际站） |
| `SMTP_PORT` | 条件 | 现有变量。建议 `587`（STARTTLS）或 `465`（隐式 TLS） |
| `SMTP_USER` | 条件 | 现有变量。Resend 固定 `resend`；Postmark 填 Server API Token；阿里云填发信地址 |
| `SMTP_PASSWORD` | 条件 | 现有变量。Resend 填 API Key；Postmark 填同一个 Server API Token；阿里云填单独设置的 SMTP 密码 |
| `SMTP_SECURE` | 是 | `true` 表示 465 隐式 TLS，`false` 表示 587 STARTTLS。现有代码没有这个开关，必须补 |

### 5.2 发信身份（2 条）

| 变量 | 必需 | 说明 / 示例 |
| --- | --- | --- |
| `SMTP_FROM` | 是 | 现有变量。建议 `"Lawson 的网站" <login@mail.example.com>`，子域名发信以隔离信誉 |
| `MAIL_REPLY_TO` | 否 | 回复地址，例如 `lawson@example.com`。登录邮件不需要收回复，可留空 |

### 5.3 站点与登录（7 条）

| 变量 | 必需 | 说明 / 示例 |
| --- | --- | --- |
| `APP_BASE_URL` | 是 | 生成登录链接的绝对前缀，必须 https 公网可达，例如 `https://example.com`。**不能从 `APP_DOMAIN` 推导**，因为域名未定时它可能是 IP 或临时隧道 |
| `AUTH_SECRET` | 是 | 会话与 token 签名密钥，32 字节随机值（`openssl rand -base64 32`） |
| `ADMIN_EMAIL` | 是 | 唯一允许申请登录的邮箱（站长的 Gmail） |
| `MAGIC_LINK_TTL_MINUTES` | 是 | 建议 `30` |
| `MAGIC_LINK_COOLDOWN_SECONDS` | 是 | 建议 `60` |
| `MAGIC_LINK_MAX_PER_HOUR` | 是 | 建议 `5` |
| `SESSION_TTL_DAYS` | 是 | 建议 `30` |

### 5.4 安全开关与观测（4 条，可选）

| 变量 | 必需 | 说明 / 示例 |
| --- | --- | --- |
| `MAIL_DRY_RUN` | 否 | `true` 时只记录不发送，用于演练部署 |
| `MAIL_OVERRIDE_TO` | 否 | 把所有邮件重定向到该地址，用于 staging 验证 |
| `MAIL_WEBHOOK_SECRET` | 否 | 接收服务商投递/退信 webhook 时的校验密钥 |
| `ALERT_EMAIL` | 否 | 发信连续失败时的告警收件地址 |

**DNS 侧另外需要准备的（不属于环境变量，但部署清单要写）**：SPF、DKIM、DMARC 三条记录的具体值全部由服务商控制台生成，无法预先填写；`MAIL_FROM` 所在的子域必须与 DKIM 的 `d=` 域一致，否则 DMARC 对齐失败。

---

## 6. 我无法验证的部分与验证方法

| 无法验证的事 | 为什么 | 验证方法 |
| --- | --- | --- |
| **真实 Gmail 送达率（进收件箱还是垃圾箱）** | 需要真实发信 + 真实收件箱；文档只能说明「满足最低认证要求」 | 按第 3 节选定过渡方案后，发一封真实登录邮件到站长 Gmail，检查：是否进收件箱、`显示原始邮件` 中 `spf=pass` / `dkim=pass` / `dmarc=pass`、`Authentication-Results` 里有无 Gmail 自己的判定。连续 7–14 天每天 1–3 封观察是否稳定 |
| **新域名预热后的信誉变化** | 需要时间与实际发信量 | 在 Google Postmaster Tools 加域名并验证（TXT 或 CNAME），看垃圾投诉率与信誉面板；注意低发信量时面板可能长期显示「无数据」。来源：<https://support.google.com/mail/answer/9981691> |
| **各家 DKIM/SPF 记录的具体值** | 由服务商控制台按账号生成 | 配置后逐条 `dig TXT` / `dig CNAME` 校验，再点服务商的 Verify |
| **国内服务器到服务商的网络可达性与延迟** | 我没有生产服务器访问权；`docs/operations.md` 显示备份走腾讯云 COS，服务器可能在大陆 | 在服务器上 `curl -sS -o /dev/null -w '%{time_total}\n' https://api.resend.com` 与 `openssl s_client -connect smtp.resend.com:587 -starttls smtp` 各测一次；若 587 被云厂商安全组/运营商拦截，改用 465 或 API |
| **腾讯云/阿里云对个人账号开通邮件推送的审核结果与初始信誉等级** | 需实际注册、实名、提交申请 | 注册后看控制台「信誉等级」与日额度；腾讯云还要确认自己是否属于 2026-03-02 之后新开通的个人号（若是，SMTP 不可用，只能走 API） |
| **邮件安全网关是否会预取登录链接导致误消费** | 取决于收件方网关 | 用真实 Gmail 收件并观察：若链接在未点击时就被消费，说明必须改成 POST 消费（第 4.2 节已按此建议设计） |
| **价格与免费额度长期不变** | 已见 SendGrid 取消免费计划、Resend 调整免费额度 | 决策落地前复核一次官方价格页，并在此文档记录复核日期 |
| **需求共识第 3、6 节的约束** | `docs/requirements-consensus.md` 在 `main` 上不存在（404） | 补齐该文档，或由站长直接确认第 4 节的参数是否可接受 |

---

## 7. 推荐结论

**[推断] 首选：Resend（API 为主，SMTP 兜底）。** 理由：免费额度（3,000 封/月、100 封/天）远超本站需求；免费档就含 DKIM/SPF/DMARC 与 webhook；API 与 SMTP 都有，且 Auth.js 有现成 provider；限流与错误语义清晰（429 + 幂等键）。风险是它相对年轻，需要第 6 节的真实送达测试兜底。

**次选：腾讯云 SES（走 API）。** 理由：服务器与备份已在腾讯云体系内，1000 封免费额度够用一年多，网络路径最短。代价是个人新号没有 SMTP，必须写 API 调用，并且要接受「同一收件人 10 次/小时」的硬上限。

**备选：Postmark。** 功能最贴合事务邮件，但免费 100 封/月卡得太紧，等于必须上 $15/月。

**不推荐：SendGrid**（免费计划已取消）、**Amazon SES**（为每天几封邮件开 AWS 账号并申请转生产，收益不匹配运维成本）。

**过渡期**（域名未定）：Resend + `onboarding@resend.dev` 或 Gmail SMTP + 应用专用密码，先把链路和送达测试跑通；域名一确定立刻切到 `mail.<域名>` 子域。

---

## 8. 来源清单

官方文档（按引用顺序）

1. Resend 定价：<https://resend.com/pricing>
2. Resend 添加域名：<https://resend.com/docs/add-a-domain>
3. Resend 已验证域名：<https://resend.com/docs/dashboard/domains/introduction>
4. Resend DMARC：<https://resend.com/docs/dashboard/domains/dmarc>
5. Resend SMTP：<https://resend.com/docs/send-with-smtp>
6. Resend API 简介与限流：<https://resend.com/docs/api-reference/introduction>
7. Resend 错误码：<https://resend.com/docs/api-reference/errors>
8. Postmark 定价：<https://postmarkapp.com/pricing>
9. Postmark 域名验证：<https://postmarkapp.com/support/article/1046-how-do-i-verify-a-domain>
10. Postmark SMTP：<https://postmarkapp.com/developer/user-guide/send-email-with-smtp>
11. Amazon SES 转生产：<https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html>
12. Amazon SES 定价：<https://aws.amazon.com/ses/pricing/>
13. Amazon SES 身份验证：<https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html>
14. Amazon SES DKIM：<https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html>
15. Amazon SES SMTP 凭据：<https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html>
16. 腾讯云 SES 价格说明：<https://cloud.tencent.com/document/product/1288/47930>
17. 腾讯云 SES 规格明细：<https://cloud.tencent.com/document/product/1288/55127>
18. 腾讯云 SES 个人用户 SMTP 权限调整公告：<https://cloud.tencent.com/announce/detail/2212>
19. 腾讯云 SES SMTP 发信指南：<https://cloud.tencent.com/document/product/1288/65749>
20. 腾讯云 SES 身份验证与配置：<https://cloud.tencent.com/document/product/1288/60652>；SMTP 服务地址：<https://cloud.tencent.com/document/product/1288/65750>
21. 腾讯云 SES 产品页：<https://cloud.tencent.com/product/ses>
22. 阿里云 DirectMail 计费方式：<https://help.aliyun.com/zh/direct-mail/billing-methods>
23. 阿里云 DirectMail 规格清单：<https://help.aliyun.com/zh/direct-mail/product-overview/limits>
24. 阿里云 DirectMail 三种发送方式：<https://help.aliyun.com/zh/direct-mail/getting-started/three-mail-sending-methods>
25. 阿里云 DirectMail DNS 配置校验：<https://help.aliyun.com/zh/direct-mail/how-to-verify-if-the-configured-dns-resolution-takes-effect>
26. 阿里云 DirectMail 域名配置 FAQ：<https://www.alibabacloud.com/help/zh/direct-mail/domain-name-configuration-faqs/>
27. Twilio SendGrid 免费计划下线公告：<https://www.twilio.com/en-us/changelog/sendgrid-free-plan>
28. Twilio SendGrid 升级计划：<https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan>
29. Twilio Email API 定价：<https://www.twilio.com/en-us/products/email-api/pricing>
30. Gmail 发信人指南：<https://support.google.com/a/answer/81126>
31. Gmail 发信人指南 FAQ：<https://support.google.com/mail/answer/14229414>
32. Google Postmaster Tools 设置：<https://support.google.com/mail/answer/9981691>
33. Gmail 应用专用密码：<https://support.google.com/accounts/answer/185833>
34. 个人 Gmail 发信限制：<https://support.google.com/mail/answer/22839>
35. OWASP 忘记密码备忘单：<https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
36. Auth.js 邮件登录：<https://authjs.dev/getting-started/authentication/email>
37. Auth.js 数据库模型（VerificationToken）：<https://authjs.dev/concepts/database-models>
38. Supabase 无密码登录：<https://supabase.com/docs/guides/auth/auth-email-passwordless>

仓库内依据

- `docs/operations.md`、`.env.example`、`.env.production.example`、`compose.yaml`、`compose.prod.yaml`、`scripts/deploy.sh`、`deploy/backup.env.example`、`prisma/schema.prisma`
- GitHub issue #1、#2、#3、#12（仓库 lawson-yu/lawson-website）
