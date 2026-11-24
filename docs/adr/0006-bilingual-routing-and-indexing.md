# 公开界面走 /[locale] 前缀，收录信号按正文语言声明

公开界面统一挂在 `/[locale]` 下，只接受 `zh` 与 `en`，其它值 404；根路径 `/` 301 到 `/zh`，不做 `Accept-Language` 协商。`/admin`、`/api/*` 与媒体地址不套 locale。界面文案用 `next-intl` 4.16.x，locale 通过 `next/root-params` 读取——它不经过 `headers()`，因此能在 `use cache` 作用域内取到。

同一份内容在两种界面语言下都能打开，但 canonical 指向正文语言那一侧；`alternates.languages` 输出 `zh`、`en` 与 `x-default`（= 正文语言侧）。必须关掉 next-intl 的 `alternateLinks`：它默认假设两种语言的路径内容等价，与 ADR 0001 的「一份内容、两种界面」语义不同，开着会输出错误的收录信号。`<html lang>` 跟界面语言，文章正文另用 `lang` 标正文语言，`og:locale` 跟正文语言。

语言切换停留当前页面并保留列表条件，查询串要自己用 `usePathname()` + `useSearchParams()` 拼，库不会自动保留。

## 考虑过的替代方案

- **`Accept-Language` 协商**：同一个 URL 出两种结果，缓存与分享预览都变复杂；首版没有 CDN 层，不需要。
- **`paraglide`**：类型最强，但必须走 webpack 插件，与当前的 Turbopack 配置冲突。
- **自写字典**（约 50 行 `as const` + key 对齐测试）：本项目只翻界面文案、只有两种语言，其实更省；选 next-intl 是为了 ICU 复数/富文本与类型化 key。

## 后果

- Next 16 的 `middleware.ts` 已改名为 `proxy.ts` 并跑在 Node 运行时；locale 前缀与根跳转都放在这里。
- `next/root-params` 在 Route Handler 与 Server Action 里不生效，这些地方要显式传 locale。
