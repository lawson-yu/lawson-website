import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSiteOwner } from "@/server/auth";
import { getAdminProjects } from "@/server/projects";
import { updateFeaturedProject } from "@/server/actions/projects";
import { FeaturedManager } from "../_components/featured-manager";
import { SignOutButton } from "@/components/public-site/public-authentication";
import { ProjectEditor } from "./_components/project-editor";

export default function AdminProjectsPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminProjectsContent />
    </Suspense>
  );
}

async function AdminProjectsContent() {
  const session = await requireSiteOwner();
  const projects = await getAdminProjects();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });

  return (
    <main className="admin-page admin-projects-page">
      <header className="admin-page__header">
        <Link href="/admin">{t("brand")}</Link>
        <div>
          <span>{t("signedIn", { email: session.user.email })}</span>
          <SignOutButton label={t("signOut")} />
        </div>
      </header>
      <section className="admin-page__content">
        <div className="admin-projects-heading">
          <div>
            <Link href="/admin" className="admin-projects-back">{t("backToAdmin")}</Link>
            <h1>{t("projectsTitle")}</h1>
            <p>{t("projectsDescription")}</p>
          </div>
          <Link className="admin-page__link" href="/zh/projects" target="_blank" rel="noreferrer">
            {t("viewPublicProjects")}
          </Link>
        </div>
        <FeaturedManager
          kind="project"
          limit={3}
          action={updateFeaturedProject}
          items={projects.map((project) => ({
            id: project.id,
            title: project.name || t("unnamedProject"),
            status: project.status,
            featuredRank: project.featuredRank,
          }))}
        />
        <ProjectEditor />
        <section className="admin-project-list" aria-label={t("existingProjects")}>
          <h2>{t("existingProjects")}</h2>
          {projects.length ? projects.map((project) => (
            <details className="admin-project-row" key={project.id}>
              <summary>
                <span className="admin-project-row__title">{project.name || t("unnamedProject")}</span>
                <span className="admin-project-status" data-status={project.status}>
                  {project.status === "PUBLISHED" ? t("published") : project.status === "WITHDRAWN" ? t("withdrawn") : t("draft")}
                </span>
                <span className="admin-project-row__slug">{project.slug}</span>
              </summary>
              <ProjectEditor project={{
                id: project.id,
                slug: project.slug,
                name: project.name,
                description: project.description,
                type: project.type,
                cardTarget: project.cardTarget,
                status: project.status,
                url: project.url,
                coverImage: project.coverImage,
                body: project.body,
                contentLanguage: project.contentLanguage,
                firstPublishedAt: project.firstPublishedAt?.toISOString() ?? null,
              }} />
            </details>
          )) : <p className="admin-project-empty">{t("noProjects")}</p>}
        </section>
      </section>
    </main>
  );
}
