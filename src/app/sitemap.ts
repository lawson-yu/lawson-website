import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getContentLocale } from "@/lib/content-language";
import { getSiteOrigin } from "@/lib/seo";
import { getPublishedArticleSitemapEntries } from "@/server/articles";
import { getPublishedProjectSitemapEntries } from "@/server/projects";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = getSiteOrigin();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/zh`,
      alternates: { languages: { zh: `${origin}/zh`, en: `${origin}/en` } },
    },
    {
      url: `${origin}/en`,
      alternates: { languages: { zh: `${origin}/zh`, en: `${origin}/en` } },
    },
    {
      url: `${origin}/zh/articles`,
      alternates: { languages: { zh: `${origin}/zh/articles`, en: `${origin}/en/articles` } },
    },
    {
      url: `${origin}/en/articles`,
      alternates: { languages: { zh: `${origin}/zh/articles`, en: `${origin}/en/articles` } },
    },
    {
      url: `${origin}/zh/projects`,
      alternates: { languages: { zh: `${origin}/zh/projects`, en: `${origin}/en/projects` } },
    },
    {
      url: `${origin}/en/projects`,
      alternates: { languages: { zh: `${origin}/zh/projects`, en: `${origin}/en/projects` } },
    },
  ];

  // 无库构建阶段只输出静态公开入口，避免阻塞 next build。
  if (!process.env.DATABASE_URL) return staticEntries;

  try {
    const [articles, projects] = await Promise.all([
      getPublishedArticleSitemapEntries(),
      getPublishedProjectSitemapEntries(),
    ]);

    const articleEntries: MetadataRoute.Sitemap = articles
      .filter((article): article is typeof article & { slug: string } => Boolean(article.slug))
      .map((article) => {
        const bodyLocale = getContentLocale(article.bodyLanguage);
        return {
          url: `${origin}/${bodyLocale}/articles/${article.slug}`,
          lastModified: article.updatedAt,
          alternates: {
            languages: {
              zh: `${origin}/zh/articles/${article.slug}`,
              en: `${origin}/en/articles/${article.slug}`,
            },
          },
        };
      });

    const projectEntries: MetadataRoute.Sitemap = projects.map((project) => {
      const bodyLocale = getContentLocale(project.contentLanguage);
      return {
        url: `${origin}/${bodyLocale}/projects/${project.slug}`,
        lastModified: project.updatedAt,
        alternates: {
          languages: {
            zh: `${origin}/zh/projects/${project.slug}`,
            en: `${origin}/en/projects/${project.slug}`,
          },
        },
      };
    });

    return [...staticEntries, ...articleEntries, ...projectEntries];
  } catch {
    return staticEntries;
  }
}
