import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buildHomeMetadata } from "@/lib/seo";
import { HomeCharacter } from "./_components/home-character";
import { getSiteSetting } from "@/server/site-settings";
import "./home.css";

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

const workflow = [
  {
    step: "01",
    title: "理解问题",
    timing: "开始 · 了解背景",
    description: "从目标、背景与约束出发，找到真正需要解决的问题。",
  },
  {
    step: "02",
    title: "明确方向",
    timing: "前期 · 对齐需求",
    description: "梳理需求与用户路径，一起确认要做什么。",
  },
  {
    step: "03",
    title: "设计与开发",
    timing: "中期 · 持续共创",
    description: "从体验设计到功能实现，让想法逐步成为可用的产品。",
  },
  {
    step: "04",
    title: "上线与迭代",
    timing: "发布后 · 持续改进",
    description: "完成上线，观察反馈，让产品随着真实需求成长。",
  },
];

const services = [
  {
    title: "UI 与交互设计",
    description: "理清用户路径，把想法变成清晰、自然的体验。",
  },
  {
    title: "前端网站开发",
    description: "还原设计细节，让网站在每种屏幕上流畅呈现。",
  },
  {
    title: "全栈产品开发",
    description: "连接界面、业务与数据，交付完整可用的产品。",
  },
  {
    title: "AI Agent 开发",
    description: "围绕实际任务连接工具，让重复工作自动运转。",
  },
];

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="home-page">
      <HomeCharacter alt={t("characterAlt")} />
      <section className="home-hero" id="top" aria-label="LAWSON">
        <Suspense
          fallback={
            <div className="home-hero__content" data-home-content-slot>
              <p className="home-hero__slogan">STAY CURIOUS. KEEP BUILDING.</p>
              <div className="home-hero__actions">
                <HomeArticleLink label={t("readArticles")} />
              </div>
            </div>
          }
        >
          <HomeHeroContent />
        </Suspense>
        <p className="home-hero__explore" data-scroll-target="#featured-articles" aria-hidden="true">
          <span className="home-hero__explore-label">{t("explore")}</span>
          <span className="home-hero__explore-description">{t("exploreDescription")}</span>
        </p>
      </section>

      <section className="home-section home-process" data-home-motion="process" aria-labelledby="process-title">
        <div className="home-section__heading">
          <h2 id="process-title">{t("processTitle")}</h2>
          <p>{t("processDescription")}</p>
        </div>
        <ol className="home-process__list">
          {workflow.map((item) => (
            <li key={item.step}>
              <span className="home-process__step">{item.step}</span>
              <div>
                <h3>{item.title}</h3>
                <p className="home-process__timing">{item.timing}</p>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section home-services" aria-labelledby="services-title">
        <div className="home-section__heading">
          <h2 id="services-title">{t("servicesTitle")}</h2>
          <p>{t("servicesDescription")}</p>
        </div>
        <ul className="home-services__list">
          {services.map((service) => (
            <li key={service.title}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function HomeArticleLink({ label }: { label: string }) {
  return (
    <Link className="home-hero__primary" href="/articles">
      {label}
      <ArrowUpRight aria-hidden="true" size={16} />
    </Link>
  );
}

async function HomeHeroContent() {
  const [t, siteSetting] = await Promise.all([
    getTranslations("Home"),
    getSiteSetting(),
  ]);

  return (
    <div className="home-hero__content" data-home-content-slot>
      <p className="home-hero__slogan">STAY CURIOUS. KEEP BUILDING.</p>
      {siteSetting?.heroIntroduction && (
        <p className="home-hero__introduction">
          {siteSetting.heroIntroduction}
        </p>
      )}
      <div className="home-hero__actions">
        <HomeArticleLink label={t("readArticles")} />
        {siteSetting?.contactUrl && (
          <a className="home-hero__secondary" href={siteSetting.contactUrl}>
            {t("contact")}
          </a>
        )}
      </div>
    </div>
  );
}
