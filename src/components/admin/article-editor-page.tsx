import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ArticleEditor } from "@/components/admin/article-editor";
import { requireSiteOwner } from "@/server/auth";
import { getAdminArticle, getAdminTags } from "@/server/articles";
import "@/app/(admin)/admin/articles/articles-admin.css";

export function ArticleEditorPage({ articleId }: { articleId?: string }) {
  return (
    <Suspense fallback={<main className="admin-page article-admin" aria-busy="true" />}>
      <ArticleEditorContent articleId={articleId} />
    </Suspense>
  );
}

async function ArticleEditorContent({ articleId }: { articleId?: string }) {
  const session = await requireSiteOwner();
  const [article, tags] = await Promise.all([
    articleId ? getAdminArticle(articleId) : undefined,
    getAdminTags(),
  ]);
  if (articleId && !article) notFound();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });
  const statusLabel =
    article?.status === "PUBLISHED"
      ? t("published")
      : article?.status === "WITHDRAWN"
        ? t("withdrawn")
        : t("draft");

  return (
    <AdminShell activeSection="articles" userEmail={session.user.email} pageClassName="article-admin">
      <section aria-labelledby="article-editor-heading">
        <Link className="admin-back" href="/admin/articles">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("backToArticles")}
        </Link>
        <div className="admin-head">
          <h1 id="article-editor-heading">
            {article ? article.title || t("editArticleDraft") : t("writeArticle")}
          </h1>
          <span className="admin-status" data-status={statusLabel}>
            {statusLabel}
          </span>
          {article?.slug && article.status === "PUBLISHED" && (
            <Link
              className="admin-button"
              href={`/zh/articles/${article.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("viewPublicPage")} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
        <p className="admin-note">{t("articleEditorDescription")}</p>
        <ArticleEditor article={article ?? undefined} tags={tags.map(({ id, name }) => ({ id, name }))} />
      </section>
    </AdminShell>
  );
}
