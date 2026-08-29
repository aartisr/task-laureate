import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { recommendTasks, type EnergyLevel } from '../core/domain/antiBacklog';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import { addDailyCommitment, readDailyPlan, removeDailyCommitment, saveDailyPlan, type DailyPlan } from '../core/services/dailyPlan';
import type { TodoItem } from '../core/contracts/domain';
import { useTodoMutations } from '../core/mutations/useTodoMutations';
import { usePageSEO } from '../hooks/usePageSEO';

type TaskWithList = TodoItem & { listTitle: string };
const energyOptions: Array<{ value: EnergyLevel; label: string }> = [
  { value: 'deep', label: '⚡ Deep focus' }, { value: 'light', label: '☕ Light energy' }, { value: 'quick', label: '⏱ Quick wins' },
];

export function ExecutionPage() {
  usePageSEO({ title: 'Now | Task-Laureate', description: 'Choose the next feasible task.' });
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>(() => readDailyPlan());
  const [reflection, setReflection] = useState(() => readDailyPlan().reflection);
  const mutations = useTodoMutations();
  const data = useQuery({ queryKey: ['execution', 'tasks'], queryFn: async () => {
    const dashboard = await appServices.repository.getDashboard();
    const groups = await Promise.all(dashboard.lists.map(async (list) => (await appServices.repository.listTasks(list.id)).map((task) => ({ ...task, listTitle: list.title }))));
    return groups.flat() as TaskWithList[];
  } });
  const taskIds = data.data?.map((task) => task.id).join(',') ?? '';
  const planning = useQuery({ queryKey: ['execution', 'planning', taskIds], enabled: Boolean(taskIds), queryFn: async () => {
    const service = createTaskPlanningService(appServices.repository);
    return Object.fromEntries(await Promise.all((data.data ?? []).map(async (task) => [task.id, await service.get(task.id)])));
  } });

  const model = useMemo(() => {
    const tasks = data.data ?? [];
    const metadata = planning.data ?? {};
    const recommendations = recommendTasks(tasks, metadata, { availableMinutes: dailyPlan.availableMinutes, energyLevel: dailyPlan.energyLevel })
      .map((item) => ({ ...item, task: item.task as TaskWithList }));
    const committed = dailyPlan.taskIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is TaskWithList => Boolean(task && task.status !== 'done'));
    return {
      recommendations,
      committed,
      now: committed[0] ?? recommendations[0]?.task ?? null,
      focus: recommendations.filter((item) => metadata[item.task.id]?.energyLevel === 'deep' && (metadata[item.task.id]?.estimateMinutes ?? Infinity) <= dailyPlan.availableMinutes),
      quick: recommendations.filter((item) => (metadata[item.task.id]?.estimateMinutes ?? Infinity) <= 10),
      review: tasks.filter((task) => task.status !== 'done' && (metadata[task.id]?.needsClarity ?? true)),
      plannedMinutes: committed.reduce((total, task) => total + (metadata[task.id]?.estimateMinutes ?? 0), 0),
    };
  }, [data.data, dailyPlan, planning.data]);

  const persistPlan = (update: Partial<Omit<DailyPlan, 'date'>>) => setDailyPlan(saveDailyPlan(update));
  const commit = (taskId: string) => setDailyPlan(addDailyCommitment(taskId));
  const release = (taskId: string) => setDailyPlan(removeDailyCommitment(taskId));
  const snooze = async (task: TaskWithList) => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    await mutations.updateTask.mutateAsync({ taskId: task.id, input: { dueDate: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}` } });
    release(task.id);
  };
  const complete = async (task: TaskWithList) => {
    await mutations.completeTask.mutateAsync({ taskId: task.id, isComplete: true });
    release(task.id);
  };
  const closeDay = () => {
    const next = saveDailyPlan({ reflection: reflection.trim(), closedAt: new Date().toISOString() });
    setDailyPlan(next);
  };

  if (data.isLoading || planning.isLoading) return <main className="page-surface" aria-busy="true">Preparing your next action…</main>;
  const capacityPercent = Math.min(100, Math.round((model.plannedMinutes / Math.max(dailyPlan.availableMinutes, 1)) * 100));
  return <main className="page-stack execution-page" aria-label="Execution workspace">
    <header className="page-hero"><div><p className="eyebrow">Your day, deliberately</p><h1>Choose what fits. Let the rest wait.</h1><p className="lede">A calm plan that respects your actual time and energy—not a louder priority pile.</p></div></header>

    <section className="panel execution-page__ritual"><div className="panel-heading"><div><p className="eyebrow">One-minute plan</p><h2>What do you have right now?</h2><p>Start with the next feasible action. Set a time window only when you need a more precise plan.</p></div>{dailyPlan.closedAt ? <span className="status-pill">Day reflected</span> : null}</div>
      <details className="execution-page__disclosure"><summary>Set time and energy</summary><div className="execution-page__controls" aria-label="Available capacity">{energyOptions.map((option) => <button key={option.value} type="button" className={dailyPlan.energyLevel === option.value ? 'primary-button' : 'secondary-button'} onClick={() => persistPlan({ energyLevel: option.value, closedAt: null })}>{option.label}</button>)}<label className="field"><span>Minutes available</span><input type="number" min="5" max="480" value={dailyPlan.availableMinutes} onChange={(event) => persistPlan({ availableMinutes: Math.max(5, Math.min(480, Number(event.target.value) || 5)), closedAt: null })} /></label><div className="execution-page__capacity"><div><strong>{model.plannedMinutes} of {dailyPlan.availableMinutes} minutes intentionally planned</strong><span>{dailyPlan.taskIds.length}/3 commitments</span></div><div className="execution-page__meter" role="progressbar" aria-label="Planned capacity" aria-valuemin={0} aria-valuemax={dailyPlan.availableMinutes} aria-valuenow={model.plannedMinutes}><i style={{ width: `${capacityPercent}%` }} /></div><p>{capacityPercent > 100 ? 'Your plan is over capacity—release or defer one task.' : capacityPercent >= 85 ? 'You are protecting a full, realistic window.' : 'You still have room only if it feels genuinely useful.'}</p></div></div></details>
    </section>

    <section className="panel execution-page__now"><div className="panel-heading"><div><p className="eyebrow">Now</p><h2>{model.now ? 'Your next feasible action' : 'Your day is clear'}</h2><p>{model.now ? 'Start here. You can complete, defer, or release it without leaving the flow.' : 'Capture something when it appears, or use this time to recharge.'}</p></div></div>{model.now ? <ExecutionCard task={model.now} reason={model.committed.some((task) => task.id === model.now?.id) ? 'A commitment you chose for today.' : 'The best match for your available time and energy.'} isCommitted={dailyPlan.taskIds.includes(model.now.id)} canCommit={dailyPlan.taskIds.length < 3} isPending={mutations.completeTask.isPending || mutations.updateTask.isPending} onCommit={commit} onRelease={release} onComplete={complete} onSnooze={snooze} /> : null}</section>

    <details className="execution-page__disclosure execution-page__commitments"><summary>Today’s plan <span className="execution-page__commitment-count">{model.committed.length}/3 committed</span></summary><div className="panel-heading"><div><p className="eyebrow">Protected time</p><h2>Today’s commitments</h2><p>A small promise is easier to keep than an endless list. Keep only what you are prepared to protect.</p></div></div>{model.committed.length ? <div className="card-list execution-page__commitment-list">{model.committed.map((task) => <ExecutionCard key={task.id} task={task} reason={`${planning.data?.[task.id]?.estimateMinutes ?? 'Unestimated'} min · ${planning.data?.[task.id]?.energyLevel ?? 'clarify energy'}`} isCommitted canCommit={false} isPending={mutations.completeTask.isPending || mutations.updateTask.isPending} onCommit={commit} onRelease={release} onComplete={complete} onSnooze={snooze} />)}</div> : <p className="empty-state execution-page__commitments-empty">No commitments yet. Choose the recommendation above only when you are ready to protect time for it.</p>}</details>

    <details className="execution-page__disclosure"><summary>Explore other options</summary><p>Only open this when the next action above is not the right fit.</p><div className="execution-page__grid"><TaskSection title="Focus block" description="Deep work that fits this window." items={model.focus.slice(0, 4)} committed={dailyPlan.taskIds} canCommit={dailyPlan.taskIds.length < 3} onCommit={commit} /><TaskSection title="Quick wins" description="Finishable in ten minutes or less." items={model.quick.slice(0, 4)} committed={dailyPlan.taskIds} canCommit={dailyPlan.taskIds.length < 3} onCommit={commit} /></div><TaskSection variant="clarify" title="Clarify before committing" description="These tasks are not ready for today yet. Add a realistic duration and energy level first." items={model.review.map((task) => ({ task, reasons: ['Needs a duration and energy level.'] })).slice(0, 8)} committed={dailyPlan.taskIds} canCommit={dailyPlan.taskIds.length < 3} onCommit={commit} /></details>

    <details className="execution-page__disclosure execution-page__shutdown"><summary>End my day</summary><div className="panel-heading"><div><p className="eyebrow">Close the loop</p><h2>Leave a useful note for tomorrow.</h2><p>One sentence is enough. This is reflection, not a scorecard.</p></div></div><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="What helped, what got in the way, or what should tomorrow know?" rows={3} /><div className="button-row"><button type="button" className="primary-button" onClick={closeDay}>{dailyPlan.closedAt ? 'Update reflection' : 'Close today gently'}</button>{dailyPlan.closedAt ? <span role="status">Reflected {new Date(dailyPlan.closedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span> : null}</div></details>
  </main>;
}

function ExecutionCard({ task, reason, isCommitted, canCommit, isPending, onCommit, onRelease, onComplete, onSnooze }: { task: TaskWithList; reason: string; isCommitted: boolean; canCommit: boolean; isPending: boolean; onCommit: (id: string) => void; onRelease: (id: string) => void; onComplete: (task: TaskWithList) => Promise<void>; onSnooze: (task: TaskWithList) => Promise<void> }) {
  return <article className="data-card execution-card"><div className="data-card__content"><strong>{task.title}</strong><p>{task.listTitle} · {reason}</p></div><div className="button-row">{isCommitted ? <><button className="primary-button" type="button" disabled={isPending} onClick={() => void onComplete(task)}>Complete</button><button className="secondary-button" type="button" disabled={isPending} onClick={() => void onSnooze(task)}>Tomorrow</button><button className="secondary-button" type="button" onClick={() => onRelease(task.id)}>Release</button></> : <button className="primary-button" type="button" disabled={!canCommit} onClick={() => onCommit(task.id)}>{canCommit ? 'Add to today' : 'Today is full'}</button>}<Link className="secondary-button" to="/lists/$listId/tasks/$taskId" params={{ listId: task.listId, taskId: task.id }}>Details</Link></div></article>;
}

function TaskSection({ title, description, items, committed, canCommit, onCommit, variant = 'ready' }: { title: string; description: string; items: Array<{ task: TaskWithList; reasons: string[] }>; committed: string[]; canCommit: boolean; onCommit: (id: string) => void; variant?: 'ready' | 'clarify' }) {
  const isClarify = variant === 'clarify';
  return <section className={`panel task-section task-section--${variant}`}><div className="panel-heading"><div>{isClarify ? <p className="eyebrow">Readiness check</p> : null}<h2>{title}</h2><p>{description}</p></div>{isClarify ? <span className="task-section__count">{items.length} to shape</span> : null}</div>{items.length ? <div className="card-list">{items.map(({ task, reasons }) => <article className="data-card" key={task.id}><div className="data-card__content"><strong>{task.title}</strong><p>{task.listTitle} · {reasons.join(' ')}</p></div><div className="button-row">{isClarify ? <><span className="task-section__readiness">Needs a plan</span><Link className="secondary-button" to="/lists/$listId/tasks/$taskId" params={{ listId: task.listId, taskId: task.id }}>Plan task</Link></> : <>{committed.includes(task.id) ? <span className="status-pill">In today</span> : <button className="primary-button" type="button" disabled={!canCommit} onClick={() => onCommit(task.id)}>{canCommit ? 'Add to today' : 'Today is full'}</button>}<Link className="secondary-button" to="/lists/$listId/tasks/$taskId" params={{ listId: task.listId, taskId: task.id }}>Details</Link></>}</div></article>)}</div> : <p className={`empty-state${isClarify ? ' task-section__empty' : ''}`}>{isClarify ? 'Everything in this view is ready to consider when it fits your day.' : 'Nothing fits this view yet. Try a different window or clarify a task.'}</p>}</section>;
}
