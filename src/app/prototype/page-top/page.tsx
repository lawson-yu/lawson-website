import { redirect } from "next/navigation";

// 原内页顶部探索已并入文章列表原型。
export default function PageTopPrototypePage() {
  redirect("/prototype/article-list");
}
