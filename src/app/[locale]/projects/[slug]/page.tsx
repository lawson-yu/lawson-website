import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { VisitTracker } from "@/components/public-site/visit-tracker";
import { resolveMediaUrl } from "@/lib/media-url";
import { buildDetailMetadata } from "@/lib/seo";
import { getPublishedProject } from "@/server/projects";
import { ProjectMarkdown } from "./_components/project-markdown";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project || !project.body || !project.contentLanguage) {
    return { robots: { index: false, follow: false } };
  }

  return buildDetailMetadata({
    section: "projects",
    slug,
    title: project.name,
    description: project.description,
    bodyLanguage: project.contentLanguage,
    coverImageKey: project.coverImage,
    publishedTime: project.firstPublishedAt ?? project.createdAt,
  });
}

export default function ProjectDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="project-detail-page" aria-busy="true" />}>
      <ProjectDetailContent params={params} />
    </Suspense>
  );
}

async function ProjectDetailContent({ params }: Props) {
  await connection();
  const { locale, slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project || !project.body || !project.contentLanguage) notFound();

  const t = await getTranslations("Projects");
  const publishedAt = project.firstPublishedAt ?? project.createdAt;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(publishedAt);
  const cover = resolveMediaUrl(project.coverImage);
  const bodyLanguage = project.contentLanguage === "en" ? "en" : "zh";

  return (
    <main className="project-detail-page">
      <VisitTracker kind="project" targetId={project.id} />
      <article className="project-detail" lang={bodyLanguage}>
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
        {cover && (
          <figure className="project-detail__cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={project.name} />
          </figure>
        )}
        <div className="project-detail__body" lang={bodyLanguage}>
          <ProjectMarkdown source={project.body} />
        </div>
        <footer className="project-detail__footer">
          <Link href="/projects">{t("continueBrowsing")}</Link>
        </footer>
      </article>
    </main>
  );
}
