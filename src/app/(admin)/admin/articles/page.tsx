import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSiteOwner } from "@/server/auth";
import { getAdminArticles } from "@/server/articles";
import { updateFeaturedArticle } from "@/server/article-actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { FeaturedManager } from "../_components/featured-manager";
import { ArticlesTable } from "./_components/articles-table";
import "./articles-admin.css";

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminArticlesContent />
    </Suspense>
  );
}

async function AdminArticlesContent() {
  const session = await requireSiteOwner();
  const articles = await getAdminArticles();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });

  const rows = articles.map((article) => ({
    id: article.id,
    title: article.title || t("unnamedArticle"),
    status: article.status,
    statusLabel:
      article.status === "PUBLISHED"
        ? t("published")
        : article.status === "WITHDRAWN"
          ? t("withdrawn")
          : t("draft"),
    dateIso: article.updatedAt.toISOString(),
    dateLabel: article.updatedAt.toISOString().slice(0, 10),
  }));

  return (
    <AdminShell activeSection="articles" userEmail={session.user.email} pageClassName="article-admin">
      <section aria-labelledby="admin-articles-heading">
        <div className="admin-head">
          <h1 id="admin-articles-heading">{t("articlesTitle")}</h1>
          <Link className="admin-button admin-button--primary" href="/admin/articles/new">
            <Plus size={17} aria-hidden="true" />
            {t("newArticle")}
          </Link>
        </div>

        <ArticlesTable
          articles={rows}
          labels={{
            all: t("allStatus"),
            draft: t("draft"),
            published: t("published"),
            withdrawn: t("withdrawn"),
            contentStatus: t("contentStatus"),
            articleTitle: t("articleTitle"),
            status: t("status"),
            lastModified: t("lastModified"),
            actions: t("actions"),
            edit: t("editLabel"),
            noContentInStatus: t("noContentInStatus"),
          }}
          emptyLabel={t("noArticles")}
          tableLabel={t("articlesTitle")}
        />

        <FeaturedManager
          kind="article"
          limit={5}
          action={updateFeaturedArticle}
          items={articles.map((article) => ({
            id: article.id,
            title: article.title || t("unnamedArticle"),
            status: article.status,
            featuredRank: article.featuredRank,
          }))}
        />
      </section>
    </AdminShell>
  );
}
