"use client";

// 方案 C · 时间线：按年份分组，日期在左栏，标签是常驻的 chip 轨道，分页用区间与箭头。

import { describeConditions, PAGE_SIZE, type ListState } from "./list-state";
import { TAGS } from "./mock-articles";

export function VariantC({ list }: { list: ListState }) {
  const conditions = describeConditions(list);
  const groups: { year: string; items: ListState["items"] }[] = [];
  for (const article of list.items) {
    const year = article.date.slice(0, 4);
    const last = groups.at(-1);
    if (last?.year === year) last.items.push(article);
    else groups.push({ year, items: [article] });
  }

  const start = list.total === 0 ? 0 : (list.page - 1) * PAGE_SIZE + 1;
  const end = Math.min(list.page * PAGE_SIZE, list.total);

  return (
    <main className="vc">
      <header className="vc-head">
        <h1>文章</h1>
        <p className="vc-head__count">共 {list.total} 篇</p>
      </header>

      <form
        className="vc-search"
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

      <div className="vc-tags" role="group" aria-label="标签筛选">
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
      </div>

      {list.items.length === 0 ? (
        <p className="vc-empty">
          没有匹配的文章 · {conditions.join(" · ") || "当前条件"}
          <button className="vc-link" onClick={list.clear}>
            清除筛选
          </button>
        </p>
      ) : (
        <div className="vc-list">
          {groups.map((group) => (
            <section key={group.year} className="vc-group">
              <h2 className="vc-year">{group.year}</h2>
              <ol>
                {group.items.map((article) => (
                  <li
                    key={article.slug}
                    id={`article-${article.slug}`}
                    className="vc-entry"
                    data-restored={list.restored === article.slug || undefined}
                  >
                    <time className="vc-entry__date" dateTime={article.date}>
                      {article.date.slice(5)}
                    </time>
                    <div className="vc-entry__main">
                      <h3 className="vc-entry__title">
                        <button onClick={() => list.open(article)}>{article.title}</button>
                      </h3>
                      <p className="vc-entry__summary">{article.summary}</p>
                      <p className="vc-entry__tags">{article.tags.join(" · ")}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {list.pageCount > 1 && (
        <nav className="vc-pager" aria-label="分页">
          <span className="vc-pager__range">
            {start}–{end} / 共 {list.total} 篇
          </span>
          <span className="vc-pager__steps">
            <button
              aria-label="上一页"
              disabled={list.page === 1}
              onClick={() => list.goPage(list.page - 1)}
            >
              ←
            </button>
            <button
              aria-label="下一页"
              disabled={list.page === list.pageCount}
              onClick={() => list.goPage(list.page + 1)}
            >
              →
            </button>
          </span>
        </nav>
      )}
    </main>
  );
}
