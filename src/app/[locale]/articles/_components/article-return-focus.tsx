"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/navigation";

const returnFocusKey = "article-return-focus";

function restoreArticlePosition(slug: string) {
  const target = [...document.querySelectorAll<HTMLAnchorElement>("[data-article-return-target]")]
    .find((link) => link.dataset.articleReturnTarget === slug);
  if (!target) {
    const results = document.querySelector<HTMLElement>(".articles-index__grid, .articles-index__empty");
    if (results) results.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
    return;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center" });
}

type ArticleCardLinkProps = {
  href: string;
  slug: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  focusTarget?: boolean;
};

export function ArticleCardLink({
  href,
  slug,
  children,
  className,
  ariaLabel,
  focusTarget = false,
}: ArticleCardLinkProps) {
  function rememberReturnTarget(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    try {
      window.sessionStorage.setItem(returnFocusKey, slug);
    } catch {
      // 会话存储不可用时，浏览器历史仍可恢复列表。
    }
  }

  return (
    <Link
      className={className}
      href={href}
      aria-label={ariaLabel}
      data-article-return-target={focusTarget ? slug : undefined}
      onClick={rememberReturnTarget}
    >
      {children}
    </Link>
  );
}

export function ArticleReturnFocus({ articleSlugs }: { articleSlugs: string[] }) {
  const router = useRouter();
  const returnState = useRef<{ slug: string; before: string[] } | null>(null);

  useEffect(() => {
    function refreshForReturn() {
      let slug: string | null;
      try {
        slug = window.sessionStorage.getItem(returnFocusKey);
        if (slug) window.sessionStorage.removeItem(returnFocusKey);
      } catch {
        return;
      }
      if (!slug) return;

      returnState.current = { slug, before: articleSlugs };
      router.refresh();
    }

    refreshForReturn();
    window.addEventListener("pageshow", refreshForReturn);
    return () => window.removeEventListener("pageshow", refreshForReturn);
  }, [articleSlugs, router]);

  useEffect(() => {
    const state = returnState.current;
    if (state) {
      if (state.before === articleSlugs) return;
      returnState.current = null;
      restoreArticlePosition(state.slug);
      return;
    }

    const hashPrefix = "#article-";
    if (!window.location.hash.startsWith(hashPrefix)) return;
    try {
      const slug = decodeURIComponent(window.location.hash.slice(hashPrefix.length));
      if (slug) restoreArticlePosition(slug);
    } catch {
      // 忽略无法解码的地址片段。
    }
  }, [articleSlugs]);

  return null;
}
