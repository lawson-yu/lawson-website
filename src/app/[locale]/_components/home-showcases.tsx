import { getTranslations } from "next-intl/server";
import { getFeaturedArticles } from "@/server/articles";
import { getFeaturedProjects } from "@/server/projects";
import { ArticleShowcase } from "./article-showcase";
import { ProjectShowcase, type ProjectShowcaseItem } from "./project-showcase";
import { WorkServices, type ProcessStage, type ServiceCard } from "./work-services";

export async function HomeArticleShowcase({ locale }: { locale: string }) {
  const [t, articles] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getFeaturedArticles(),
  ]);
  const items = articles
    .filter((article): article is typeof article & { slug: string } => Boolean(article.slug))
    .map(({ id, slug, title, excerpt }) => ({ id, slug, title, excerpt }));
  if (items.length === 0) return null;

  return (
    <ArticleShowcase
      title={t("featuredArticlesTitle")}
      articles={items}
    />
  );
}

export async function HomeProjectShowcase({ locale }: { locale: string }) {
  const [homeT, projectT, projects] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Projects" }),
    getFeaturedProjects(),
  ]);
  if (projects.length === 0) return null;

  const items: ProjectShowcaseItem[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    cardTarget: project.cardTarget,
    url: project.url,
    coverImage: project.coverImage,
    previewLabel: homeT("previewProject", { name: project.name }),
  }));

  return (
    <ProjectShowcase
      heading={homeT("featuredProjectsTitle")}
      hint={homeT("projectShowcaseHint")}
      internalLabel={projectT("internalTarget")}
      externalLabel={projectT("externalTarget")}
      projects={items}
    />
  );
}

export async function HomeWorkServices({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <WorkServices
      processTitle={t("workProcessTitle")}
      processTitleAccent={t("workProcessTitleAccent")}
      processDescription={t("workProcessDescription")}
      processChartLabel={t("processChartLabel")}
      processChartNote={t("processChartNote")}
      stages={t.raw("processStages") as ProcessStage[]}
      timeline={t.raw("processTimeline") as string[]}
      servicesTitle={t("workServicesTitle")}
      servicesTitleAccent={t("workServicesTitleAccent")}
      servicesDescription={t("workServicesDescription")}
      services={t.raw("serviceCards") as ServiceCard[]}
    />
  );
}
