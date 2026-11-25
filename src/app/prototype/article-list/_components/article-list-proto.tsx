"use client";

// 文章列表原型（issue #30）：卡片网格方案 + 共用 chrome 与状态工具条。

import { useSearchParams } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import "./proto.css";
import { ArticleMagazine } from "./article-magazine";
import { ProtoChrome } from "./proto-chrome";
import { HEADINGS, type HeadingVariant } from "./magazine-heading";
import { useArticleListState, type ListState } from "./list-state";

function DetailStub({ list }: { list: ListState }) {
  const article = list.detail!;
  return (
    <main className="proto-detail">
      <button className="proto-detail__back" onClick={list.back}>
        ← 返回文章列表
      </button>
      <h1>{article.title}</h1>
      <p className="proto-detail__meta">
        Lawson · <time dateTime={article.date}>{article.date}</time> · {article.tags.join(" · ")}
      </p>
      <p className="proto-detail__body">
        正文占位。详情页的形态见原型工单 #31，这里只用来验证返回后条件、页码与原条目定位的呈现。
      </p>
    </main>
  );
}

export function ArticleListProto() {
  const list = useArticleListState();
  const [headingRun, setHeadingRun] = useState(0);
  const params = useSearchParams();
  const variant = HEADINGS.find(heading => heading.id === params.get("variant"))?.id ?? "B";

  function selectHeading(next: HeadingVariant) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    url.hash = "";
    window.history.replaceState(null, "", url);
    if (next === variant) setHeadingRun(run => run + 1);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function cycleHeading(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = HEADINGS.findIndex(heading => heading.id === variant);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + step + HEADINGS.length) % HEADINGS.length;
    selectHeading(HEADINGS[next].id);
    event.currentTarget.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div className="proto-root">
      <ProtoChrome />
      {list.detail ? <DetailStub list={list} /> : <ArticleMagazine list={list} variant={variant} headingRun={headingRun} />}
      <aside className="proto-switch" aria-label="原型工具">
        <div className="proto-switch__row"><span className="proto-switch__label">文章列表原型</span><span className="proto-switch__state">连续浏览 · {list.total} 篇</span></div>
        {!list.detail && process.env.NODE_ENV !== "production" && (
          <div className="mag-heading-options" role="group" aria-label="页头方案" onKeyDown={cycleHeading}>
            {HEADINGS.map(heading => <button key={heading.id} type="button" aria-pressed={variant === heading.id} onClick={() => selectHeading(heading.id)}>{heading.id} {heading.name}</button>)}
            <button type="button" onClick={() => selectHeading(variant)}>重播动效</button>
          </div>
        )}
        <div className="proto-switch__row proto-switch__row--presets"><button onClick={list.clear}>清除筛选</button></div>
      </aside>
    </div>
  );
}
