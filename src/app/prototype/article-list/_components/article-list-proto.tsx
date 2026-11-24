"use client";

// 文章列表原型（issue #30）：三个方案共用状态与 chrome，只换列表本身的渲染。

import { useRouter } from "next/navigation";
import "./proto.css";
import { useArticleListState, type ListState } from "./list-state";
import { ProtoChrome } from "./proto-chrome";
import { Switcher, VARIANTS } from "./switcher";
import { VariantA } from "./variant-a";
import { VariantB } from "./variant-b";
import { VariantC } from "./variant-c";

function DetailStub({ list }: { list: ListState }) {
  const article = list.detail!;
  return (
    <main className="proto-detail">
      <button className="proto-detail__back" onClick={list.back}>
        ← 返回文章列表
      </button>
      <h1>{article.title}</h1>
      <p className="proto-detail__meta">
        Lawson · <time dateTime={article.date}>{article.date}</time> · {article.tags.join(" · ")}
      </p>
      <p className="proto-detail__body">
        正文占位。详情页的形态见原型工单 #31，这里只用来验证返回后条件、页码与原条目定位的呈现。
      </p>
    </main>
  );
}

export function ArticleListProto({ variant }: { variant: string }) {
  const router = useRouter();
  const list = useArticleListState();
  const current = VARIANTS.some((item) => item.key === variant) ? variant : "A";

  return (
    <div className="proto-root">
      <ProtoChrome />
      {list.detail ? (
        <DetailStub list={list} />
      ) : current === "A" ? (
        <VariantA list={list} />
      ) : current === "B" ? (
        <VariantB list={list} />
      ) : (
        <VariantC list={list} />
      )}
      <Switcher
        current={current}
        onChange={(next) => router.replace(`?variant=${next}`, { scroll: false })}
        list={list}
      />
    </div>
  );
}
