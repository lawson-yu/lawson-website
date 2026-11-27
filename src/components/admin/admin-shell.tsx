import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, BookOpen, Folder, House, Tags, Users } from "lucide-react";
import { SignOutButton } from "@/components/public-site/public-authentication";

export type AdminSection = "articles" | "tags" | "projects" | "home" | "visitors";

const NAV_ITEMS: Array<{
  id: AdminSection;
  href: string;
  labelKey: "articlesTitle" | "tagsTitle" | "projectsTitle" | "homeTitle" | "visitorRecords";
  icon: typeof BookOpen;
}> = [
  { id: "articles", href: "/admin/articles", labelKey: "articlesTitle", icon: BookOpen },
  { id: "tags", href: "/admin/articles/tags", labelKey: "tagsTitle", icon: Tags },
  { id: "projects", href: "/admin/projects", labelKey: "projectsTitle", icon: Folder },
  { id: "home", href: "/admin", labelKey: "homeTitle", icon: House },
  { id: "visitors", href: "/admin/visitors", labelKey: "visitorRecords", icon: Users },
];

export async function AdminShell({
  activeSection,
  userEmail,
  pageClassName,
  children,
}: {
  activeSection: AdminSection;
  userEmail: string;
  pageClassName?: string;
  children: ReactNode;
}) {
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });

  return (
    <div className={`admin-studio${pageClassName ? ` ${pageClassName}` : ""}`}>
      <header className="admin-studio__top">
        <Link className="admin-studio__brand" href="/zh">
          LAWSON
        </Link>
        <span className="admin-studio__subtitle">{t("adminSubtitle")}</span>
        <div className="admin-studio__account">
          <span className="admin-studio__user">{t("signedIn", { email: userEmail })}</span>
          <Link className="admin-studio__exit" href="/zh" target="_blank" rel="noreferrer">
            {t("browseWebsite")} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <SignOutButton label={t("signOut")} />
        </div>
      </header>

      <nav className="admin-studio__nav" aria-label={t("adminNavigation")}>
        {NAV_ITEMS.map(({ id, href, labelKey, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            aria-current={activeSection === id ? "page" : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            {t(labelKey)}
          </Link>
        ))}
      </nav>

      <main className="admin-studio__main" id="admin-main">
        <div className="admin-studio__content">{children}</div>
      </main>
    </div>
  );
}
