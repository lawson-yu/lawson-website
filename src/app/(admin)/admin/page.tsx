import { Suspense } from "react";
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
  const siteSetting = await getSiteSetting();
  const initialValues: SiteSettingsDraft = {
    heroIntroduction: siteSetting?.heroIntroduction ?? "",
    contactUrl: siteSetting?.contactUrl ?? "",
    socialLinks: (siteSetting?.socialLinks ?? []) as unknown as SiteSettingsDraft["socialLinks"],
  };

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <Link href="/zh">LAWSON · 管理后台</Link>
        <div>
          <span>已登录 · {session.user.email}</span>
          <SignOutButton label="退出" />
        </div>
      </header>
      <section className="admin-page__content">
        <h1>首页设置</h1>
        <p>维护首页介绍、主要联系入口和社交链接。</p>
        <Link className="admin-page__link" href="/admin/projects">
          作品管理
        </Link>
        <SiteSettingsForm initialValues={initialValues} />
      </section>
    </main>
  );
}
