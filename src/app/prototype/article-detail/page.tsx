import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProtoChrome } from "../article-list/_components/proto-chrome";
import "../article-list/_components/proto.css";
import { ArticleDetail } from "./_components/article-detail";

export default function ArticleDetailPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="proto-root">
      <ProtoChrome />
      <Suspense><ArticleDetail /></Suspense>
    </div>
  );
}
