import { ArticleListProto } from "./_components/article-list-proto";

// 一次性原型路由（issue #30），只在 prototype/article-list 分支存在。
export const instant = false;
export default async function ArticleListPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  return <ArticleListProto variant={variant ?? "A"} />;
}
