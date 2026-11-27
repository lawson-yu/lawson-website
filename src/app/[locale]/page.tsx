import Image from "next/image";
import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { buildHomeMetadata } from "@/lib/seo";
import { getFeaturedArticles } from "@/server/articles";
import { getFeaturedProjects } from "@/server/projects";
import { HomeCharacter } from "./_components/home-character";
import { HomeParticleTransition } from "./_components/home-particle-transition";
import { getSiteSetting } from "@/server/site-settings";
import { ArticleCard } from "./articles/_components/article-card";
import { ProjectCard } from "./projects/_components/project-card";
import "./articles/articles.css";
import "./projects/projects.css";
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
    image: "design.jpg",
    alt: "明亮工作室中的空间与线条，呼应设计中的秩序与留白",
  },
  {
    title: "前端网站开发",
    description: "还原设计细节，让网站在每种屏幕上流畅呈现。",
    image: "frontend.jpg",
    alt: "桌面上的笔记本电脑与开发工作环境",
  },
  {
    title: "全栈产品开发",
    description: "连接界面、业务与数据，交付完整可用的产品。",
    image: "fullstack.jpg",
    alt: "排列整齐的服务器与连接设备",
  },
  {
    title: "AI Agent 开发",
    description: "围绕实际任务连接工具，让重复工作自动运转。",
    image: "agent.jpg",
    alt: "电路板上的芯片与连接线路",
  },
];

type HomePageProps = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

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
      </section>

      <Suspense fallback={null}>
        <HomeFeaturedContent locale={locale} />
      </Suspense>

      <section className="home-section home-process" data-home-motion="process" aria-labelledby="process-title">
        <div className="home-section__heading">
          <h2 id="process-title">{t("processTitle")}</h2>
          <p>{t("processDescription")}</p>
        </div>
        <div className="home-process__diagram" aria-hidden="true">
          <ol className="home-process__chart">
            {workflow.map((item) => (
              <li key={item.step}><span>{item.title}</span></li>
            ))}
          </ol>
          <div className="home-process__chart-timeline">
            <span>项目开始</span><span>方向确认</span><span>设计与实现</span><span>发布之后</span>
          </div>
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
              <div className="home-services__visual">
                <Image
                  src={`/images/services/${service.image}`}
                  alt={service.alt}
                  fill
                  sizes="(max-width: 767px) calc(100vw - 40px), 24vw"
                />
                <span aria-hidden="true">{service.title}</span>
              </div>
              <div className="home-services__copy">
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>
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

async function HomeFeaturedContent({ locale }: { locale: string }) {
  await connection();
  const [t, projectT, articles, projects] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Projects" }),
    getFeaturedArticles(),
    getFeaturedProjects(),
  ]);

  return (
    <>
      {articles.length > 0 && (
        <section
          className="home-section home-featured home-featured-articles"
          id="featured-articles"
          data-home-motion="featured-articles"
          aria-labelledby="featured-articles-title"
        >
          <div className="home-section__heading">
            <h2 id="featured-articles-title">{t("featuredArticlesTitle")}</h2>
          </div>
          <ul className="articles-index__grid home-featured__article-grid">
            {articles.map((article) => (
              <li className="home-featured__article" key={article.id}>
                <ArticleCard article={article} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <HomeParticleTransition />

      {projects.length > 0 && (
        <section
          className="home-section home-featured home-featured-projects"
          id="featured-projects"
          data-home-motion="home-projects"
          aria-labelledby="featured-projects-title"
        >
          <div className="home-section__heading">
            <h2 id="featured-projects-title">{t("featuredProjectsTitle")}</h2>
          </div>
          <div className="works-grid home-featured__project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                locale={locale}
                labels={{ internal: projectT("internalTarget"), external: projectT("externalTarget") }}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function HomeHeroContent() {
  await connection();
  const [t, siteSetting, articles] = await Promise.all([
    getTranslations("Home"),
    getSiteSetting(),
    getFeaturedArticles(),
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
      {articles.length > 0 && (
        <p className="home-hero__explore" data-scroll-target="#featured-articles" aria-hidden="true">
          <span className="home-hero__explore-label">{t("explore")}</span>
          <span className="home-hero__explore-description">{t("exploreDescription")}</span>
        </p>
      )}
    </div>
  );
}
