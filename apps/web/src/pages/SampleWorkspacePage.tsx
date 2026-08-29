import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { trackGrowthEvent } from '../infrastructure/analytics/growthTelemetry';
import { usePageSEO } from '../hooks/usePageSEO';
import { publicUrl } from '../config/site';

type SampleTask = { id: number; title: string; done: boolean };
const initialTasks: SampleTask[] = [
  { id: 1, title: 'Choose the next small, concrete step', done: false },
  { id: 2, title: 'Set a due date only when it helps', done: false },
  { id: 3, title: 'Finish the task and review your progress', done: false },
];

/** A self-contained, non-persistent preview: it never writes visitor data. */
export function SampleWorkspacePage() {
  const [tasks, setTasks] = useState(initialTasks);
  usePageSEO({ title: 'Try the workspace', description: 'Try a private, non-persistent Task-Laureate sample workspace before choosing to sign in.', url: publicUrl('/sample') });

  const complete = (id: number) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const completed = tasks.filter((task) => task.done).length;

  return <main className="sample-workspace" aria-labelledby="sample-workspace-title">
    <header className="sample-workspace__header"><Link to="/" className="sample-workspace__brand">Task-Laureate</Link><Link to="/sign-in" className="secondary-button">Sign in to sync</Link></header>
    <section className="sample-workspace__hero"><p>Interactive sample</p><h1 id="sample-workspace-title">See a calmer next step.</h1><span>This preview stays in this browser tab and is never saved to an account.</span></section>
    <section className="sample-workspace__card" aria-label="Sample task list"><div className="sample-workspace__list-heading"><div><p>Sample list</p><h2>Plan one meaningful outcome</h2></div><strong>{completed}/{tasks.length} complete</strong></div><ul>{tasks.map((task) => <li key={task.id}><button type="button" onClick={() => complete(task.id)} aria-pressed={task.done} aria-label={`${task.done ? 'Reopen' : 'Complete'}: ${task.title}`}><span aria-hidden="true">{task.done ? '✓' : ''}</span><span>{task.title}</span></button></li>)}</ul><div className="sample-workspace__progress" aria-label={`${completed} of ${tasks.length} tasks complete`}><i style={{ width: `${(completed / tasks.length) * 100}%` }} /></div></section>
    <section className="sample-workspace__next"><div><h2>Keep this kind of clarity?</h2><p>Sign in only when you want a private, account-scoped workspace that can sync across devices.</p></div><Link to="/sign-in" className="primary-button" onClick={() => trackGrowthEvent('signup_started', { source: 'sample_workspace' })}>Create private workspace</Link></section>
  </main>;
}
