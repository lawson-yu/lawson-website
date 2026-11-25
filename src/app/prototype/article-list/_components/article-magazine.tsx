"use client";

// 文章列表原型：以杂志式布局探索连续浏览与动效。
import { ArrowUpRight, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { MagazineHeading, type HeadingVariant } from "./magazine-heading";
import { TAGS } from "./mock-articles";
import { type ListState } from "./list-state";
import "./magazine.css";

export function ArticleMagazine({ list, variant, headingRun }: { list: ListState; variant: HeadingVariant; headingRun: number }) {
  const grid = useRef<HTMLUListElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const hasMore = list.visibleCount < list.results.length;
  const { loadMore } = list;

  useEffect(() => {
    const sentinel = more.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, list.visibleCount, list.q, list.tag]);

  useEffect(() => {
    const items = grid.current?.querySelectorAll<HTMLElement>(".mag-card");
    if (!items || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [list.results, list.visibleCount]);

  const visible = list.results.slice(0, list.visibleCount);
  const lead = !list.q && !list.tag ? visible[0] : undefined;
  const articles = lead ? visible.slice(1) : visible;
  return (
    <main className="mag">
      <header className="mag-header">
        <MagazineHeading key={`${variant}-${headingRun}`} variant={variant} />
        {lead && <article id={`article-${lead.slug}`} data-restored={list.restored === lead.slug || undefined} className="mag-lead">
          <div className="mag-lead__text"><button className="mag-lead__content" onClick={() => list.open(lead)}>
            <span className="mag-lead__meta"><time dateTime={lead.date}>{lead.date}</time><span className="mag-card__arrow"><ArrowUpRight size={20} aria-hidden="true" /></span></span>
            <span className="mag-lead__title">{lead.title}</span>
            <span className="mag-lead__summary">{lead.summary}</span>
          </button>
          {lead.tags.length > 0 && <div className="mag-card__tags mag-lead__tags" aria-label="文章标签">{lead.tags.map(tag => <button key={tag} onClick={() => list.pickTag(tag)}>{tag}</button>)}</div>}</div>
          <button className="mag-lead__image" onClick={() => list.open(lead)} aria-label={`阅读：${lead.title}`}><img src={lead.cover} alt="" /></button>
        </article>}
      </header>
      <section id="mag-articles" className="mag-section" aria-label="文章列表">
        <div className="mag-section__head"><h2>所有文章 <span aria-live="polite">{list.total} 篇</span></h2><form className="mag-search" role="search" onSubmit={(event) => { event.preventDefault(); list.search(list.searchDraft); }}><button type="submit" aria-label="搜索"><Search size={18} aria-hidden="true" /></button><input type="search" placeholder="搜索文章" aria-label="搜索文章" value={list.searchDraft} onChange={(event) => list.setSearchDraft(event.target.value)} /></form></div>
        <div className="mag-filters" role="group" aria-label="按标签筛选"><button aria-pressed={!list.tag} onClick={() => list.pickTag(null)}>全部</button>{TAGS.map(({name}) => <button key={name} aria-pressed={list.tag === name} onClick={() => list.pickTag(name)}>{name}</button>)}</div>
        {list.results.length === 0 ? <div className="mag-empty" role="status"><p>没有找到匹配的文章。</p><button onClick={list.clear}>清除筛选</button></div> : <ul className="mag-grid" ref={grid}>
          {articles.map((article) => <li key={article.slug} id={`article-${article.slug}`} className="mag-card" data-restored={list.restored === article.slug || undefined}>
            <div className="mag-card__meta"><div className="mag-card__tags" aria-label="文章标签">{article.tags.map(tag => <button key={tag} onClick={() => list.pickTag(tag)}>{tag}</button>)}</div><time className="mag-card__date" dateTime={article.date}>{article.date}</time></div>
            <button className="mag-card__open" onClick={() => list.open(article)}>
              <span className="mag-card__image"><img src={article.cover} alt="" loading="lazy" /></span>
              <span className="mag-card__body"><span className="mag-card__title">{article.title}：</span><span className="mag-card__summary">{article.summary}</span></span>
            </button>
          </li>)}
        </ul>}
        {hasMore ? <div ref={more} className="mag-end"><button onClick={list.loadMore}>加载更多文章</button></div> : list.results.length > 0 && <p className="mag-end">已经看到最后了 · {list.total} 篇文章</p>}
      </section>
    </main>
  );
}
