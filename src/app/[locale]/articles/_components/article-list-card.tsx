import { DEFAULT_CARD_COVER_PATH } from "@/lib/media-url";
import { Link } from "@/i18n/navigation";
import { getArticleImageUrl } from "@/server/articles";
import { ArticleCardLink } from "./article-return-focus";

type ArticleListCardData = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageKey: string | null;
  firstPublishedAt: Date | null;
  createdAt: Date;
  tags: { id: string; name: string }[];
};

export function ArticleListCard({
  article,
  locale,
  returnTo,
  featured = false,
}: {
  article: ArticleListCardData;
  locale: string;
  returnTo: string;
  featured?: boolean;
}) {
  const publishedAt = article.firstPublishedAt ?? article.createdAt;
  const date = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(publishedAt);
  const href = `/articles/${article.slug}?returnTo=${encodeURIComponent(returnTo)}`;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getArticleImageUrl(article.coverImageKey) || DEFAULT_CARD_COVER_PATH}
      alt=""
      loading={featured ? "eager" : "lazy"}
    />
  );
  const tags = article.tags.length > 0 && (
    <span className="article-list-card__tags">
      {article.tags.map((tag) => (
        <Link href={`/articles?tag=${encodeURIComponent(tag.id)}`} key={tag.id}>
          {tag.name}
        </Link>
      ))}
    </span>
  );

  if (featured) {
    return (
      <article className="article-list-card article-list-card--featured">
        <div className="article-list-card__featured-copy">
          <time className="article-list-card__date" dateTime={publishedAt.toISOString()}>
            {date}
          </time>
          <ArticleCardLink className="article-list-card__title" href={href} slug={article.slug} focusTarget>
            {article.title}
          </ArticleCardLink>
          <p className="article-list-card__excerpt">{article.excerpt}</p>
          {tags}
        </div>
        <ArticleCardLink
          className="article-list-card__image"
          href={href}
          slug={article.slug}
          ariaLabel={article.title}
        >
          {image}
        </ArticleCardLink>
      </article>
    );
  }

  return (
    <article className="article-list-card">
      <div className="article-list-card__meta">
        {tags}
        <time className="article-list-card__date" dateTime={publishedAt.toISOString()}>
          {date}
        </time>
      </div>
      <ArticleCardLink
        className="article-list-card__image"
        href={href}
        slug={article.slug}
        ariaLabel={article.title}
      >
        {image}
      </ArticleCardLink>
      <div className="article-list-card__copy">
        <ArticleCardLink className="article-list-card__title" href={href} slug={article.slug} focusTarget>
          {article.title}
        </ArticleCardLink>
        <p className="article-list-card__excerpt">{article.excerpt}</p>
      </div>
    </article>
  );
}
