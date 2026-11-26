import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DEFAULT_CARD_COVER_PATH, resolveMediaUrl } from "@/lib/media-url";

type ProjectCardData = {
  slug: string;
  name: string;
  description: string;
  type: string;
  cardTarget: "INTERNAL" | "EXTERNAL";
  url: string | null;
  coverImage: string | null;
  firstPublishedAt: Date | null;
  createdAt: Date;
};

export function ProjectCard({
  project,
  locale,
  labels,
}: {
  project: ProjectCardData;
  locale: string;
  labels: { internal: string; external: string };
}) {
  const publishedAt = project.firstPublishedAt ?? project.createdAt;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(publishedAt);
  const cover = resolveMediaUrl(project.coverImage) ?? DEFAULT_CARD_COVER_PATH;
  const card = (
    <>
      <span
        className="works-card__cover"
        aria-hidden="true"
        style={{ backgroundImage: `url("${cover}")` }}
      >
        {!project.coverImage && <span className="works-card__cover-title">{project.name}</span>}
      </span>
      <span className="works-card__info">
        <span className="works-card__meta">
          <span>{project.type}</span>
          <time dateTime={publishedAt.toISOString()}>{date}</time>
        </span>
        <span className="works-card__title">{project.name}</span>
        <span className="works-card__description">{project.description}</span>
        <span className="works-card__destination">
          {project.cardTarget === "EXTERNAL" ? labels.external : labels.internal}
          {project.cardTarget === "EXTERNAL" ? (
            <ArrowUpRight aria-hidden="true" size={17} />
          ) : (
            <ArrowRight aria-hidden="true" size={17} />
          )}
        </span>
      </span>
    </>
  );

  return (
    <article className="works-card">
      {project.cardTarget === "EXTERNAL" ? (
        project.url ? (
          <a className="works-card__link" href={project.url} target="_blank" rel="noopener noreferrer">
            {card}
            <span className="works-visually-hidden">{labels.external}</span>
          </a>
        ) : (
          <div className="works-card__link" aria-disabled="true">{card}</div>
        )
      ) : (
        <Link className="works-card__link" href={`/projects/${project.slug}`}>
          {card}
        </Link>
      )}
    </article>
  );
}

export function WorksBrowseLink({ label }: { label: string }) {
  return (
    <a className="works-browse" href="#works-grid">
      {label}
      <ArrowDown aria-hidden="true" size={17} />
    </a>
  );
}
