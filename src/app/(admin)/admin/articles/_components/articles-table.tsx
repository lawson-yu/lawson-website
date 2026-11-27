"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type AdminArticleRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
  statusLabel: string;
  dateIso: string;
  dateLabel: string;
};

const FILTERS = ["ALL", "DRAFT", "PUBLISHED", "WITHDRAWN"] as const;
type Filter = (typeof FILTERS)[number];

export function ArticlesTable({
  articles,
  labels,
  emptyLabel,
  tableLabel,
}: {
  articles: AdminArticleRow[];
  labels: {
    all: string;
    draft: string;
    published: string;
    withdrawn: string;
    contentStatus: string;
    articleTitle: string;
    status: string;
    lastModified: string;
    actions: string;
    edit: string;
    noContentInStatus: string;
  };
  emptyLabel: string;
  tableLabel: string;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const filterLabels: Record<Filter, string> = {
    ALL: labels.all,
    DRAFT: labels.draft,
    PUBLISHED: labels.published,
    WITHDRAWN: labels.withdrawn,
  };
  const visible = articles.filter(
    (item) => filter === "ALL" || item.status === filter,
  );

  return (
    <>
      <div className="admin-filters" role="group" aria-label={labels.contentStatus}>
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      <div className="admin-table" role="region" tabIndex={0} aria-label={tableLabel}>
        <table>
          <thead>
            <tr>
              <th>{labels.articleTitle}</th>
              <th>{labels.status}</th>
              <th className="admin-date-column">{labels.lastModified}</th>
              <th>{labels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((article) => (
              <tr key={article.id}>
                <th scope="row">
                  {article.title}
                  <small className="admin-date-inline">
                    <time dateTime={article.dateIso}>{article.dateLabel}</time>
                  </small>
                </th>
                <td>
                  <span className="admin-status" data-status={article.statusLabel}>
                    {article.statusLabel}
                  </span>
                </td>
                <td className="admin-date-column">
                  <time dateTime={article.dateIso}>{article.dateLabel}</time>
                </td>
                <td>
                  <Link className="admin-table-action" href={`/admin/articles/${article.id}`}>
                    {labels.edit} <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="admin-empty">
            {filter === "ALL" ? emptyLabel : labels.noContentInStatus}
          </p>
        )}
      </div>
    </>
  );
}
