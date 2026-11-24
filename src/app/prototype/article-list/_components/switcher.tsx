"use client";

// 原型切换条：左右箭头切方案（同步到 ?variant=），下面一行是状态读数与状态快捷键。

import { useEffect } from "react";
import { describeConditions, type ListState } from "./list-state";

export const VARIANTS = [
  { key: "A", name: "目录" },
  { key: "B", name: "面板" },
  { key: "C", name: "时间线" },
] as const;

export function Switcher({
  current,
  onChange,
  list,
}: {
  current: string;
  onChange: (variant: string) => void;
  list: ListState;
}) {
  const index = VARIANTS.findIndex((variant) => variant.key === current);
  const step = (offset: number) =>
    onChange(VARIANTS[(index + offset + VARIANTS.length) % VARIANTS.length].key);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const conditions = describeConditions(list);

  return (
    <aside className="proto-switch" aria-label="原型切换">
      <div className="proto-switch__row">
        <button aria-label="上一个方案" onClick={() => step(-1)}>
          ←
        </button>
        <span className="proto-switch__label">
          {current} · {VARIANTS[index]?.name ?? ""}
        </span>
        <button aria-label="下一个方案" onClick={() => step(1)}>
          →
        </button>
        <span className="proto-switch__state">
          {list.detail
            ? `详情：${list.detail.title}`
            : [
                ...conditions,
                `${list.total} 篇`,
                `第 ${list.page} / ${list.pageCount} 页`,
              ].join(" · ")}
        </span>
      </div>
      <div className="proto-switch__row proto-switch__row--presets">
        <button onClick={() => list.preset({ q: "验收", tag: "AI 编程" })}>组合筛选</button>
        <button onClick={() => list.preset({ q: "向量数据库迁移" })}>无结果</button>
        <button onClick={() => list.preset({ page: 2 })}>第 2 页</button>
        <button onClick={() => list.preset({})}>重置</button>
      </div>
    </aside>
  );
}
