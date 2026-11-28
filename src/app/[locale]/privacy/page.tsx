import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSiteSetting } from "@/server/site-settings";
import { VISITOR_RECORD_RETENTION_MONTHS } from "@/lib/visitor-retention";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Privacy" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: {
        zh: "/zh/privacy",
        en: "/en/privacy",
      },
    },
  };
}

export default function PrivacyPage({ params }: PrivacyPageProps) {
  return (
    <Suspense fallback={<main className="privacy-page" aria-busy="true" />}>
      <PrivacyPageContent params={params} />
    </Suspense>
  );
}

async function PrivacyPageContent({ params }: PrivacyPageProps) {
  const { locale } = await params;
  const [t, siteSetting] = await Promise.all([
    getTranslations({ locale, namespace: "Privacy" }),
    getSiteSetting(),
  ]);
  const contactUrl = siteSetting?.contactUrl?.trim() || null;

  return (
    <main className="privacy-page">
      <article className="privacy-page__article">
        <header className="privacy-page__header">
          <Link className="privacy-page__back" href="/">
            {t("backHome")}
          </Link>
          <h1>{t("title")}</h1>
          <p className="privacy-page__lede">{t("description")}</p>
        </header>

        <section className="privacy-page__section">
          <h2>{t("scopeTitle")}</h2>
          <p>{t("scopeAnonymous")}</p>
          <ul>
            <li>{t("scopeAccount")}</li>
            <li>{t("scopeVisits")}</li>
          </ul>
        </section>

        <section className="privacy-page__section">
          <h2>{t("retentionTitle")}</h2>
          <p>{t("retentionBody", { months: VISITOR_RECORD_RETENTION_MONTHS })}</p>
        </section>

        <section className="privacy-page__section">
          <h2>{t("deletionTitle")}</h2>
          <p>{t("deletionBody")}</p>
          {contactUrl ? (
            <p className="privacy-page__contact">
              {t("deletionContactPrefix")}{" "}
              <a href={contactUrl} rel="noreferrer">
                {contactUrl}
              </a>
            </p>
          ) : (
            <p className="privacy-page__contact">{t("deletionContactFallback")}</p>
          )}
        </section>
      </article>
    </main>
  );
}
