import { useState, type ReactNode } from 'react';
import type { TodoItem } from '../core/contracts/domain';

const ROW_HEIGHT = 92;
const OVERSCAN = 8;

/** Fixed-height windowing for read/sorted task feeds. Manual drag order keeps its full DOM. */
export function VirtualTaskItems({ tasks, render }: { tasks: TodoItem[]; render: (task: TodoItem) => ReactNode }) {
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(tasks.length, start + Math.ceil(560 / ROW_HEIGHT) + OVERSCAN * 2);
  return <div role="list" className="task-list__items task-list__items--virtual" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <div style={{ height: start * ROW_HEIGHT }} />{tasks.slice(start, end).map(render)}<div style={{ height: (tasks.length - end) * ROW_HEIGHT }} />
  </div>;
}
