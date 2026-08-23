import { useEffect, useMemo, useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { supportsDependencies } from '../core/contracts/repository';
import { dependencyTypeLabel, type TaskDependency, type TaskDependencySummary, type TaskDependencyType } from '../core/domain/dependencies';

export function TaskDependencies({ taskId, listId, readOnly = false, onSummaryChange }: { taskId: string; listId: string; readOnly?: boolean; onSummaryChange?: (summary: TaskDependencySummary) => void }) {
  const repository = appServices.repository;
  const dependencyRepository = supportsDependencies(repository) ? repository : null;
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [candidates, setCandidates] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [type, setType] = useState<TaskDependencyType>('finish_to_start');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!dependencyRepository) return;
    try {
      const [edges, summary, tasks] = await Promise.all([dependencyRepository.listDependencies(taskId), dependencyRepository.getDependencySummary(taskId), repository.listTasks(listId)]);
      setDependencies(edges);
      setCandidates(tasks.filter((task) => task.id !== taskId && task.status !== 'deleted').map((task) => ({ id: task.id, title: task.title })));
      onSummaryChange?.(summary);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Dependencies could not be loaded.'); }
  };

  useEffect(() => { void load(); }, [taskId, listId, dependencyRepository]);
  const waitingOn = useMemo(() => dependencies.filter((edge) => edge.dependentTask.id === taskId), [dependencies, taskId]);
  const unblocks = useMemo(() => dependencies.filter((edge) => edge.prerequisiteTask.id === taskId), [dependencies, taskId]);
  if (!dependencyRepository) return null;

  const add = async () => {
    if (!selectedId || saving) return;
    try {
      setSaving(true); setMessage(null);
      await dependencyRepository.createDependency({ prerequisiteTaskId: selectedId, dependentTaskId: taskId, type });
      setSelectedId(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'This dependency could not be added.'); }
    finally { setSaving(false); }
  };
  const remove = async (dependency: TaskDependency) => {
    if (!window.confirm(`Remove the dependency between “${dependency.prerequisiteTask.title}” and “${dependency.dependentTask.title}”?`)) return;
    try { setSaving(true); setMessage(null); await dependencyRepository.removeDependency(dependency.id); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'This dependency could not be removed.'); }
    finally { setSaving(false); }
  };

  return <section className="task-dependencies" aria-labelledby={`dependencies-${taskId}`}>
    <header><div><p className="eyebrow">Task sequence</p><h3 id={`dependencies-${taskId}`}>What needs to happen first?</h3><p>Connect tasks when one cannot start until another is finished.</p></div><span className={waitingOn.some((edge) => edge.required && edge.type === 'finish_to_start' && edge.prerequisiteTask.status !== 'done') ? 'task-dependencies__state is-blocked' : 'task-dependencies__state is-ready'}>{waitingOn.some((edge) => edge.required && edge.type === 'finish_to_start' && edge.prerequisiteTask.status !== 'done') ? `Blocked · ${waitingOn.filter((edge) => edge.required && edge.type === 'finish_to_start' && edge.prerequisiteTask.status !== 'done').length}` : 'Ready'}</span></header>
    <div className="task-dependencies__columns">
      <div><h4>Needs this first</h4>{waitingOn.length ? <ul>{waitingOn.map((edge) => <li key={edge.id}><span><b>{edge.prerequisiteTask.status === 'done' ? '✓' : '↳'}</b><strong>{edge.prerequisiteTask.title}</strong><small>{dependencyTypeLabel[edge.type]} · {edge.prerequisiteTask.status === 'done' ? 'Complete' : 'Open'}</small></span>{!readOnly ? <button type="button" onClick={() => void remove(edge)} disabled={saving} aria-label={`Remove dependency on ${edge.prerequisiteTask.title}`}>×</button> : null}</li>)}</ul> : <p>No earlier task is required.</p>}</div>
      <div><h4>Makes possible</h4>{unblocks.length ? <ul>{unblocks.map((edge) => <li key={edge.id}><span><b>→</b><strong>{edge.dependentTask.title}</strong><small>{dependencyTypeLabel[edge.type]}</small></span>{!readOnly ? <button type="button" onClick={() => void remove(edge)} disabled={saving} aria-label={`Remove dependency for ${edge.dependentTask.title}`}>×</button> : null}</li>)}</ul> : <p>This task does not unlock another task.</p>}</div>
    </div>
    {!readOnly ? <div className="task-dependencies__composer"><label><span>This task needs</span><select aria-label="Choose the task that must happen first" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={saving}><option value="">Choose a task…</option>{candidates.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label><span>Relationship</span><select value={type} onChange={(event) => setType(event.target.value as TaskDependencyType)} disabled={saving}>{Object.entries(dependencyTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="secondary-button" onClick={() => void add()} disabled={!selectedId || saving}>{saving ? 'Saving…' : 'Connect tasks'}</button></div> : null}
    {message ? <p className="task-dependencies__message" role="alert">{message}</p> : null}
  </section>;
}
