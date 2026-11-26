import { Suspense } from "react";
import Link from "next/link";
import { manageArticleTag } from "@/server/tag-actions";
import { requireSiteOwner } from "@/server/auth";
import { getAdminTags } from "@/server/articles";
import "../articles-admin.css";

const resultMessages = {
  created: "标签已新增。",
  renamed: "标签名称已更新。",
  removed: "标签已移除，关联文章仍保持公开。",
  empty: "请输入标签名称。",
  duplicate: "已有同名标签，请换一个名称。",
  missing: "标签不存在，列表已更新。",
  invalid: "操作无效，请重新提交。",
} as const;

type TagPageProps = {
  searchParams: Promise<{ result?: string }>;
};

export default function AdminArticleTagsPage({ searchParams }: TagPageProps) {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminArticleTagsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminArticleTagsContent({ searchParams }: TagPageProps) {
  await requireSiteOwner();
  const [{ result }, tags] = await Promise.all([searchParams, getAdminTags()]);
  const message = result && Object.hasOwn(resultMessages, result)
    ? resultMessages[result as keyof typeof resultMessages]
    : undefined;
  const error = result === "empty" || result === "duplicate" || result === "missing" || result === "invalid";

  return (
    <main className="admin-page article-admin tag-admin">
      <header className="admin-page__header">
        <Link href="/admin">LAWSON · 管理后台</Link>
        <Link href="/admin/articles">返回文章管理</Link>
      </header>
      <section className="article-admin__content">
        <div className="article-admin__heading">
          <div>
            <h1>标签管理</h1>
            <p>维护公开文章的主题标签。移除标签只会解除关联，不会撤下文章。</p>
          </div>
        </div>

        {message && <p className="tag-admin__notice" data-status={error ? "error" : "success"} role="status">{message}</p>}

        <form action={manageArticleTag} className="tag-admin__create">
          <input type="hidden" name="intent" value="create" />
          <label className="tag-admin__field" htmlFor="new-article-tag">
            新建标签
            <input id="new-article-tag" name="name" required />
          </label>
          <button className="article-admin__primary" type="submit">新增标签</button>
        </form>

        {tags.length ? (
          <ul className="tag-admin__list">
            {tags.map((tag) => (
              <li className="tag-admin__row" key={tag.id}>
                <div>
                  <p className="tag-admin__usage">关联 {tag._count.articles} 篇文章</p>
                  <form action={manageArticleTag} className="tag-admin__rename">
                    <input type="hidden" name="intent" value="rename" />
                    <input type="hidden" name="id" value={tag.id} />
                    <label className="tag-admin__field" htmlFor={`article-tag-${tag.id}`}>
                      标签名称
                      <input id={`article-tag-${tag.id}`} name="name" required defaultValue={tag.name} />
                    </label>
                    <button type="submit">保存名称</button>
                  </form>
                </div>
                <form action={manageArticleTag}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={tag.id} />
                  <button className="tag-admin__remove" type="submit" aria-label={`移除标签 ${tag.name}`}>
                    移除标签
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="article-admin__empty">还没有标签。新增后即可添加到文章。</p>
        )}
      </section>
    </main>
  );
}
