import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { VisitTracker } from "@/components/public-site/visit-tracker";
import { ReadingFrame } from "@/components/public-site/reading-frame";
import "@/components/public-site/public-cloud.css";
import "@/components/public-site/reading-frame.css";
import { resolveMediaUrl } from "@/lib/media-url";
import { getContentLocale } from "@/lib/content-language";
import { buildDetailMetadata } from "@/lib/seo";
import { getPublishedProject } from "@/server/projects";
import { ProjectMarkdown } from "./_components/project-markdown";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const instant = false;

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

export default async function ProjectDetailPage({ params }: Props) {
  await connection();
  const { locale, slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project || !project.body || !project.contentLanguage) notFound();

  const t = await getTranslations("Projects");
  const publishedAt = project.firstPublishedAt ?? project.createdAt;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(publishedAt);
  const cover = resolveMediaUrl(project.coverImage);
  const bodyLanguage = getContentLocale(project.contentLanguage);

  return (
    <>
      <VisitTracker kind="project" targetId={project.id} />
      <ReadingFrame
        lang={bodyLanguage}
        heading={
          <>
            <Link className="content-reading__back" href="/projects">
              <ArrowLeft aria-hidden="true" size={17} />
              {t("backToWorks")}
            </Link>
            <h1>{project.name}</h1>
            <div className="project-detail__meta">
              <span>{project.type}</span>
              <time dateTime={publishedAt.toISOString()}>{date}</time>
            </div>
            {project.url && (
              <a className="project-detail__visit" href={project.url} target="_blank" rel="noopener noreferrer">
                {t("visitProject")}
                <ArrowUpRight aria-hidden="true" size={17} />
              </a>
            )}
          </>
        }
        cover={
          cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" />
          ) : undefined
        }
      >
        <p className="content-reading__lede">{project.description}</p>
        <ProjectMarkdown source={project.body} codeScrollLabel={t("codeScrollLabel")} />
        <footer className="content-reading__end project-detail__footer">
          <Link href="/projects">{t("continueBrowsing")}</Link>
        </footer>
      </ReadingFrame>
    </>
  );
}
