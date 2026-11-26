"use client";

import { useActionState, useRef, type FormEvent } from "react";
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

const projectTypes = ["开发工具", "开源项目", "界面实验", "个人网站", "实验项目", "项目", "其他"];

export function ProjectEditor({ project }: { project?: ProjectEditorData }) {
  const [saveState, saveAction, saving] = useActionState(saveProject, null);
  const [publishState, publishAction, publishing] = useActionState(publishProject, null);
  const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawProject, null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const published = project?.status === "PUBLISHED";
  const frozen = Boolean(project?.firstPublishedAt);

  function confirmSave(event: FormEvent<HTMLFormElement>) {
    if (published && !window.confirm("保存后会立即更新公开作品。确认继续吗？")) {
      event.preventDefault();
    }
  }

  function confirmPublish(event: FormEvent<HTMLFormElement>) {
    const prompt = frozen
      ? "重新发布会恢复原地址和首次发布时间。确认继续吗？"
      : `请确认作品地址为“${project?.slug}”。首次发布后地址和首次发布时间将固定。`;
    if (!window.confirm(prompt)) event.preventDefault();
  }

  function confirmWithdraw(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("撤下后作品会立即从公开列表移除，站内地址将返回 404。确认撤下吗？")) {
      event.preventDefault();
    }
  }

  return (
    <section className="admin-project-editor" aria-label={project ? `编辑作品：${project.name}` : "新建作品草稿"}>
      <h2>{project ? "编辑作品" : "新建作品"}</h2>
      <form action={saveAction} onSubmit={confirmSave} className="admin-project-form">
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <label>
          标题
          <input name="name" defaultValue={project?.name ?? ""} autoComplete="off" />
        </label>
        <label>
          简介
          <textarea name="description" rows={3} defaultValue={project?.description ?? ""} />
        </label>
        <div className="admin-project-form__pair">
          <label>
            类型
            <select name="type" defaultValue={project?.type ?? ""}>
              <option value="">请选择类型</option>
              {projectTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            卡片主入口
            <select name="cardTarget" defaultValue={project?.cardTarget ?? "INTERNAL"}>
              <option value="INTERNAL">站内项目详情</option>
              <option value="EXTERNAL">外部页面</option>
            </select>
          </label>
        </div>
        <label>
          作品地址（slug）{frozen && <span className="admin-project-help">首次发布后固定</span>}
          <input name="slug" defaultValue={project?.slug ?? ""} readOnly={frozen} autoComplete="off" />
        </label>
        <label>
          外部访问地址
          <input name="url" type="url" defaultValue={project?.url ?? ""} placeholder="https://example.com" autoComplete="url" />
          <span className="admin-project-help">外部卡片必填；站内详情可选。</span>
        </label>
        <CoverImageField
          id="project-cover-image"
          name="coverImage"
          label="封面图片"
          initialValue={project?.coverImage ?? ""}
        />
        <div className="admin-project-form__body-field">
          <div className="article-editor__label-row">
            <label htmlFor="project-body">项目正文（Markdown）</label>
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
          正文语言
          <select name="contentLanguage" defaultValue={project?.contentLanguage ?? ""}>
            <option value="">请选择正文语言</option>
            <option value="zh">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="admin-project-form__actions">
          <button type="submit" disabled={saving}>{saving ? "保存中…" : published ? "保存并更新公开内容" : "保存草稿"}</button>
          <p role="status" aria-live="polite" data-kind={saveState?.kind}>{saveState?.message}</p>
        </div>
      </form>

      {project && !published && (
        <form action={publishAction} onSubmit={confirmPublish} className="admin-project-action">
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" disabled={publishing}>{publishing ? "发布中…" : frozen ? "重新发布" : "确认地址并发布"}</button>
          <p role="status" aria-live="polite" data-kind={publishState?.kind}>{publishState?.message}</p>
        </form>
      )}
      {project && published && (
        <form action={withdrawAction} onSubmit={confirmWithdraw} className="admin-project-action">
          <input type="hidden" name="id" value={project.id} />
          <button className="admin-project-action__withdraw" type="submit" disabled={withdrawing}>{withdrawing ? "撤下中…" : "撤下作品"}</button>
          <p role="status" aria-live="polite" data-kind={withdrawState?.kind}>{withdrawState?.message}</p>
        </form>
      )}
      {frozen && <p className="admin-project-help">首次发布时间：{project?.firstPublishedAt?.slice(0, 10)}</p>}
    </section>
  );
}
