"use client";

// 方案 B · 面板：每条是一块面板，筛选收在一条玻璃栏里，标签走下拉面板，分页只给前后与页码。

import { useRef } from "react";
import { describeConditions, type ListState } from "./list-state";
import { TAGS } from "./mock-articles";

export function VariantB({ list }: { list: ListState }) {
  const conditions = describeConditions(list);
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menu.current?.removeAttribute("open");

  return (
    <main className="vb">
      <header className="vb-head">
        <h1>文章</h1>
        <p className="vb-head__count">共 {list.total} 篇</p>
      </header>

      <div className="vb-bar">
        <form
          className="vb-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            list.submit();
          }}
        >
          <input
            aria-label="搜索文章"
            placeholder="搜索标题、摘要和正文"
            value={list.draft}
            onChange={(event) => list.setDraft(event.target.value)}
          />
          <button type="submit">搜索</button>
        </form>

        <details
          className="vb-menu"
          ref={menu}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          <summary>
            {list.tag ?? "全部标签"}
            <span aria-hidden="true">▾</span>
          </summary>
          <div className="vb-menu__panel">
            <button
              aria-pressed={!list.tag}
              onClick={() => {
                list.pickTag(null);
                closeMenu();
              }}
            >
              全部标签<span className="vb-menu__count">{list.total}</span>
            </button>
            {TAGS.map((tag) => (
              <button
                key={tag.name}
                aria-pressed={list.tag === tag.name}
                onClick={() => {
                  list.pickTag(tag.name);
                  closeMenu();
                }}
              >
                {tag.name}
                <span className="vb-menu__count">{tag.count}</span>
              </button>
            ))}
          </div>
        </details>
      </div>

      {list.items.length === 0 ? (
        <div className="vb-empty">
          <p className="vb-empty__title">没有匹配的文章</p>
          <p className="vb-empty__note">
            {conditions.length ? `${conditions.join(" · ")}下没有结果。` : "当前条件下没有结果。"}
          </p>
          <button className="vb-primary" onClick={list.clear}>
            清除筛选
          </button>
        </div>
      ) : (
        <ol className="vb-list">
          {list.items.map((article) => (
            <li
              key={article.slug}
              id={`article-${article.slug}`}
              className="vb-row"
              data-restored={list.restored === article.slug || undefined}
            >
              <p className="vb-row__meta">
                <time dateTime={article.date}>{article.date}</time>
                <span className="vb-row__tags">{article.tags.join(" · ")}</span>
              </p>
              <h2 className="vb-row__title">
                <button onClick={() => list.open(article)}>{article.title}</button>
              </h2>
              <p className="vb-row__summary">{article.summary}</p>
            </li>
          ))}
        </ol>
      )}

      {list.pageCount > 1 && (
        <nav className="vb-pager" aria-label="分页">
          <button
            className="vb-pager__step"
            disabled={list.page === 1}
            onClick={() => list.goPage(list.page - 1)}
          >
            上一页
          </button>
          <span className="vb-pager__count">
            第 {list.page} / {list.pageCount} 页
          </span>
          <button
            className="vb-pager__step"
            disabled={list.page === list.pageCount}
            onClick={() => list.goPage(list.page + 1)}
          >
            下一页
          </button>
        </nav>
      )}
    </main>
  );
}
