import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildListMetadata } from "@/lib/seo";
import { getPublishedProjects } from "@/server/projects";
import { ProjectCard, WorksBrowseLink } from "./_components/project-card";
import { PublicCloud } from "@/components/public-site/public-cloud";
import "@/components/public-site/public-cloud.css";
import { Suspense } from "react";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Projects" });
  return buildListMetadata({
    locale,
    section: "projects",
    title: `${t("title")} | LAWSON`,
    description: t("description"),
    hasFilterOrLoadState: false,
  });
}

export default function ProjectsPage({ params }: Props) {
  return (
    <Suspense fallback={<main className="works-page" aria-busy="true" />}>
      <ProjectsPageContent params={params} />
    </Suspense>
  );
}

async function ProjectsPageContent({ params }: Props) {
  await connection();
  const { locale } = await params;
  const t = await getTranslations("Projects");
  const projects = await getPublishedProjects();

  return (
    <main className="works-page">
      <header className="works-intro">
        <div className="works-intro__art">
          <PublicCloud variant="B" />
        </div>
        <div className="works-intro__frame">
          <div className="works-intro__wordmark" aria-hidden="true"><span>WORKS</span></div>
          <div className="works-intro__content">
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
          {projects.length > 0 && <WorksBrowseLink label={t("browseAll")} />}
        </div>
      </header>
      {projects.length ? (
        <section className="works-grid" id="works-grid" aria-label={t("title")}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              locale={locale}
              labels={{ internal: t("internalTarget"), external: t("externalTarget") }}
            />
          ))}
        </section>
      ) : (
        <section className="works-empty" aria-live="polite">
          <h2>{t("emptyTitle")}</h2>
          <p>{t("emptyDescription")}</p>
        </section>
      )}
    </main>
  );
}
