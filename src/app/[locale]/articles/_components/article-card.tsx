import { DEFAULT_CARD_COVER_PATH } from "@/lib/media-url";
import { Link } from "@/i18n/navigation";
import { getArticleImageUrl } from "@/server/articles";
import { ArticleCardLink } from "./article-return-focus";

type ArticleCardData = {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string;
  coverImageKey: string | null;
  firstPublishedAt: Date | null;
  createdAt: Date;
  tags: { id: string; name: string }[];
};

export function ArticleCard({ article, locale, returnTo }: {
  article: ArticleCardData;
  locale: string;
  returnTo?: string;
}) {
  if (!article.slug) return null;

  const publishedAt = article.firstPublishedAt ?? article.createdAt;
  const href = returnTo
    ? `/articles/${article.slug}?returnTo=${encodeURIComponent(returnTo)}`
    : `/articles/${article.slug}`;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getArticleImageUrl(article.coverImageKey) || DEFAULT_CARD_COVER_PATH}
      alt=""
      loading="lazy"
    />
  );

  return (
    <article className="article-card">
      {returnTo ? (
        <ArticleCardLink
          className="article-card__image"
          href={href}
          slug={article.slug}
          ariaLabel={article.title}
        >
          {image}
        </ArticleCardLink>
      ) : (
        <Link className="article-card__image" href={href} aria-label={article.title}>
          {image}
        </Link>
      )}
      <div className="article-card__body">
        <div className="article-card__meta">
          <time dateTime={publishedAt.toISOString()}>
            {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }).format(publishedAt)}
          </time>
          {article.tags.length > 0 && (
            <span className="article-card__tags">
              {article.tags.map((tag) => (
                <Link href={`/articles?tag=${encodeURIComponent(tag.id)}`} key={tag.id}>
                  {tag.name}
                </Link>
              ))}
            </span>
          )}
        </div>
        {returnTo ? (
          <ArticleCardLink className="article-card__title" href={href} slug={article.slug} focusTarget>
            {article.title}
          </ArticleCardLink>
        ) : (
          <Link className="article-card__title" href={href}>
            {article.title}
          </Link>
        )}
        <p className="article-card__excerpt">{article.excerpt}</p>
      </div>
    </article>
  );
}
