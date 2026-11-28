import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { SiteSettingsDraft } from "@/lib/site-settings";
import { requireSiteOwner } from "@/server/auth";
import { getSiteSetting } from "@/server/site-settings";
import { AdminShell } from "@/components/admin/admin-shell";
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
    <AdminShell activeSection="home" userEmail={session.user.email}>
      <section aria-labelledby="admin-home-heading">
        <div className="admin-head">
          <h1 id="admin-home-heading">{t("homeTitle")}</h1>
        </div>
        <p className="admin-note">{t("homeDescription")}</p>
        <SiteSettingsForm initialValues={initialValues} />
      </section>
    </AdminShell>
  );
}
