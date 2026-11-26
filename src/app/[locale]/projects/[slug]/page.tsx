import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getPublishedProject } from "@/server/projects";
import { ProjectMarkdown } from "./_components/project-markdown";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) return {};

  return {
    title: project.name,
    description: project.description,
    openGraph: {
      title: project.name,
      description: project.description,
      type: "article",
    },
  };
}

export default function ProjectDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="project-detail-page" aria-busy="true" />}>
      <ProjectDetailContent params={params} />
    </Suspense>
  );
}

async function ProjectDetailContent({ params }: Props) {
  const { locale, slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project || !project.body || !project.contentLanguage) notFound();

  const t = await getTranslations("Projects");
  const publishedAt = project.firstPublishedAt ?? project.createdAt;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(publishedAt);
  const cover = project.coverImage
    ? /^https?:\/\//i.test(project.coverImage)
      ? project.coverImage
      : `/${project.coverImage.replace(/^\/+/, "")}`
    : null;

  return (
    <main className="project-detail-page">
      <article className="project-detail">
        <Link className="project-detail__back" href="/projects">
          <ArrowLeft aria-hidden="true" size={17} />
          {t("backToWorks")}
        </Link>
        <header className="project-detail__header">
          <div className="project-detail__meta">
            <span>{project.type}</span>
            <time dateTime={publishedAt.toISOString()}>{date}</time>
          </div>
          <h1>{project.name}</h1>
          <p className="project-detail__lede">{project.description}</p>
          {project.url && (
            <a className="project-detail__visit" href={project.url} target="_blank" rel="noopener noreferrer">
              {t("visitProject")}
              <ArrowUpRight aria-hidden="true" size={17} />
            </a>
          )}
        </header>
        {cover && <div className="project-detail__cover" role="img" aria-label={project.name} style={{ backgroundImage: `url("${cover}")` }} />}
        <div className="project-detail__body" lang={project.contentLanguage}>
          <ProjectMarkdown source={project.body} />
        </div>
        <footer className="project-detail__footer">
          <Link href="/projects">{t("continueBrowsing")}</Link>
        </footer>
      </article>
    </main>
  );
}
