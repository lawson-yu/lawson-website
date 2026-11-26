import { Suspense } from "react";
import Link from "next/link";
import { requireSiteOwner } from "@/server/auth";
import { getAdminProjects } from "@/server/projects";
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

  return (
    <main className="admin-page admin-projects-page">
      <header className="admin-page__header">
        <Link href="/admin">LAWSON · 管理后台</Link>
        <div>
          <span>已登录 · {session.user.email}</span>
          <SignOutButton label="退出" />
        </div>
      </header>
      <section className="admin-page__content">
        <div className="admin-projects-heading">
          <div>
            <Link href="/admin" className="admin-projects-back">返回管理后台</Link>
            <h1>作品管理</h1>
            <p>保存草稿后，补齐发布信息并确认作品地址即可公开。</p>
          </div>
          <Link className="admin-page__link" href="/zh/projects" target="_blank" rel="noreferrer">
            查看公开作品
          </Link>
        </div>
        <ProjectEditor />
        <section className="admin-project-list" aria-label="已有作品">
          <h2>已有作品</h2>
          {projects.length ? projects.map((project) => (
            <details className="admin-project-row" key={project.id}>
              <summary>
                <span className="admin-project-row__title">{project.name || "未命名作品"}</span>
                <span className="admin-project-status" data-status={project.status}>
                  {project.status === "PUBLISHED" ? "已发布" : project.status === "WITHDRAWN" ? "已撤下" : "草稿"}
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
          )) : <p className="admin-project-empty">还没有作品。先保存一条草稿，随时可以回来继续编辑。</p>}
        </section>
      </section>
    </main>
  );
}
