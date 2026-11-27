import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireSiteOwner } from "@/server/auth";
import { getAdminProjects } from "@/server/projects";
import { updateFeaturedProject } from "@/server/actions/projects";
import { FeaturedManager } from "../_components/featured-manager";
import { ProjectEditor } from "./_components/project-editor";
import { ProjectList } from "./_components/project-list";

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
    <AdminShell activeSection="projects" userEmail={session.user.email} pageClassName="admin-projects-page">
      <section aria-labelledby="admin-projects-heading">
        <div className="admin-head">
          <h1 id="admin-projects-heading">{t("projectsTitle")}</h1>
          <Link className="admin-button" href="/zh/projects" target="_blank" rel="noreferrer">
            {t("viewPublicProjects")} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <p className="admin-note">{t("projectsDescription")}</p>

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
          <ProjectList
            projects={projects.map((project) => ({
              id: project.id,
              slug: project.slug,
              name: project.name,
              description: project.description,
              type: project.type,
              cardTarget: project.cardTarget,
              status: project.status,
              statusLabel:
                project.status === "PUBLISHED"
                  ? t("published")
                  : project.status === "WITHDRAWN"
                    ? t("withdrawn")
                    : t("draft"),
              url: project.url,
              coverImage: project.coverImage,
              body: project.body,
              contentLanguage: project.contentLanguage,
              firstPublishedAt: project.firstPublishedAt?.toISOString() ?? null,
            }))}
            labels={{
              all: t("allStatus"),
              draft: t("draft"),
              published: t("published"),
              withdrawn: t("withdrawn"),
              contentStatus: t("contentStatus"),
              edit: t("editLabel"),
              unnamedProject: t("unnamedProject"),
              noContentInStatus: t("noContentInStatus"),
            }}
            emptyLabel={t("noProjects")}
            tableLabel={t("existingProjects")}
          />
        </section>
      </section>
    </AdminShell>
  );
}
