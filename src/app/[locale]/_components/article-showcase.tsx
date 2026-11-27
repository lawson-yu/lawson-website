"use client";

import { ArrowUpRight } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { articleScroll, scrollPageTo } from "./showcase-motion";
import "./article-showcase.css";

type ArticleShowcaseItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
};

export function ArticleShowcase({
  title,
  articles,
}: {
  title: string;
  articles: ArticleShowcaseItem[];
}) {
  const section = useRef<HTMLElement>(null);
  const lenis = useLenis();

  const selectArticle = (index: number) => {
    const root = section.current;
    if (!root) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.querySelectorAll<HTMLAnchorElement>(".article-showcase__link")[index]?.scrollIntoView({ block: "center" });
      return;
    }
    const top = root.getBoundingClientRect().top + window.scrollY + (0.8 + index * 0.5) * window.innerHeight;
    scrollPageTo(lenis, top);
  };

  useEffect(() => {
    const root = section.current;
    const list = root?.querySelector<HTMLElement>(".article-showcase__list");
    if (!root || !list) return;

    const items = [...root.querySelectorAll<HTMLElement>(".article-showcase__item")];
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = matchMedia("(max-width: 767px)");
    let frame = 0;
    let pointerDown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      frame = 0;
      if (motion.matches || items.length < 2) {
        clearTimeout(timer);
        list.style.opacity = "1";
        list.inert = false;
        root.style.removeProperty("--article-veil");
        return;
      }

      const { progress, reveal } = articleScroll(-root.getBoundingClientRect().top, window.innerHeight, items.length);
      list.style.opacity = String(reveal);
      list.inert = reveal < 0.05;
      root.style.setProperty("--article-veil", String(reveal));
      const current = Math.round(progress);
      items.forEach((item, index) => {
        const distance = index - progress;
        item.style.setProperty("--distance", String(distance));
        item.style.setProperty("--curve", String(Math.sin(distance * 1.2)));
        item.style.setProperty("--strength", String(Math.max(0, 1 - Math.abs(distance))));
        item.dataset.current = String(index === current);
        const link = item.querySelector("a");
        if (link) {
          if (index === current) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        }
      });
    };

    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
      clearTimeout(timer);
      if (motion.matches || mobile.matches || items.length < 2) return;
      const top = root.getBoundingClientRect().top + window.scrollY;
      const { snap } = articleScroll(window.scrollY - top, window.innerHeight, items.length);
      if (!pointerDown && snap !== null && Math.abs(top + snap - window.scrollY) > 2) {
        timer = setTimeout(() => {
          if (motion.matches || pointerDown) return;
          scrollPageTo(lenis, top + snap);
        }, 180);
      }
    };
    const down = () => {
      pointerDown = true;
      clearTimeout(timer);
    };
    const up = () => { pointerDown = false; };

    update();
    motion.addEventListener("change", update);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      motion.removeEventListener("change", update);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", update);
    };
  }, [articles.length, lenis]);

  const articleHeight = articles.length === 1 ? "auto" : `${230 + (articles.length - 1) * 50}vh`;

  return (
    <section
      ref={section}
      className="article-showcase home-featured-articles"
      id="featured-articles"
      data-screen="os"
      data-home-motion="featured-articles"
      data-static={articles.length === 1 ? "true" : undefined}
      style={{ "--article-height": articleHeight } as CSSProperties}
      aria-labelledby="featured-articles-title"
    >
      <div className="article-showcase__pin">
        <h2 className="article-showcase__heading" id="featured-articles-title">{title}</h2>
        <div className="article-showcase__list">
          {articles.map((article, index) => (
            <article
              className="article-showcase__item home-featured__article"
              data-current={index === 0}
              key={article.id}
              style={{ "--distance": index, "--curve": 0, "--strength": index === 0 ? 1 : 0 } as CSSProperties}
            >
              <div className="article-showcase__card">
                <Link
                  className="article-showcase__link article-card__title"
                  href={`/articles/${article.slug}`}
                  aria-current={index === 0 ? "true" : undefined}
                  onFocus={() => selectArticle(index)}
                >
                  <span>{article.title}</span>
                  <ArrowUpRight aria-hidden="true" strokeWidth={1.5} />
                </Link>
                {article.excerpt && <p className="article-showcase__description">{article.excerpt}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
