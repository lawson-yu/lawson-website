"use client";

import { useActionState, useRef } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Article, Tag } from "@/generated/prisma/client";
import { CoverImageField, MarkdownImageButton } from "@/components/admin/media-uploader";
import { AdminIntlProvider } from "@/components/admin/admin-intl-provider";
import { saveArticle, type ArticleActionState } from "@/server/article-actions";

const initialState: ArticleActionState = { revision: 0, values: {} };

type ArticleEditorProps = {
  article?: Article & { tags: Tag[] };
  tags: Array<Pick<Tag, "id" | "name">>;
};

export function ArticleEditor(props: ArticleEditorProps) {
  return (
    <AdminIntlProvider>
      <ArticleEditorForm {...props} />
    </AdminIntlProvider>
  );
}

function ArticleEditorForm({ article, tags }: ArticleEditorProps) {
  const [state, action, pending] = useActionState(saveArticle, initialState);
  const t = useTranslations("Admin");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const values = state.values;
  const selectedTagIds = values.tagIds ?? article?.tags.map(({ id }) => id) ?? [];
  const isPublished = article?.status === "PUBLISHED";
  const isWithdrawn = article?.status === "WITHDRAWN";
  const slugIsFixed = Boolean(article?.firstPublishedAt);

  function confirmAction(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;

    const slug = event.currentTarget.elements.namedItem("slug");
    const confirmation = submitter.value === "publish" && !slugIsFixed && slug instanceof HTMLInputElement
      ? t("confirmFirstPublish", { slug: slug.value.trim() || "…" })
      : submitter.dataset.confirm;
    if (!confirmation) return;

    if (!window.confirm(confirmation)) event.preventDefault();
  }

  return (
    <form
      key={state.revision}
      className="article-editor"
      action={action}
      onSubmit={confirmAction}
    >
      {article && <input type="hidden" name="articleId" value={article.id} />}

      {state.message && (
        <div className="article-editor__message" role="alert">
          <p>{state.message}</p>
          {state.missing && (
            <ul>{state.missing.map((field) => <li key={field}>{field}</li>)}</ul>
          )}
        </div>
      )}

      <div className="article-editor__field">
        <label htmlFor="article-title">{t("articleTitle")}</label>
        <input
          id="article-title"
          name="title"
          autoComplete="off"
          defaultValue={values.title ?? article?.title ?? ""}
        />
      </div>

      <div className="article-editor__field">
        <label htmlFor="article-excerpt">{t("articleExcerpt")}</label>
        <textarea
          id="article-excerpt"
          name="excerpt"
          rows={3}
          defaultValue={values.excerpt ?? article?.excerpt ?? ""}
        />
      </div>

      <div className="article-editor__field article-editor__field--tags">
        <fieldset className="article-editor__tags">
          <legend>{t("articleTags")}</legend>
          {tags.length ? (
            <div className="article-editor__tag-options">
              {tags.map((tag) => (
                <label className="article-editor__tag-option" key={tag.id}>
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    defaultChecked={selectedTagIds.includes(tag.id)}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          ) : (
            <p>{t("noArticleTags")}<Link href="/admin/articles/tags">{t("createArticleTag")}</Link>{t("articleTagsSuffix")}</p>
          )}
        </fieldset>
      </div>

      <div className="article-editor__field article-editor__field--compact">
        <label htmlFor="article-language">{t("bodyLanguage")}</label>
        <select
          id="article-language"
          name="bodyLanguage"
          defaultValue={values.bodyLanguage ?? article?.bodyLanguage ?? ""}
        >
          <option value="">{t("chooseValue")}</option>
          <option value="zh">{t("simplifiedChinese")}</option>
          <option value="en">{t("englishLanguage")}</option>
        </select>
      </div>

      <div className="article-editor__field article-editor__field--compact">
        <label htmlFor="article-slug">{t("articleSlug")}</label>
        <div className="article-editor__slug">
          <span aria-hidden="true">/articles/</span>
          <input
            id="article-slug"
            name="slug"
            autoComplete="off"
            readOnly={slugIsFixed}
            aria-describedby="article-slug-help"
            defaultValue={values.slug ?? article?.slug ?? ""}
          />
        </div>
        <p id="article-slug-help">
          {slugIsFixed ? t("slugFixed") : t("slugWarning")}
        </p>
      </div>

      <div className="article-editor__field">
        <CoverImageField
          id="article-cover"
          name="coverImageKey"
          label={t("coverImage")}
          initialValue={values.coverImageKey ?? article?.coverImageKey ?? ""}
        />
      </div>

      <div className="article-editor__field">
        <div className="article-editor__label-row">
          <label htmlFor="article-body">{t("articleBody")}</label>
          <MarkdownImageButton textareaRef={bodyRef} />
        </div>
        <textarea
          ref={bodyRef}
          id="article-body"
          name="body"
          className="article-editor__body"
          spellCheck={false}
          defaultValue={values.body ?? article?.body ?? ""}
        />
      </div>

      <div className="article-editor__actions">
        <button
          type="submit"
          name="intent"
          value="save"
          data-confirm={isPublished ? t("publishedArticleConfirmation") : undefined}
          disabled={pending}
        >
          {pending ? t("saving") : isPublished ? t("saveAndPublish") : t("saveDraft")}
        </button>
        {!isPublished && (
          <button
            className="article-editor__publish"
            type="submit"
            name="intent"
            value="publish"
            data-confirm={isWithdrawn
              ? t("confirmRepublish", { slug: article?.slug ?? "" })
              : t("confirmFirstPublish", { slug: values.slug ?? article?.slug ?? "…" })}
            disabled={pending}
          >
            {isWithdrawn ? t("republish") : t("publishArticle")}
          </button>
        )}
        {isPublished && (
          <button
            className="article-editor__withdraw"
            type="submit"
            name="intent"
            value="withdraw"
            data-confirm={t("withdrawArticleConfirmation")}
            disabled={pending}
          >
            {t("withdrawArticle")}
          </button>
        )}
      </div>
    </form>
  );
}
