import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { manageArticleTag } from "@/server/tag-actions";
import { requireSiteOwner } from "@/server/auth";
import { getAdminTags } from "@/server/articles";
import "../articles-admin.css";

const resultMessages = {
  created: "tagCreated",
  renamed: "tagRenamed",
  removed: "tagRemoved",
  empty: "tagNameRequired",
  duplicate: "tagDuplicate",
  missing: "tagMissing",
  invalid: "invalidOperation",
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
  const session = await requireSiteOwner();
  const [{ result }, tags] = await Promise.all([searchParams, getAdminTags()]);
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });
  const messageKey = result && Object.hasOwn(resultMessages, result)
    ? resultMessages[result as keyof typeof resultMessages]
    : undefined;
  const message = messageKey ? t(messageKey) : undefined;
  const error = result === "empty" || result === "duplicate" || result === "missing" || result === "invalid";

  return (
    <AdminShell activeSection="tags" userEmail={session.user.email} pageClassName="article-admin tag-admin">
      <section aria-labelledby="admin-tags-heading">
        <div className="admin-head">
          <h1 id="admin-tags-heading">{t("tagsTitle")}</h1>
        </div>
        <p className="admin-note">{t("tagsDescription")}</p>

        {message && (
          <p className="tag-admin__notice admin-feedback" data-status={error ? "error" : "success"} role="status">
            {message}
          </p>
        )}

        <form action={manageArticleTag} className="tag-admin__create">
          <input type="hidden" name="intent" value="create" />
          <label className="tag-admin__field" htmlFor="new-article-tag">
            {t("createTag")}
            <input id="new-article-tag" name="name" placeholder={t("tagName")} required />
          </label>
          <button className="admin-button admin-button--primary" type="submit">{t("addTag")}</button>
        </form>

        {tags.length ? (
          <ul className="tag-admin__list admin-list">
            {tags.map((tag) => (
              <li className="tag-admin__row" key={tag.id}>
                <div>
                  <p className="tag-admin__usage">{t("tagCount", { count: tag._count.articles })}</p>
                  <form action={manageArticleTag} className="tag-admin__rename">
                    <input type="hidden" name="intent" value="rename" />
                    <input type="hidden" name="id" value={tag.id} />
                    <label className="tag-admin__field" htmlFor={`article-tag-${tag.id}`}>
                      {t("tagName")}
                      <input id={`article-tag-${tag.id}`} name="name" required defaultValue={tag.name} />
                    </label>
                    <button className="admin-table-action" type="submit">{t("saveTagName")}</button>
                  </form>
                </div>
                <form action={manageArticleTag}>
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={tag.id} />
                  <button className="admin-table-action tag-admin__remove" type="submit" aria-label={t("removeTagLabel", { name: tag.name })}>
                    {t("removeTag")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-empty">{t("noTags")}</p>
        )}
      </section>
    </AdminShell>
  );
}
