import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buildHomeMetadata } from "@/lib/seo";
import { getFeaturedArticles } from "@/server/articles";
import { getSiteSetting } from "@/server/site-settings";
import { HomeCharacter } from "./_components/home-character";
import { HomeParticleTransition } from "./_components/home-particle-transition";
import { HomeArticleShowcase, HomeProjectShowcase, HomeWorkServices } from "./_components/home-showcases";
import { PageScrollbar } from "./_components/page-scrollbar";
import "./home.css";
import "./home-approved.css";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await connection();
  const { locale } = await params;
  const description = locale === "en" ? "Lawson's personal website" : "Lawson 的个人网站";
  return buildHomeMetadata({
    locale,
    title: "LAWSON",
    description,
  });
}

type HomePageProps = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <main className="kin-site home-page" id="home-content">
      <HomeCharacter alt={t("characterAlt")} />
      <section className="hero home-hero" id="top" data-screen="hero" aria-label="LAWSON">
        <h1 className="sr-only">Lawson</h1>
        <div className="hero__content">
          <div className="hero__right">
            <h2 className="hero__heading" lang="en">IDEAS INTO<br />REALITY.</h2>
            <div className="hero__description">
              <Suspense fallback={null}>
                <HomeIntroduction />
              </Suspense>
            </div>
          </div>
          <p className="hero__left" lang="en">STAY CURIOUS.<br />KEEP BUILDING.</p>
          <Suspense fallback={null}>
            <HomeExplore locale={locale} />
          </Suspense>
          <div className="proto-cta" data-variant="D" data-home-content-slot>
            <HomeArticleLink label={t("readArticles")} />
            <Suspense fallback={null}>
              <HomeContact label={t("contact")} />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <HomeFeaturedContent locale={locale} />
      </Suspense>

      <HomeWorkServices locale={locale} />
      <div className="bottom-veil" aria-hidden="true">
        {[0.75, 1.5, 3, 6, 12, 24].map((blur, index) => (
          <i key={blur} style={{
            backdropFilter: `blur(${blur}px)`,
            WebkitBackdropFilter: `blur(${blur}px)`,
            maskImage: `linear-gradient(to bottom, transparent ${index / 6 * 100}%, #000 ${Math.min(100, (index + 1) / 6 * 100)}%, #000 ${Math.min(100, (index + 2) / 6 * 100)}%, ${index + 3 > 6 ? "#000" : "transparent"} ${Math.min(100, (index + 3) / 6 * 100)}%)`,
          }} />
        ))}
      </div>
      <PageScrollbar label={t("scrollPosition")} />
    </main>
  );
}

function HomeArticleLink({ label }: { label: string }) {
  return (
    <Link className="proto-cta__primary home-hero__primary" href="/articles">
      {label}
      <ArrowUpRight aria-hidden="true" size={16} />
    </Link>
  );
}

async function HomeFeaturedContent({ locale }: { locale: string }) {
  await connection();

  return (
    <>
      <HomeArticleShowcase locale={locale} />
      <HomeParticleTransition />
      <HomeProjectShowcase locale={locale} />
    </>
  );
}

async function HomeIntroduction() {
  await connection();
  const setting = await getSiteSetting();
  return setting?.heroIntroduction ? (
    <p>{setting.heroIntroduction}</p>
  ) : null;
}

async function HomeContact({ label }: { label: string }) {
  await connection();
  const setting = await getSiteSetting();
  return setting?.contactUrl ? (
    <a className="proto-cta__secondary home-hero__secondary" href={setting.contactUrl}>{label}</a>
  ) : null;
}

async function HomeExplore({ locale }: { locale: string }) {
  await connection();
  const articles = await getFeaturedArticles();
  if (articles.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <p className="hero__explore home-hero__explore" aria-hidden="true">
      <span className="home-hero__explore-label" lang="en">{t("explore")}</span>
      <ArrowDown aria-hidden="true" size={16} strokeWidth={1.75} />
      <span className="home-hero__explore-description">{t("exploreDescription")}</span>
    </p>
  );
}
