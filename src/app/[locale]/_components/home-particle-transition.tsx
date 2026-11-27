"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import { scrollPageTo } from "./showcase-motion";

export function HomeParticleTransition({
  lead,
  bridge,
  accent,
  description,
}: {
  lead: string;
  bridge: string;
  accent: string;
  description: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const transition = sectionRef.current;
    const site = transition?.closest<HTMLElement>(".kin-site, .home-page");
    if (!transition || !site) return;

    const mobileMotion = matchMedia("(max-width: 767px) and (prefers-reduced-motion: no-preference)");
    let touch: {
      x: number;
      y: number;
      location: "article" | "transition" | "projects" | "projects-content";
      direction: number;
    } | null = null;
    let settling = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const getPeers = () => ({
      articles: site.querySelector<HTMLElement>(".article-showcase"),
      projects: site.querySelector<HTMLElement>('[data-screen="projects"]'),
    });

    const settle = () => {
      clearTimeout(settleTimer);
      if (!settling) return;
      settleTimer = setTimeout(() => {
        settling = false;
        const { projects } = getPeers();
        if (!mobileMotion.matches || !projects) return;
        if (projects.getBoundingClientRect().top > 4) {
          scrollPageTo(lenis, transition.getBoundingClientRect().top + window.scrollY);
        }
      }, 180);
    };

    const touchStart = (event: TouchEvent) => {
      clearTimeout(settleTimer);
      settling = false;
      const { articles, projects } = getPeers();
      if (!mobileMotion.matches || !articles || event.touches.length !== 1) return;
      const rect = transition.getBoundingClientRect();
      const onTransition = Math.abs(rect.top) <= 4;
      const onProjects = !!projects && projects.getBoundingClientRect().top >= -4 && rect.top < -4;
      const inProjects = !!projects && projects.getBoundingClientRect().top < -4 && projects.getBoundingClientRect().bottom > 0;
      const items = articles.querySelectorAll<HTMLElement>(".article-showcase__item");
      const onLastArticle = rect.top > 4 && articles.getBoundingClientRect().top < 0 && items[items.length - 1]?.dataset.current === "true";
      if (!onTransition && !onLastArticle && !onProjects && !inProjects) return;
      touch = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        location: onTransition ? "transition" : onProjects ? "projects" : inProjects ? "projects-content" : "article",
        direction: 0,
      };
    };

    const touchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1) {
        touch = null;
        return;
      }
      const dx = event.touches[0].clientX - touch.x;
      const dy = touch.y - event.touches[0].clientY;
      if (touch.location === "projects-content") {
        if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) touch.direction = Math.sign(dy);
        return;
      }
      if (
        Math.abs(dy) > 20 &&
        Math.abs(dy) > Math.abs(dx) &&
        (touch.location === "transition" ||
          (touch.location === "article" ? dy > 0 || transition.getBoundingClientRect().top < window.innerHeight : dy < 0))
      ) {
        touch.direction = Math.sign(dy);
      }
      if (touch.direction && event.cancelable) event.preventDefault();
    };

    const touchEnd = () => {
      const { articles, projects } = getPeers();
      if (touch?.location === "projects-content") {
        settling = touch.direction < 0;
        settle();
      } else if (touch?.direction && articles && mobileMotion.matches) {
        const target =
          touch.location === "transition" && touch.direction > 0 && projects
            ? projects.getBoundingClientRect().top + window.scrollY
            : (touch.location === "transition" || touch.location === "article") && touch.direction < 0
              ? articles.getBoundingClientRect().top +
                window.scrollY +
                (0.8 + (articles.querySelectorAll(".article-showcase__item").length - 1) * 0.5) * window.innerHeight
              : transition.getBoundingClientRect().top + window.scrollY;
        scrollPageTo(lenis, target);
      }
      touch = null;
    };

    const touchCancel = () => {
      touch = null;
    };

    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd);
    window.addEventListener("touchcancel", touchCancel);
    window.addEventListener("scroll", settle, { passive: true });

    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("scroll", settle);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchCancel);
    };
  }, [lenis]);

  return (
    <section
      ref={sectionRef}
      className="particle-transition home-particle-transition"
      data-screen="transition"
      data-home-motion="particle-transition"
      aria-labelledby="home-particle-transition-title"
    >
      <div className="particle-transition__pin">
        <div className="particle-transition__copy">
          <h2 id="home-particle-transition-title">
            <span>{lead}<span className="particle-transition__capsule" aria-hidden="true" /></span>
            <span>{bridge}<em>{accent}</em></span>
          </h2>
          <p>{description}</p>
        </div>
      </div>
    </section>
  );
}
