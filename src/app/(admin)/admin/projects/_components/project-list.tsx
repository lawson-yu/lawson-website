"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProjectEditor, type ProjectEditorData } from "./project-editor";

const FILTERS = ["ALL", "DRAFT", "PUBLISHED", "WITHDRAWN"] as const;
type Filter = (typeof FILTERS)[number];
type ProjectListItem = ProjectEditorData & { statusLabel: string };

export function ProjectList({
  projects,
  labels,
  emptyLabel,
  tableLabel,
}: {
  projects: ProjectListItem[];
  labels: {
    all: string;
    draft: string;
    published: string;
    withdrawn: string;
    contentStatus: string;
    edit: string;
    unnamedProject: string;
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
  const filters = FILTERS;
  const visible = projects.filter(
    (project) => filter === "ALL" || project.status === filter,
  );

  return (
    <>
      <div className="admin-filters" role="group" aria-label={labels.contentStatus}>
        {filters.map((key) => (
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

      <div className="admin-project-table" role="region" aria-label={tableLabel}>
        {visible.length ? (
          visible.map((project) => (
            <details className="admin-project-row" key={project.id}>
              <summary>
                <span className="admin-project-row__title">{project.name || labels.unnamedProject}</span>
                <span className="admin-status admin-project-status" data-status={project.statusLabel}>
                  {project.statusLabel}
                </span>
                <span className="admin-project-row__slug">{project.slug}</span>
                <span className="admin-table-action" aria-hidden="true">
                  {labels.edit} <ArrowRight size={15} />
                </span>
              </summary>
              <ProjectEditor project={project} />
            </details>
          ))
        ) : (
          <p className="admin-empty">
            {filter === "ALL" ? emptyLabel : labels.noContentInStatus}
          </p>
        )}
      </div>
    </>
  );
}
