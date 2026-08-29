import { Fragment, useState, type ReactNode } from 'react';
import type { TodoItem } from '../core/contracts/domain';

const ROW_HEIGHT = 92;
const INLINE_DETAIL_HEIGHT = 560;
const OVERSCAN = 8;

/** Fixed-height windowing for read/sorted task feeds. Manual drag order keeps its full DOM. */
export function VirtualTaskItems({ tasks, render, selectedId, renderDetail }: { tasks: TodoItem[]; render: (task: TodoItem) => ReactNode; selectedId?: string | null; renderDetail?: (task: TodoItem) => ReactNode }) {
  const [scrollTop, setScrollTop] = useState(0);
  const selectedIndex = selectedId ? tasks.findIndex((task) => task.id === selectedId) : -1;
  // The inline workbench has a capped, known height. Account for it in the
  // spacer math so opening details still moves the following virtual rows down.
  const detailBeforeViewport = selectedIndex >= 0 && scrollTop > (selectedIndex + 1) * ROW_HEIGHT + INLINE_DETAIL_HEIGHT;
  const logicalScrollTop = detailBeforeViewport ? scrollTop - INLINE_DETAIL_HEIGHT : scrollTop;
  const start = Math.max(0, Math.floor(logicalScrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(tasks.length, start + Math.ceil(560 / ROW_HEIGHT) + OVERSCAN * 2);
  const topHeight = start * ROW_HEIGHT + (selectedIndex >= 0 && start > selectedIndex ? INLINE_DETAIL_HEIGHT : 0);
  const bottomHeight = (tasks.length - end) * ROW_HEIGHT + (selectedIndex >= end ? INLINE_DETAIL_HEIGHT : 0);
  return <div role="list" className="task-list__items task-list__items--virtual" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div style={{ height: topHeight }} />
    {tasks.slice(start, end).map((task) => <Fragment key={task.id}>{render(task)}{task.id === selectedId && renderDetail ? <div className="task-list__inline-detail task-list__inline-detail--virtual">{renderDetail(task)}</div> : null}</Fragment>)}
    <div style={{ height: bottomHeight }} />
  </div>;
}
