import type { TodoListStatus } from '../core/contracts/domain';
import '../styles/components/list-status-badge.css';

const statusPresentation: Record<TodoListStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'badge--active' },
  completed: { label: 'Completed', className: 'badge--completed' },
  archived: { label: 'Archived', className: 'badge--archived' },
  deleted: { label: 'Deleted', className: 'badge--deleted' },
};

export function ListStatusBadge({ status }: { status: TodoListStatus }) {
  const presentation = statusPresentation[status];
  return <span className={`status-badge ${presentation.className}`}>{presentation.label}</span>;
}
