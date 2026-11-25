"use client";

// 原型状态（issue #30）：列表的筛选、分页与返回定位。

import { useCallback, useEffect, useMemo, useState } from "react";
import { ARTICLES, type Article } from "./mock-articles";

export const PAGE_SIZE = 10;

export type Conditions = { q: string; tag: string | null };

/** 关键词覆盖标题与摘要（真实实现还要覆盖正文），标签单选取交集。 */
export function matchArticle(article: Article, { q, tag }: Conditions): boolean {
  if (tag && !article.tags.includes(tag)) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return `${article.title} ${article.summary}`.toLowerCase().includes(needle);
}

export function useArticleListState(initialTag: string | null = null) {
  const [q, setQ] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [tag, setTag] = useState(initialTag);
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMore = useCallback(() => setVisibleCount(count => count + PAGE_SIZE), []);
  const [detail, setDetail] = useState<Article | null>(null);
  const [restored, setRestored] = useState<string | null>(null);

  const results = useMemo(
    () => ARTICLES.filter((article) => matchArticle(article, { q, tag })),
    [q, tag],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  // 页码越界时打开最后一个有效页（#22）。
  const current = Math.min(page, pageCount);
  const items = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // 从详情返回：让原条目进入视野，并短暂标出它。
  useEffect(() => {
    if (!restored) return;
    const node = document.getElementById(`article-${restored}`);
    node?.querySelector<HTMLButtonElement>(".mag-card__open, .mag-lead__content")?.focus({ preventScroll: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    const timer = window.setTimeout(() => setRestored(null), 2600);
    return () => window.clearTimeout(timer);
  }, [restored]);

  function closeDetail() {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setDetail(null);
  }

  return {
    q,
    searchDraft,
    setSearchDraft,
    tag,
    page: current,
    pageCount,
    items,
    results,
    visibleCount,
    loadMore,
    total: results.length,
    detail,
    restored,
    /** 提交关键词后更新结果。 */
    search(next: string) {
      setQ(next);
      setPage(1);
      setVisibleCount(PAGE_SIZE);
    },
    pickTag(next: string | null) {
      setTag(next);
      setPage(1);
      setVisibleCount(PAGE_SIZE);
    },
    goPage(next: number) {
      setPage(next);
    },
    clear() {
      setQ("");
      setSearchDraft("");
      setTag(null);
      setPage(1);
      setVisibleCount(PAGE_SIZE);
    },
    open(article: Article) {
      setDetail(article);
    },
    back() {
      if (!detail) return;
      setRestored(detail.slug);
      closeDetail();
    },
    browseTag(next: string) {
      setQ("");
      setSearchDraft("");
      setTag(next);
      setPage(1);
      setVisibleCount(PAGE_SIZE);
      closeDetail();
      requestAnimationFrame(() => document.getElementById("mag-articles")?.scrollIntoView());
    },
    /** 评审用：一键跳到某个状态。 */
    preset(next: { q?: string; tag?: string | null; page?: number }) {
      setQ(next.q ?? "");
      setSearchDraft(next.q ?? "");
      setTag(next.tag ?? null);
      setPage(next.page ?? 1);
      setDetail(null);
    },
  };
}

export type ListState = ReturnType<typeof useArticleListState>;

/** 条件摘要，空状态和状态读数共用。 */
export function describeConditions({ q, tag }: Conditions): string[] {
  const parts: string[] = [];
  if (q.trim()) parts.push(`关键词「${q.trim()}」`);
  if (tag) parts.push(`标签「${tag}」`);
  return parts;
}
