"use client";

// 一次性原型：比较宽封面、并排与单栏三种文章详情布局。
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { MagazineCloud } from "../../article-list/_components/magazine-cloud";
import { ARTICLES, type Article } from "../../article-list/_components/mock-articles";
import "../../article-list/_components/magazine-heading.css";
import "./article-detail.css";

const LIST = "/prototype/article-list";
const VARIANTS = [
  { id: "A", name: "宽幅封面" },
  { id: "B", name: "图文并排" },
  { id: "C", name: "单栏阅读" },
] as const;
const SAMPLES = [
  { id: "feature", name: "有封面长文", article: ARTICLES[0] },
  { id: "short", name: "无封面短文", article: ARTICLES[1] },
  { id: "long-title", name: "长标题", article: ARTICLES[2] },
] as const;

const ACCEPTANCE = [
  { id: "observable", title: "先写出看得见的结果", text: "拿一个常见的需求举例：从搜索结果点开文章，读完再返回。让模型先说清楚访客返回时应该看到什么。搜索词和标签要留在原位，已经加载过的结果仍能浏览，刚读完的文章要出现在视野里。" },
  { id: "assertions", title: "把结果写成断言", text: "确认场景之后，再挑最容易漏掉的行为落成断言。这里验证筛选仍然生效，以及刚刚打开的文章确实进入了视野。", sub: "一个浏览器测试示例" },
  { id: "review", title: "用场景收尾", text: "交付前从带筛选的列表走一遍，再从分享链接打开同一篇文章。前者恢复阅读前的位置，后者回到默认列表。把这两条路径一起走完，比单独检查返回按钮有用。" },
];
const KNOWLEDGE = [
  { id: "naming", title: "先让文件名可检索", text: "把目录按工作场景组织，文件名尽量保留会出现在检索词里的动词。每份笔记留一行来源和日期，免得迁移之后找不到原文。" },
  { id: "chunks", title: "让切片保留上下文", text: "按标题切分，再把上级标题附在每个片段上。在搜索结果里只看一个片段，也能知道它回答的是什么问题。", sub: "把标题路径随片段一起保存" },
  { id: "recall", title: "用真实问题检查召回", text: "取几条最近做过的任务作为测试问题，记下希望命中的笔记。每次调整切分策略后重跑，逐条看看漏掉了哪一份资料。" },
];

export function ArticleDetail({ article, onBack, onTag }: {
  article?: Article;
  onBack?: (restoreFocus: boolean) => void;
  onTag?: (tag: string) => void;
}) {
  const params = useSearchParams();
  const variantParam = article ? "detailVariant" : "variant";
  const index = Math.max(0, VARIANTS.findIndex(({ id }) => id === params.get(variantParam)));
  const variant = VARIANTS[index];
  const sample = SAMPLES.find(({ id }) => id === params.get("sample"));
  const current = article ?? sample?.article ?? SAMPLES[0].article;
  const short = current === SAMPLES[1].article;
  const longTitle = current === SAMPLES[2].article;
  const sections = current === SAMPLES[0].article ? ACCEPTANCE : longTitle ? KNOWLEDGE : [];
  const title = useRef<HTMLHeadingElement>(null);

  const fromList = Boolean(onBack);
  useEffect(() => {
    if (fromList) {
      window.scrollTo({ top: 0, behavior: "instant" });
      title.current?.focus({ preventScroll: true });
    }
  }, [fromList]);

  function select(key: string, value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    url.hash = "";
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function cycle(step: number) {
    select(variantParam, VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length].id);
  }

  const back = (label: string, arrow: "left" | "right") => {
    const content = arrow === "left"
      ? <><ArrowLeft size={17} aria-hidden="true" />{label}</>
      : <>{label}<ArrowUpRight size={17} aria-hidden="true" /></>;
    return onBack
      ? <button className="reading-link" onClick={event => onBack(event.detail === 0)}>{content}</button>
      : <a className="reading-link" href={LIST}>{content}</a>;
  };

  const contents = <ul>{sections.map(section => <li key={section.id}>
    <a href={`#${section.id}`}>{section.title}</a>
    {section.sub && <ul><li><a href={`#${section.id}-example`}>{section.sub}</a></li></ul>}
  </li>)}</ul>;

  return (
    <main className={`reading reading--${variant.id.toLowerCase()}`}>
      <article lang={current.lang}>
        <header className="reading-hero" data-cover={!short || undefined}>
          <div className="reading-hero__art"><MagazineCloud variant="B" personScale={1.0625} /></div>
          <div className="reading-shell reading-opening">
            <div className="reading-title">
              {back("返回文章列表", "left")}
              <h1 ref={title} tabIndex={-1}>{current.title}</h1>
              <p className="reading-byline"><span>Lawson</span><time dateTime={current.date}>{current.date}</time></p>
              <div className="reading-tags" aria-label="文章标签">
                {current.tags.map(tag => onTag
                  ? <button key={tag} onClick={() => onTag(tag)}>{tag}</button>
                  : <a key={tag} href={`${LIST}?tag=${encodeURIComponent(tag)}#mag-articles`}>{tag}</a>)}
              </div>
            </div>
            {!short && <figure className="reading-cover">
              {/* 示例封面用于测试布局，文章标题已单独提供。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.cover} alt="" />
            </figure>}
          </div>
        </header>
        <div className="reading-shell reading-layout">
          {sections.length >= 2 && (
            <>
              <nav className="reading-toc" aria-label="文章目录"><p>文章目录</p>{contents}</nav>
              <details key={current.slug} className="reading-toc--mobile">
                <summary>文章目录 <ChevronDown size={16} aria-hidden="true" /></summary>
                <nav aria-label="文章目录">{contents}</nav>
              </details>
            </>
          )}
          <div className="reading-prose">
            <p className="reading-lede">{current.summary}</p>
            {short && <p>我现在会在提示词末尾写下一条可以从头走完的操作路径，再补上一个容易漏掉的结果。比如「改完筛选逻辑后，重新打开带有失效标签的旧书签，确认关键词还在」。下次继续同一个任务时，这句话也能帮我找回当时的判断。</p>}
            {sections.map(section => <section key={section.id}>
              <h2 id={section.id}>{section.title}</h2>
              <p>{section.text}</p>
              {section.sub && <>
                <h3 id={`${section.id}-example`}>{section.sub}</h3>
                <div className="reading-code">
                  <div>{longTitle ? "JSON" : "TypeScript"}</div>
                  <pre tabIndex={0} aria-label="示例代码，可横向滚动"><code>{longTitle
                    ? '{\n  "source": "notes/workflows/acceptance-scenarios.md",\n  "headingPath": ["AI 工作流", "准备验收场景", "从搜索结果返回原来的文章位置"]\n}'
                    : 'await expect(page.getByRole("searchbox", { name: "搜索文章" })).toHaveValue("验收");\nawait expect(page.getByRole("button", { name: "AI 编程", pressed: true })).toBeVisible();\nawait expect(page.getByRole("button", { name: /如何让 AI 先写验收场景/ })).toBeInViewport();'}</code></pre>
                </div>
              </>}
              {section.id === "assertions" && <figure className="reading-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/prototype/covers/cover-3.webp" alt="桌面上的手机和笔记本电脑" loading="lazy" />
                <figcaption>在手机和桌面浏览器里各走一遍返回路径。</figcaption>
              </figure>}
            </section>)}
            <footer className="reading-end">{back("继续浏览文章", "right")}</footer>
          </div>
        </div>
      </article>
      {process.env.NODE_ENV !== "production" && <aside className="reading-switch" aria-label="文章详情原型工具" onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }}>
        <div className="reading-switch__layout">
          <button onClick={() => cycle(-1)} aria-label="上一个布局"><ChevronLeft size={18} /></button>
          <span aria-live="polite">{variant.id} · {variant.name}</span>
          <button onClick={() => cycle(1)} aria-label="下一个布局"><ChevronRight size={18} /></button>
        </div>
        {!article && <div className="reading-switch__samples" role="group" aria-label="示例文章">
          {SAMPLES.map(item => <button key={item.id} onClick={() => select("sample", item.id)} aria-pressed={current === item.article}>{item.name}</button>)}
        </div>}
      </aside>}
    </main>
  );
}
