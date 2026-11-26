import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  await requireSiteOwner();
  const [article, tags] = await Promise.all([
    articleId ? getAdminArticle(articleId) : undefined,
    getAdminTags(),
  ]);
  if (articleId && !article) notFound();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });

  return (
    <main className="admin-page article-admin">
      <header className="admin-page__header">
        <Link href="/admin">{t("brand")}</Link>
        <Link href="/admin/articles">{t("backToArticles")}</Link>
      </header>
      <section className="article-admin__content article-admin__editor-content">
        <div className="article-admin__heading">
          <div>
            <p className="article-admin__eyebrow">{t("articleLabel")} · {article ? t("editLabel") : t("newLabel")}</p>
            <h1>{article ? article.title || t("editArticleDraft") : t("writeArticle")}</h1>
            <p>{t("articleEditorDescription")}</p>
          </div>
          {article?.slug && article.status === "PUBLISHED" && (
            <Link href={`/zh/articles/${article.slug}`} target="_blank" rel="noreferrer">
              {t("viewPublicPage")}
            </Link>
          )}
        </div>
        <ArticleEditor article={article ?? undefined} tags={tags.map(({ id, name }) => ({ id, name }))} />
      </section>
    </main>
  );
}
