import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSiteOwner } from "@/server/auth";
import { getAdminArticles } from "@/server/articles";
import { updateFeaturedArticle } from "@/server/article-actions";
import { FeaturedManager } from "../_components/featured-manager";
import "./articles-admin.css";

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminArticlesContent />
    </Suspense>
  );
}

async function AdminArticlesContent() {
  await requireSiteOwner();
  const articles = await getAdminArticles();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });

  return (
    <main className="admin-page article-admin">
      <header className="admin-page__header">
        <Link href="/admin">{t("brand")}</Link>
        <div className="article-admin__header-actions">
          <Link href="/admin/articles/tags">{t("manageTags")}</Link>
          <Link href="/admin/articles/new">{t("newArticle")}</Link>
        </div>
      </header>
      <section className="article-admin__content">
        <div className="article-admin__heading">
          <div>
            <h1>{t("articlesTitle")}</h1>
            <p>{t("articlesDescription")}</p>
          </div>
          <Link className="article-admin__primary" href="/admin/articles/new">{t("newArticle")}</Link>
        </div>

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

        {articles.length ? (
          <ul className="article-admin__list">
            {articles.map((article) => (
              <li key={article.id}>
                <Link href={`/admin/articles/${article.id}`}>
                  <span className="article-admin__article-title">{article.title || t("unnamedArticle")}</span>
                  <span className={`article-admin__status article-admin__status--${article.status.toLowerCase()}`}>
                    {article.status === "PUBLISHED" ? t("published") : article.status === "WITHDRAWN" ? t("withdrawn") : t("draft")}
                  </span>
                  <time dateTime={article.updatedAt.toISOString()}>
                    {t("updatedAt", { date: new Intl.DateTimeFormat("zh-CN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(article.updatedAt) })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="article-admin__empty">{t("noArticles")}</p>
        )}
      </section>
    </main>
  );
}
