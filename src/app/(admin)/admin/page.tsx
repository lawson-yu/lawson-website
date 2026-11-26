import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { SiteSettingsDraft } from "@/lib/site-settings";
import { requireSiteOwner } from "@/server/auth";
import { getSiteSetting } from "@/server/site-settings";
import { SignOutButton } from "@/components/public-site/public-authentication";
import { SiteSettingsForm } from "./_components/site-settings-form";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const session = await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });
  const siteSetting = await getSiteSetting();
  const initialValues: SiteSettingsDraft = {
    heroIntroduction: siteSetting?.heroIntroduction ?? "",
    contactUrl: siteSetting?.contactUrl ?? "",
    socialLinks: (siteSetting?.socialLinks ?? []) as unknown as SiteSettingsDraft["socialLinks"],
  };

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <Link href="/zh">{t("brand")}</Link>
        <div>
          <span>{t("signedIn", { email: session.user.email })}</span>
          <SignOutButton label={t("signOut")} />
        </div>
      </header>
      <section className="admin-page__content">
        <h1>{t("homeTitle")}</h1>
        <p>{t("homeDescription")}</p>
        <Link className="admin-page__link" href="/admin/articles">{t("manageArticles")}</Link>
        <Link className="admin-page__link" href="/admin/projects">{t("manageProjects")}</Link>
        <Link className="admin-page__link" href="/admin/visitors">{t("visitorRecords")}</Link>
        <SiteSettingsForm initialValues={initialValues} />
      </section>
    </main>
  );
}
