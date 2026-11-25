import { Suspense } from "react";
import { ArticleListProto } from "./_components/article-list-proto";

// 一次性原型路由（issue #30），只在 prototype/article-list 分支存在。
export default function ArticleListPrototypePage() {
  return <Suspense><ArticleListProto /></Suspense>;
}
