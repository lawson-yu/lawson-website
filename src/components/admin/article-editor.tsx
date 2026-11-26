"use client";

import { useActionState } from "react";
import type { FormEvent } from "react";
import type { Article } from "@/generated/prisma/client";
import { saveArticle, type ArticleActionState } from "@/server/article-actions";

const initialState: ArticleActionState = { revision: 0, values: {} };

export function ArticleEditor({ article }: { article?: Article }) {
  const [state, action, pending] = useActionState(saveArticle, initialState);
  const values = state.values;
  const isPublished = article?.status === "PUBLISHED";
  const isWithdrawn = article?.status === "WITHDRAWN";
  const slugIsFixed = Boolean(article?.firstPublishedAt);

  function confirmAction(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;
    if (!submitter.dataset.confirm) return;

    if (!window.confirm(submitter.dataset.confirm)) event.preventDefault();
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
        <label htmlFor="article-title">标题</label>
        <input
          id="article-title"
          name="title"
          autoComplete="off"
          defaultValue={values.title ?? article?.title ?? ""}
        />
      </div>

      <div className="article-editor__field">
        <label htmlFor="article-excerpt">摘要</label>
        <textarea
          id="article-excerpt"
          name="excerpt"
          rows={3}
          defaultValue={values.excerpt ?? article?.excerpt ?? ""}
        />
      </div>

      <div className="article-editor__field article-editor__field--compact">
        <label htmlFor="article-language">正文语言</label>
        <select
          id="article-language"
          name="bodyLanguage"
          defaultValue={values.bodyLanguage ?? article?.bodyLanguage ?? ""}
        >
          <option value="">请选择</option>
          <option value="zh">简体中文</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="article-editor__field article-editor__field--compact">
        <label htmlFor="article-slug">文章网址</label>
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
          {slugIsFixed ? "首次发布后网址固定。" : "发布前确认；只允许小写字母、数字和连字符。"}
        </p>
      </div>

      <div className="article-editor__field">
        <label htmlFor="article-body">正文 Markdown</label>
        <textarea
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
          data-confirm={isPublished ? "保存后文章将立即更新到公开页面。确定保存吗？" : undefined}
          disabled={pending}
        >
          {pending ? "保存中…" : isPublished ? "保存并立即公开" : "保存草稿"}
        </button>
        {!isPublished && (
          <button
            className="article-editor__publish"
            type="submit"
            name="intent"
            value="publish"
            data-confirm={isWithdrawn
              ? `确认重新发布到 /articles/${article?.slug} 吗？`
              : `确认首次发布到 /articles/${values.slug ?? article?.slug ?? "…"} 吗？`}
            disabled={pending}
          >
            {isWithdrawn ? "重新发布" : "发布文章"}
          </button>
        )}
        {isPublished && (
          <button
            className="article-editor__withdraw"
            type="submit"
            name="intent"
            value="withdraw"
            data-confirm="撤下后文章会从公开列表和收录入口移除。确定撤下吗？"
            disabled={pending}
          >
            撤下文章
          </button>
        )}
      </div>
    </form>
  );
}
