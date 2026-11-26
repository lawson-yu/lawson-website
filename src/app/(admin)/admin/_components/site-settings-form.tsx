"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { SOCIAL_ICON_OPTIONS, type SiteSettingsDraft } from "@/lib/site-settings";
import { saveSiteSettings, type SiteSettingsActionState } from "../actions";

interface SiteSettingsFormProps {
  initialValues: SiteSettingsDraft;
}

interface EditableSocialLink {
  id: string;
  name: string;
  url: string;
  icon: string;
}

const initialActionState: SiteSettingsActionState = { status: "idle" };

const socialIconLabels = {
  code: "代码",
  work: "工作",
  camera: "相机",
  video: "视频",
  link: "通用链接",
} satisfies Record<(typeof SOCIAL_ICON_OPTIONS)[number], string>;

export function SiteSettingsForm({ initialValues }: SiteSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveSiteSettings,
    initialActionState,
  );
  const [heroIntroduction, setHeroIntroduction] = useState(
    initialValues.heroIntroduction,
  );
  const [contactUrl, setContactUrl] = useState(initialValues.contactUrl);
  const [socialLinks, setSocialLinks] = useState<EditableSocialLink[]>(() =>
    initialValues.socialLinks.map((link, index) => ({
      ...link,
      id: `initial-${index}`,
    })),
  );

  const missingFields = [
    !heroIntroduction.trim() ? "Hero 介绍" : null,
    !contactUrl.trim() ? "主要联系入口" : null,
    socialLinks.length === 0 ? "社交链接" : null,
  ].filter((field): field is string => field !== null);

  function updateSocialLink(
    id: string,
    field: "name" | "url" | "icon",
    value: string,
  ) {
    setSocialLinks((current) =>
      current.map((link) =>
        link.id === id ? { ...link, [field]: value } : link,
      ),
    );
  }

  function moveSocialLink(index: number, offset: -1 | 1) {
    setSocialLinks((current) => {
      const reordered = [...current];
      const [link] = reordered.splice(index, 1);
      reordered.splice(index + offset, 0, link);
      return reordered;
    });
  }

  return (
    <form action={formAction} className="admin-settings-form">
      {missingFields.length > 0 && (
        <p className="admin-settings-form__notice" role="status">
          尚未填写：{missingFields.join("、")}。公开首页会省略这些内容，首发前请补齐介绍和联系入口。
        </p>
      )}

      <label className="admin-settings-form__field" htmlFor="hero-introduction">
        Hero 介绍
        <textarea
          id="hero-introduction"
          name="heroIntroduction"
          value={heroIntroduction}
          onChange={(event) => setHeroIntroduction(event.target.value)}
          aria-describedby="hero-introduction-help"
        />
        <small id="hero-introduction-help">
          中英文界面共用这段原文；留空时首页不显示介绍。
        </small>
      </label>

      <label className="admin-settings-form__field" htmlFor="contact-url">
        主要联系入口
        <input
          id="contact-url"
          name="contactUrl"
          type="text"
          inputMode="url"
          value={contactUrl}
          onChange={(event) => setContactUrl(event.target.value)}
          aria-invalid={Boolean(state.errors?.contactUrl)}
          aria-describedby={
            state.errors?.contactUrl ? "contact-url-error" : "contact-url-help"
          }
        />
        <small id="contact-url-help">支持 mailto: 邮箱地址或 HTTPS 地址。</small>
        {state.errors?.contactUrl && (
          <small className="admin-settings-form__error" id="contact-url-error">
            {state.errors.contactUrl}
          </small>
        )}
      </label>

      <section className="admin-settings-form__section" aria-labelledby="social-links-title">
        <h2 id="social-links-title">社交链接</h2>
        <p>可调整顺序或移除；图标不必与链接名称对应。</p>
        <input
          type="hidden"
          name="socialLinks"
          value={JSON.stringify(
            socialLinks.map(({ name, url, icon }) => ({ name, url, icon })),
          )}
        />
        {socialLinks.map((link, index) => (
          <div className="admin-social-link" key={link.id}>
            <label className="admin-social-link__field" htmlFor={`social-name-${link.id}`}>
              名称
              <input
                id={`social-name-${link.id}`}
                value={link.name}
                onChange={(event) =>
                  updateSocialLink(link.id, "name", event.target.value)
                }
                aria-label={`第 ${index + 1} 条社交链接名称`}
                aria-invalid={Boolean(state.errors?.socialLinks)}
              />
            </label>
            <label className="admin-social-link__field" htmlFor={`social-icon-${link.id}`}>
              图标
              <select
                id={`social-icon-${link.id}`}
                value={link.icon}
                onChange={(event) =>
                  updateSocialLink(link.id, "icon", event.target.value)
                }
                aria-label={`第 ${index + 1} 条社交链接图标`}
              >
                {SOCIAL_ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {socialIconLabels[icon]}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-social-link__actions">
              <button
                type="button"
                aria-label={`将第 ${index + 1} 条社交链接上移`}
                disabled={index === 0}
                onClick={() => moveSocialLink(index, -1)}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                aria-label={`将第 ${index + 1} 条社交链接下移`}
                disabled={index === socialLinks.length - 1}
                onClick={() => moveSocialLink(index, 1)}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                aria-label={`移除第 ${index + 1} 条社交链接`}
                onClick={() =>
                  setSocialLinks((current) =>
                    current.filter((item) => item.id !== link.id),
                  )
                }
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
            <label
              className="admin-social-link__field admin-social-link__url"
              htmlFor={`social-url-${link.id}`}
            >
              HTTPS 地址
              <input
                id={`social-url-${link.id}`}
                type="url"
                value={link.url}
                onChange={(event) =>
                  updateSocialLink(link.id, "url", event.target.value)
                }
                aria-label={`第 ${index + 1} 条社交链接 HTTPS 地址`}
                aria-invalid={Boolean(state.errors?.socialLinks)}
              />
            </label>
          </div>
        ))}
        {state.errors?.socialLinks && (
          <p className="admin-settings-form__error" role="alert">
            {state.errors.socialLinks}
          </p>
        )}
        <button
          className="admin-settings-form__add"
          type="button"
          onClick={() =>
            setSocialLinks((current) => [
              ...current,
              { id: crypto.randomUUID(), name: "", url: "", icon: "link" },
            ])
          }
        >
          <Plus aria-hidden="true" size={16} /> 添加社交链接
        </button>
      </section>

      {state.message && (
        <p
          className="admin-settings-form__message"
          data-status={state.status}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
      <button className="admin-settings-form__save" disabled={isPending}>
        {isPending ? "保存中…" : "保存设置"}
      </button>
    </form>
  );
}
