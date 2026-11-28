"use client";

import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { DEFAULT_CARD_COVER_PATH, resolveMediaUrl } from "@/lib/media-url";
import { cancelPageScroll, createShowcaseMotion, scrollPageTo } from "./showcase-motion";
import "./project-showcase.css";

export type ProjectShowcaseItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cardTarget: "INTERNAL" | "EXTERNAL";
  url: string | null;
  coverImage: string | null;
  previewLabel: string;
};

export function ProjectShowcase({
  heading,
  hint,
  internalLabel,
  externalLabel,
  projects,
}: {
  heading: string;
  hint: string;
  internalLabel: string;
  externalLabel: string;
  projects: ProjectShowcaseItem[];
}) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const motion = useRef<ReturnType<typeof createShowcaseMotion> | null>(null);
  const lenis = useLenis();

  useEffect(() => {
    const root = section.current;
    const track = root?.querySelector<HTMLElement>(".project-showcase__track");
    if (!root || !track) return;

    const controller = createShowcaseMotion(
      root,
      track,
      setActive,
      (top, immediate) => scrollPageTo(lenis, top, immediate),
      () => cancelPageScroll(lenis),
    );
    motion.current = controller;
    return () => {
      controller.dispose();
      motion.current = null;
    };
  }, [lenis, projects.length]);

  const selectProject = (index: number) => motion.current?.select(index);

  return (
    <section
      ref={section}
      className="project-showcase home-featured-projects"
      id="featured-projects"
      data-screen="projects"
      data-home-motion="home-projects"
      style={{ "--project-height": `${projects.length * 100 - 25}vh` } as CSSProperties}
      aria-labelledby="featured-projects-title"
    >
      <div className="project-showcase__pin">
        <h2 className="project-showcase__heading" id="featured-projects-title">{heading}</h2>
        <div className="project-showcase__body">
          <div className="project-showcase__list" aria-label={heading}>
            {projects.map((project, index) => (
              <article className="project-showcase__item works-card" data-active={active === index} key={project.id}>
                <button
                  className="project-showcase__select"
                  type="button"
                  onClick={() => selectProject(index)}
                  aria-label={project.previewLabel}
                  aria-current={active === index ? "true" : undefined}
                >
                  <span className="project-showcase__number" aria-hidden="true">
                    {index <= active ? <Check size={24} strokeWidth={1.8} /> : index + 1}
                  </span>
                  <span>
                    <span className="project-showcase__name works-card__title">{project.name}</span>
                    <span className="project-showcase__description">{project.description}</span>
                  </span>
                </button>
                {project.cardTarget === "EXTERNAL" && project.url ? (
                  <a className="project-showcase__open works-card__link" href={project.url} target="_blank" rel="noreferrer">
                    {externalLabel}<ArrowUpRight aria-hidden="true" size={17} />
                  </a>
                ) : project.slug ? (
                  <Link className="project-showcase__open works-card__link" href={`/projects/${project.slug}`}>
                    {internalLabel}<ArrowRight aria-hidden="true" size={17} />
                  </Link>
                ) : null}
              </article>
            ))}
            <p className="project-showcase__hint">{hint}</p>
          </div>
          <div className="project-showcase__visuals" aria-hidden="true">
            <div className="project-showcase__track">
              {projects.map((project, index) => (
                <figure className="project-showcase__image" key={project.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(project.coverImage) ?? DEFAULT_CARD_COVER_PATH}
                    alt=""
                    loading={index === 0 ? "eager" : "lazy"}
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallback) return;
                      event.currentTarget.dataset.fallback = "1";
                      event.currentTarget.src = DEFAULT_CARD_COVER_PATH;
                    }}
                  />
                  <figcaption>{project.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
