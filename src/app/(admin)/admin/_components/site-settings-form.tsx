"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { AdminIntlProvider } from "@/components/admin/admin-intl-provider";
import { SOCIAL_ICON_OPTIONS, type SiteSettingsDraft } from "@/lib/site-settings";
import { saveSiteSettings, type SiteSettingsActionState } from "@/server/site-settings-actions";

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
  code: "socialIconCode",
  work: "socialIconWork",
  camera: "socialIconCamera",
  video: "socialIconVideo",
  link: "socialIconLink",
} satisfies Record<(typeof SOCIAL_ICON_OPTIONS)[number], string>;

export function SiteSettingsForm(props: SiteSettingsFormProps) {
  return (
    <AdminIntlProvider>
      <SiteSettingsFormContent {...props} />
    </AdminIntlProvider>
  );
}

function SiteSettingsFormContent({ initialValues }: SiteSettingsFormProps) {
  const t = useTranslations("Admin");
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
    !heroIntroduction.trim() ? t("homeIntroductionLabel") : null,
    !contactUrl.trim() ? t("contactLinkLabel") : null,
    socialLinks.length === 0 ? t("socialLinksLabel") : null,
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
          {t("homeMissingFields", { fields: missingFields.join("、") })}
        </p>
      )}

      <label className="admin-settings-form__field" htmlFor="hero-introduction">
        {t("homeIntroductionLabel")}
        <textarea
          id="hero-introduction"
          name="heroIntroduction"
          value={heroIntroduction}
          onChange={(event) => setHeroIntroduction(event.target.value)}
          aria-describedby="hero-introduction-help"
        />
        <small id="hero-introduction-help">
          {t("homeIntroductionHelp")}
        </small>
      </label>

      <label className="admin-settings-form__field" htmlFor="contact-url">
        {t("contactLinkLabel")}
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
        <small id="contact-url-help">{t("contactLinkHelp")}</small>
        {state.errors?.contactUrl && (
          <small className="admin-settings-form__error" id="contact-url-error">
            {state.errors.contactUrl}
          </small>
        )}
      </label>

      <section className="admin-settings-form__section" aria-labelledby="social-links-title">
        <h2 id="social-links-title">{t("socialLinksLabel")}</h2>
        <p>{t("socialLinksHelp")}</p>
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
              {t("socialLinkName")}
              <input
                id={`social-name-${link.id}`}
                value={link.name}
                onChange={(event) =>
                  updateSocialLink(link.id, "name", event.target.value)
                }
                aria-label={t("socialLinkNameLabel", { index: index + 1 })}
                aria-invalid={Boolean(state.errors?.socialLinks)}
              />
            </label>
            <label className="admin-social-link__field" htmlFor={`social-icon-${link.id}`}>
              {t("socialLinkIcon")}
              <select
                id={`social-icon-${link.id}`}
                value={link.icon}
                onChange={(event) =>
                  updateSocialLink(link.id, "icon", event.target.value)
                }
                aria-label={t("socialLinkIconLabel", { index: index + 1 })}
              >
                {SOCIAL_ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {t(socialIconLabels[icon])}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-social-link__actions">
              <button
                type="button"
                aria-label={t("moveSocialLinkUp", { index: index + 1 })}
                disabled={index === 0}
                onClick={() => moveSocialLink(index, -1)}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                aria-label={t("moveSocialLinkDown", { index: index + 1 })}
                disabled={index === socialLinks.length - 1}
                onClick={() => moveSocialLink(index, 1)}
              >
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                aria-label={t("removeSocialLink", { index: index + 1 })}
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
              {t("socialLinkUrl")}
              <input
                id={`social-url-${link.id}`}
                type="url"
                value={link.url}
                onChange={(event) =>
                  updateSocialLink(link.id, "url", event.target.value)
                }
                aria-label={t("socialLinkUrlLabel", { index: index + 1 })}
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
          <Plus aria-hidden="true" size={16} /> {t("addSocialLink")}
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
        {isPending ? t("saving") : t("saveSettings")}
      </button>
    </form>
  );
}
