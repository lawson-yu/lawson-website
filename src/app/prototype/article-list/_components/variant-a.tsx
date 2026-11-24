"use client";

// 方案 A · 目录：无边框单列，日期在右栏，筛选是文字式控件，分页用页码。

import { describeConditions, type ListState } from "./list-state";
import { TAGS } from "./mock-articles";

export function VariantA({ list }: { list: ListState }) {
  const conditions = describeConditions(list);

  return (
    <main className="va">
      <header className="va-head">
        <h1>文章</h1>
        <p className="va-head__count">共 {list.total} 篇</p>
      </header>

      <form
        className="va-search"
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

      <nav className="va-tags" aria-label="标签筛选">
        <button aria-pressed={!list.tag} onClick={() => list.pickTag(null)}>
          全部
        </button>
        {TAGS.map((tag) => (
          <button
            key={tag.name}
            aria-pressed={list.tag === tag.name}
            onClick={() => list.pickTag(tag.name)}
          >
            {tag.name}
          </button>
        ))}
      </nav>

      {list.items.length === 0 ? (
        <div className="va-empty">
          <p className="va-empty__title">没有匹配的文章</p>
          <p className="va-empty__note">
            {conditions.length ? `${conditions.join(" · ")}下没有结果。` : "当前条件下没有结果。"}
          </p>
          <button className="va-link" onClick={list.clear}>
            清除筛选
          </button>
        </div>
      ) : (
        <ol className="va-list">
          {list.items.map((article) => (
            <li
              key={article.slug}
              id={`article-${article.slug}`}
              className="va-row"
              data-restored={list.restored === article.slug || undefined}
            >
              <div className="va-row__main">
                <h2 className="va-row__title">
                  <button onClick={() => list.open(article)}>{article.title}</button>
                </h2>
                <p className="va-row__summary">{article.summary}</p>
                <p className="va-row__tags">{article.tags.join(" · ")}</p>
              </div>
              <time className="va-row__date" dateTime={article.date}>
                {article.date}
              </time>
            </li>
          ))}
        </ol>
      )}

      {list.pageCount > 1 && (
        <nav className="va-pager" aria-label="分页">
          <button
            className="va-pager__step"
            disabled={list.page === 1}
            onClick={() => list.goPage(list.page - 1)}
          >
            上一页
          </button>
          <span className="va-pager__nums">
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
          <span className="va-pager__compact">
            {list.page} / {list.pageCount}
          </span>
          <button
            className="va-pager__step"
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
