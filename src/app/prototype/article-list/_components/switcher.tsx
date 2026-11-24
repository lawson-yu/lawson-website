"use client";

// 原型工具条：状态读数、状态快捷键、封面开关。不属于设计本身。

import { describeConditions, type ListState } from "./list-state";

export function Switcher({
  list,
  covers,
  onToggleCovers,
}: {
  list: ListState;
  covers: boolean;
  onToggleCovers: () => void;
}) {
  const conditions = describeConditions(list);

  return (
    <aside className="proto-switch" aria-label="原型状态">
      <div className="proto-switch__row">
        <span className="proto-switch__label">文章列表原型</span>
        <span className="proto-switch__state">
          {list.detail
            ? `详情：${list.detail.title}`
            : [...conditions, `${list.total} 篇`, `第 ${list.page} / ${list.pageCount} 页`].join(
                " · ",
              )}
        </span>
      </div>
      <div className="proto-switch__row proto-switch__row--presets">
        <button onClick={() => list.preset({ q: "验收", tag: "AI 编程" })}>组合筛选</button>
        <button onClick={() => list.preset({ q: "向量数据库迁移" })}>无结果</button>
        <button onClick={() => list.preset({ page: 2 })}>第 2 页</button>
        <button onClick={() => list.preset({})}>重置</button>
        <button
          className="proto-switch__toggle"
          aria-pressed={covers}
          onClick={onToggleCovers}
        >
          封面
        </button>
      </div>
    </aside>
  );
}
