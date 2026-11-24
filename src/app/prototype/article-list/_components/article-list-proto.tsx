"use client";

// 文章列表原型（issue #30）：卡片网格方案 + 共用 chrome 与状态工具条。

import { useState } from "react";
import "./proto.css";
import { ArticleCards } from "./article-cards";
import { useArticleListState, type ListState } from "./list-state";
import { ProtoChrome } from "./proto-chrome";
import { Switcher } from "./switcher";

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

export function ArticleListProto() {
  const list = useArticleListState();
  const [covers, setCovers] = useState(true);

  return (
    <div className="proto-root">
      <ProtoChrome />
      {list.detail ? <DetailStub list={list} /> : <ArticleCards list={list} covers={covers} />}
      <Switcher list={list} covers={covers} onToggleCovers={() => setCovers((value) => !value)} />
    </div>
  );
}
