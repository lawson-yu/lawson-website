"use client";

import { useActionState, useRef, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AdminIntlProvider } from "@/components/admin/admin-intl-provider";
import { CoverImageField, MarkdownImageButton } from "@/components/admin/media-uploader";
import {
  publishProject,
  saveProject,
  withdrawProject,
} from "@/server/actions/projects";

type ProjectEditorData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  cardTarget: "INTERNAL" | "EXTERNAL";
  status: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
  url: string | null;
  coverImage: string | null;
  body: string | null;
  contentLanguage: string | null;
  firstPublishedAt: string | null;
};

const projectTypes = [
  "projectTypeDevelopmentTool",
  "projectTypeOpenSource",
  "projectTypeInterfaceExperiment",
  "projectTypePersonalWebsite",
  "projectTypeExperimental",
  "projectTypeProject",
  "projectTypeOther",
] as const;

export function ProjectEditor({ project }: { project?: ProjectEditorData }) {
  return (
    <AdminIntlProvider>
      <ProjectEditorForm project={project} />
    </AdminIntlProvider>
  );
}

function ProjectEditorForm({ project }: { project?: ProjectEditorData }) {
  const t = useTranslations("Admin");
  const [saveState, saveAction, saving] = useActionState(saveProject, null);
  const [publishState, publishAction, publishing] = useActionState(publishProject, null);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawProject, null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const published = project?.status === "PUBLISHED";
  const frozen = Boolean(project?.firstPublishedAt);

  function confirmSave(event: FormEvent<HTMLFormElement>) {
    if (published && !window.confirm(t("projectUpdateConfirmation"))) {
      event.preventDefault();
    }
  }

  function confirmPublish(event: FormEvent<HTMLFormElement>) {
    const prompt = frozen
      ? t("projectRepublishConfirmation")
      : t("projectFirstPublishConfirmation", { slug: project?.slug ?? "" });
    if (!window.confirm(prompt)) event.preventDefault();
  }

  function confirmWithdraw(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(t("projectWithdrawConfirmation"))) {
      event.preventDefault();
    }
  }

  return (
    <section className="admin-project-editor" aria-label={project ? t("editProjectLabel", { name: project.name }) : t("newProjectLabel")}>
      <h2>{project ? t("editProject") : t("newProject")}</h2>
      <form action={saveAction} onSubmit={confirmSave} className="admin-project-form">
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <label>
          {t("articleTitle")}
          <input name="name" defaultValue={project?.name ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("projectDescription")}
          <textarea name="description" rows={3} defaultValue={project?.description ?? ""} />
        </label>
        <div className="admin-project-form__pair">
          <label>
            {t("projectType")}
            <select name="type" defaultValue={project?.type ?? ""}>
              <option value="">{t("chooseProjectType")}</option>
              {projectTypes.map((type) => <option key={type} value={t(type)}>{t(type)}</option>)}
            </select>
          </label>
          <label>
            {t("cardTarget")}
            <select name="cardTarget" defaultValue={project?.cardTarget ?? "INTERNAL"}>
              <option value="INTERNAL">{t("internalProjectDetails")}</option>
              <option value="EXTERNAL">{t("externalPage")}</option>
            </select>
          </label>
        </div>
        <label>
          {t("projectSlug")}{frozen && <span className="admin-project-help">{t("slugFixedAfterPublish")}</span>}
          <input name="slug" defaultValue={project?.slug ?? ""} readOnly={frozen} autoComplete="off" />
        </label>
        <label>
          {t("externalUrl")}
          <input name="url" type="url" defaultValue={project?.url ?? ""} placeholder="https://example.com" autoComplete="url" />
          <span className="admin-project-help">{t("externalUrlHelp")}</span>
        </label>
        <CoverImageField
          id="project-cover-image"
          name="coverImage"
          label={t("coverImage")}
          initialValue={project?.coverImage ?? ""}
        />
        <div className="admin-project-form__body-field">
          <div className="article-editor__label-row">
            <label htmlFor="project-body">{t("projectBody")}</label>
            <MarkdownImageButton textareaRef={bodyRef} />
          </div>
          <textarea
            ref={bodyRef}
            id="project-body"
            className="admin-project-form__body"
            name="body"
            rows={14}
            defaultValue={project?.body ?? ""}
          />
        </div>
        <label>
          {t("bodyLanguage")}
          <select name="contentLanguage" defaultValue={project?.contentLanguage ?? ""}>
            <option value="">{t("chooseBodyLanguage")}</option>
            <option value="zh">{t("simplifiedChinese")}</option>
            <option value="en">{t("englishLanguage")}</option>
          </select>
        </label>
        <div className="admin-project-form__actions">
          <button type="submit" disabled={saving}>{saving ? t("saving") : published ? t("saveAndUpdateProject") : t("saveDraft")}</button>
          <p role="status" aria-live="polite" data-kind={saveState?.kind}>{saveState?.message}</p>
        </div>
      </form>

      {project && !published && (
        <form action={publishAction} onSubmit={confirmPublish} className="admin-project-action">
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" disabled={publishing}>{publishing ? t("publishing") : frozen ? t("republish") : t("confirmProjectPublish")}</button>
          <p role="status" aria-live="polite" data-kind={publishState?.kind}>{publishState?.message}</p>
        </form>
      )}
      {project && published && (
        <form action={withdrawAction} onSubmit={confirmWithdraw} className="admin-project-action">
          <input type="hidden" name="id" value={project.id} />
          <button className="admin-project-action__withdraw" type="submit" disabled={withdrawing}>{withdrawing ? t("withdrawingProject") : t("withdrawProject")}</button>
          <p role="status" aria-live="polite" data-kind={withdrawState?.kind}>{withdrawState?.message}</p>
        </form>
      )}
      {frozen && <p className="admin-project-help">{t("firstPublishDate", { date: project?.firstPublishedAt?.slice(0, 10) ?? "" })}</p>}
    </section>
  );
}
