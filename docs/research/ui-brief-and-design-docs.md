# UI brief 与 design.md：职责和记录位置

> 用于讨论 Wayfinder 决策票。本文汇总一手来源，并给出适合本项目的建议；`UI brief` 与 `design.md` 不是由某个统一标准规定的固定文档类型。

## 结论摘要

- **Brief 说明要解决什么、为谁解决、范围和约束是什么；设计说明记录方案如何呈现和运作。** 这是便于协作的职责划分建议，不是行业强制模板。GOV.UK 将 styles、components、patterns 分别作为设计系统内容，并在模式中解释适用情境与设计理由，可作为把目标、规则和具体页面模式分层表达的实例。[GOV.UK Design System](https://design-system.service.gov.uk/)；[Navigate a service pattern](https://design-system.service.gov.uk/patterns/navigate-a-service/)
- **只把 brief 记在 Issue 里可以支持一次决策讨论，但作为长期设计规范通常不够。** GitHub 说明 Issues 适用于具体事项的计划、讨论（包括新设计），并有讨论历史；仓库 Markdown 则有文件版本与逐行历史。建议 Issue 记录决定、未决问题、负责人/后续动作，并链接至仓库中的当前设计说明。[GitHub: planning and tracking work](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/planning-and-tracking-work-for-your-team-or-project)；[GitHub: viewing file history](https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files)
- **建议 V1 覆盖公开站点与仅站长可用的后台**，并让决策讨论与长期指导内容各有明确归属。采用 Impeccable 时，优先使用其 `PRODUCT.md`、`DESIGN.md` 和按需创建的页面 brief，避免重复维护相同内容。

## 两份文档各写什么

| 文档 | 回答的问题 | 本项目建议包含 |
| --- | --- | --- |
| `UI brief` | 为什么做、谁会用、包含什么、成功是什么？ | 项目目标与用户；V1 范围（首页、博客列表/详情、站长后台）；访客与站长的核心任务；中英文内容/切换需求；优先级和成功条件；已知约束（Next.js、Tailwind、shadcn/ui）；明确暂不处理的范围。保持简短，作为启动设计和实现的共同依据。 |
| `design.md` | 选定的 UI 方案具体如何呈现、响应和交互？ | 信息架构与页面/布局；视觉方向及设计令牌（颜色、字体、间距）；导航与组件约定；公开页和后台关键状态（空、加载、错误、成功、窄屏）；双语行为与长短文本考虑；键盘、焦点、对比度及语义要求；关键取舍及链接到原型/实现。记录真正影响多页一致性或实现的决定，避免抄写组件库文档。 |

这里的划分是**实用建议**：可在决策时裁剪。项目有双语页面，WCAG 2.2 要求页面的默认语言可程序化确定，且适用时内容片段的语言也可程序化确定；四项原则为可感知、可操作、可理解、健壮。把语言行为和可访问性约束写入 brief 的验收目标，并在 design.md 写清页面/组件如何满足它们，是本项目的落地建议。[WCAG 2.2](https://www.w3.org/TR/WCAG22/)；[Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page)；[Language of Parts](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts.html)

另一个重要限制：使用 shadcn/ui 或其他设计系统组件本身不等于成品已可访问。GOV.UK 明确指出，采用其设计系统仍需要额外的研究、设计、开发和测试；因此文档中的可访问性要求应落实到本站页面与交互。[GOV.UK accessibility strategy](https://design-system.service.gov.uk/accessibility/accessibility-strategy/)

## 与 Impeccable 对齐

用户计划在项目级使用 [Impeccable](https://github.com/pbakaus/impeccable)。该项目定义了自己的上下文文件和命名约定，因此建议采用其原生文件，避免另建同义文档：

- 根目录 `PRODUCT.md`：产品事实、目标用户、约束、证据和可访问性等。Impeccable 的 `init` 会维护此文件，并明确不把视觉世界、配色、组件或页面概念写在这里。
- 根目录 `DESIGN.md`：当前视觉系统与组件规范。Impeccable 的 `document` 生成或维护它，采用带可选 YAML token frontmatter 的 Markdown 结构。
- `.impeccable/surfaces/<surface>.md`：具体页面或功能的 brief，记录目标、用户、成功标准、方向、范围、状态、交互和约束。Impeccable 将这些文件作为项目共享产物。

来源：[Impeccable README](https://github.com/pbakaus/impeccable)、[`init` 参考](https://github.com/pbakaus/impeccable/blob/main/skill/reference/init.md)、[`document` 参考](https://github.com/pbakaus/impeccable/blob/main/skill/reference/document.md)、[`shape` 参考](https://github.com/pbakaus/impeccable/blob/main/skill/reference/shape.md)。这些路径和职责是 Impeccable 的约定；它们不是通用标准。

基于此，本项目可以让 Wayfinder Issue 保存决策讨论与决议，由 `PRODUCT.md` 保存稳定的产品事实、`DESIGN.md` 保存跨页面设计系统，并在实际设计各页面时按需建立 surface brief。是否需要一份独立的站点级 `ui-brief.md`，应以是否有不属于 `PRODUCT.md` 或各 surface brief 的内容为准；避免复制 Issue #2 的验收细节或重复维护同一条设计规则。

本仓库没有现存 UI 规格或研究目录约定；本次研究笔记放在 `docs/research/`。

## Issue 还是仓库 Markdown？

| 位置 | 适合记录 | 主要取舍 |
| --- | --- | --- |
| GitHub Issue | 决策题目、背景摘要、备选方案、讨论、决定/未决项、负责人和行动项 | 讨论与进度集中、可评论并链接工作；但持续追加讨论容易让当前有效规范与历史意见混在一起。 |
| 仓库 Markdown | 已采纳、会指导多个页面/实现的 brief 和设计约定 | 与代码同仓、可随代码审阅、按 Git 查看版本；需要有人维护更新，规范也可能随代码迭代。 |

**推荐的最小做法：两处分工并互链。** Issue 作为决策入口和讨论记录；决策完成后，把稳定的 brief/design 结论写入仓库 Markdown，并在 Issue 留下结论摘要和链接。若某一份材料只服务于单次讨论、不会指导后续实现或跨页面复用，直接放 Issue 也足够。GitHub 官方还提供 Issue artifacts，可附 Markdown 研究或设计文档并保留变更记录；如团队更重视 Issue 内聚，可考虑，但应确认该功能在使用时的可用状态与工作流，再决定是否依赖。[GitHub: Issue artifacts](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/using-artifacts-with-issues)

## 来源范围

以上链接均为标准组织、政府设计系统或 GitHub 官方文档。来源说明其自身标准/功能；brief 与 design.md 的职责分界、目录结构及推荐记录方式是针对本项目规模的综合建议，不声称为统一行业标准。
