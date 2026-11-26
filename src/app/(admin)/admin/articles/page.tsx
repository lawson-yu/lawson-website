import { Suspense } from "react";
import Link from "next/link";
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

  return (
    <main className="admin-page article-admin">
      <header className="admin-page__header">
        <Link href="/admin">LAWSON · 管理后台</Link>
        <div className="article-admin__header-actions">
          <Link href="/admin/articles/tags">管理标签</Link>
          <Link href="/admin/articles/new">新建文章</Link>
        </div>
      </header>
      <section className="article-admin__content">
        <div className="article-admin__heading">
          <div>
            <h1>文章管理</h1>
            <p>保存草稿，确认网址后再发布。</p>
          </div>
          <Link className="article-admin__primary" href="/admin/articles/new">新建文章</Link>
        </div>

        <FeaturedManager
          kind="article"
          limit={5}
          action={updateFeaturedArticle}
          items={articles.map((article) => ({
            id: article.id,
            title: article.title || "未命名文章",
            status: article.status,
            featuredRank: article.featuredRank,
          }))}
        />

        {articles.length ? (
          <ul className="article-admin__list">
            {articles.map((article) => (
              <li key={article.id}>
                <Link href={`/admin/articles/${article.id}`}>
                  <span className="article-admin__article-title">{article.title || "未命名文章"}</span>
                  <span className={`article-admin__status article-admin__status--${article.status.toLowerCase()}`}>
                    {article.status === "PUBLISHED" ? "已发布" : article.status === "WITHDRAWN" ? "已撤下" : "草稿"}
                  </span>
                  <time dateTime={article.updatedAt.toISOString()}>
                    更新于 {new Intl.DateTimeFormat("zh-CN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(article.updatedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="article-admin__empty">还没有文章。从一篇草稿开始。</p>
        )}
      </section>
    </main>
  );
}
