import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublishedProjects } from "@/server/projects";
import { ProjectCard, WorksBrowseLink } from "./_components/project-card";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Projects");
  return { title: t("title"), description: t("description") };
}

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Projects");
  const projects = await getPublishedProjects();

  return (
    <main className="works-page">
      <header className="works-intro">
        <div className="works-intro__title">
          <h1>{t("title")}</h1>
          <span aria-hidden="true">WORKS</span>
        </div>
        <p>{t("description")}</p>
        {projects.length > 0 && <WorksBrowseLink label={t("browseAll")} />}
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
