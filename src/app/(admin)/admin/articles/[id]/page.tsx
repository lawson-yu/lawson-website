import { Suspense } from "react";
import { ArticleEditorPage } from "@/components/admin/article-editor-page";

type EditArticlePageProps = { params: Promise<{ id: string }> };

export default function EditArticlePage({ params }: EditArticlePageProps) {
  return (
    <Suspense fallback={<main className="admin-page article-admin" aria-busy="true" />}>
      <ResolvedArticleEditor params={params} />
    </Suspense>
  );
}

async function ResolvedArticleEditor({ params }: EditArticlePageProps) {
  const { id } = await params;
  return <ArticleEditorPage articleId={id} />;
}
