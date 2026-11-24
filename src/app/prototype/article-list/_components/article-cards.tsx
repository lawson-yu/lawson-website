"use client";

// 文章列表（issue #30）：按站长给的卡片网格方案改写到本站的色调与字体，
// 并补齐筛选、空状态、分页与返回定位。

import { ArrowUpRight, CalendarDays, Search } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";
import { describeConditions, type ListState } from "./list-state";
import { TAGS } from "./mock-articles";

export function ArticleCards({ list, covers }: { list: ListState; covers: boolean }) {
  const baseId = useId();
  const tabs = ["全部", ...TAGS.map((tag) => tag.name)];
  const activeIndex = list.tag ? tabs.indexOf(list.tag) : 0;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const conditions = describeConditions(list);

  const pick = (index: number) => {
    list.pickTag(index === 0 ? null : tabs[index]);
    tabRefs.current[index]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    if (event.key === "ArrowRight") pick(index === last ? 0 : index + 1);
    else if (event.key === "ArrowLeft") pick(index === 0 ? last : index - 1);
    else if (event.key === "Home") pick(0);
    else if (event.key === "End") pick(last);
    else return;
    event.preventDefault();
  };

  return (
    <main className="ac">
      <header className="ac-head">
        <h1>文章</h1>
        <p className="ac-head__count">共 {list.total} 篇</p>
      </header>

      <div className="ac-bar">
        <div className="ac-tabs-wrap">
          <div className="ac-tabs" role="tablist" aria-label="按标签筛选">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-controls={`${baseId}-results`}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => list.pickTag(index === 0 ? null : tab)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="ac-search">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            aria-label="搜索文章"
            placeholder="搜索标题、摘要和正文"
            value={list.q}
            onChange={(event) => list.search(event.target.value)}
          />
        </div>
      </div>

      <div id={`${baseId}-results`} role="tabpanel" aria-live="polite" className="ac-results">
        {list.items.length === 0 ? (
          <div className="ac-empty">
            <p className="ac-empty__title">没有匹配的文章</p>
            <p className="ac-empty__note">
              {conditions.length ? `${conditions.join(" · ")}下没有结果。` : "当前条件下没有结果。"}
            </p>
            <button className="ac-primary" onClick={list.clear}>
              清除筛选
            </button>
          </div>
        ) : (
          <ul className="ac-grid">
            {list.items.map((article) => (
              <li
                key={article.slug}
                id={`article-${article.slug}`}
                className="ac-card"
                data-restored={list.restored === article.slug || undefined}
              >
                {covers ? (
                  <div className="ac-card__cover">
                    {article.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.cover} alt="" loading="lazy" />
                    ) : null}
                  </div>
                ) : null}

                <div className="ac-card__body">
                  <div className="ac-card__meta">
                    <span className="ac-card__date">
                      <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                      <time dateTime={article.date}>{article.date}</time>
                    </span>
                    <span className="ac-card__pills">
                      {article.tags.map((tag) => (
                        <button key={tag} className="ac-pill" onClick={() => list.pickTag(tag)}>
                          {tag}
                        </button>
                      ))}
                    </span>
                  </div>

                  <h2 className="ac-card__title">
                    <button onClick={() => list.open(article)}>{article.title}</button>
                  </h2>
                  <p className="ac-card__summary">{article.summary}</p>

                  <div className="ac-card__foot">
                    <button
                      className="ac-card__go"
                      aria-label={`阅读：${article.title}`}
                      onClick={() => list.open(article)}
                    >
                      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {list.pageCount > 1 && (
        <nav className="ac-pager" aria-label="分页">
          <button disabled={list.page === 1} onClick={() => list.goPage(list.page - 1)}>
            上一页
          </button>
          <span className="ac-pager__nums">
            {Array.from({ length: list.pageCount }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                aria-current={number === list.page ? "page" : undefined}
                onClick={() => list.goPage(number)}
              >
                {number}
              </button>
            ))}
          </span>
          <span className="ac-pager__compact">
            {list.page} / {list.pageCount}
          </span>
          <button disabled={list.page === list.pageCount} onClick={() => list.goPage(list.page + 1)}>
            下一页
          </button>
        </nav>
      )}
    </main>
  );
}
