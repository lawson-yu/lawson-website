import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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

  return (
    <main className="admin-page article-admin">
      <header className="admin-page__header">
        <Link href="/admin">LAWSON · 管理后台</Link>
        <Link href="/admin/articles">返回文章管理</Link>
      </header>
      <section className="article-admin__content article-admin__editor-content">
        <div className="article-admin__heading">
          <div>
            <p className="article-admin__eyebrow">文章 · {article ? "编辑" : "新建"}</p>
            <h1>{article ? article.title || "编辑草稿" : "写一篇文章"}</h1>
            <p>先保存草稿；发布前确认文章网址和正文内容。</p>
          </div>
          {article?.slug && article.status === "PUBLISHED" && (
            <Link href={`/zh/articles/${article.slug}`} target="_blank" rel="noreferrer">
              查看公开页面
            </Link>
          )}
        </div>
        <ArticleEditor article={article ?? undefined} tags={tags.map(({ id, name }) => ({ id, name }))} />
      </section>
    </main>
  );
}
