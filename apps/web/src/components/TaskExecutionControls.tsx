import { useId, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { createTemplateProposal, type EnergyLevel } from '../core/domain/antiBacklog';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import { appServices } from '../app/runtime/appServices';
import { useTodoMutations } from '../core/mutations/useTodoMutations';

export function TaskExecutionControls({ task }: { task: TodoItem }) {
  const [estimate, setEstimate] = useState(''); const [energy, setEnergy] = useState<EnergyLevel>('light');
  const [proposalVisible, setProposalVisible] = useState(false); const [selectedSteps, setSelectedSteps] = useState<string[]>([]); const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null); const [isSavingPlan, setIsSavingPlan] = useState(false);
  const proposalId = useId();
  const mutations = useTodoMutations();
  const proposal = createTemplateProposal(task.title);
  const savePlan = async () => {
    setIsSavingPlan(true);
    try {
      await createTaskPlanningService(appServices.repository).save(task.id, { estimateMinutes: Number(estimate) || null, energyLevel: energy, scheduledStartAt: null, parentTaskId: null });
      setNotice({ message: 'Planning details saved.', tone: 'success' });
    } catch {
      setNotice({ message: 'Could not save planning details. Please try again.', tone: 'error' });
    } finally {
      setIsSavingPlan(false);
    }
  };
  const acceptSteps = async () => {
    const accepted = proposal.steps.filter((step) => selectedSteps.includes(step.title));
    await createTaskPlanningService(appServices.repository).acceptSteps(task.id, accepted);
    for (const step of accepted) await mutations.createTask.mutateAsync({ listId: task.listId, title: step.title, notes: `Next step for: ${task.title}` });
    setProposalVisible(false); setNotice({ message: `${accepted.length} editable steps added to this list.`, tone: 'success' });
  };
  const snooze = async () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    await mutations.updateTask.mutateAsync({ taskId: task.id, input: { dueDate: tomorrow.toISOString().slice(0, 10) } });
    setNotice({ message: 'Snoozed until tomorrow.', tone: 'success' });
  };
  const park = async () => { await mutations.updateTask.mutateAsync({ taskId: task.id, input: { status: 'blocked' } }); setNotice({ message: 'Parked for later review.', tone: 'success' }); };
  const archive = async () => { await mutations.deleteTask.mutateAsync(task.id); setNotice({ message: 'Archived from active work.', tone: 'success' }); };
  return <section className="panel task-execution-controls" aria-label="Execution planning">
    <div className="task-execution-controls__header">
      <div>
        <p className="eyebrow">Make this feasible</p>
        <h2>Plan and deconstruct</h2>
        <p>Choose a realistic window, then break down work only when it needs a clearer starting point.</p>
      </div>
      <button className="primary-button task-execution-controls__deconstruct" type="button" aria-controls={proposalId} aria-expanded={proposalVisible} onClick={() => { setSelectedSteps(proposal.steps.map((step) => step.title)); setProposalVisible((value) => !value); }}>
        {proposalVisible ? 'Hide breakdown' : 'Deconstruct task'}
      </button>
    </div>
    <details className="task-execution-controls__details">
      <summary>Planning details</summary>
      <div className="task-execution-controls__planning-form">
        <label className="field"><span>Minutes</span><input value={estimate} type="number" min="1" max="1440" onChange={(event) => setEstimate(event.target.value)} /></label>
        <label className="field"><span>Energy</span><select value={energy} onChange={(event) => setEnergy(event.target.value as EnergyLevel)}><option value="deep">Deep focus</option><option value="light">Light energy</option><option value="quick">Quick win</option></select></label>
        <button className="secondary-button task-execution-controls__save" type="button" disabled={isSavingPlan} onClick={() => void savePlan()}>{isSavingPlan ? 'Saving…' : 'Save plan'}</button>
      </div>
      <div className="task-execution-controls__secondary-actions">
        <button type="button" className="secondary-button" onClick={() => void snooze()}>Snooze to tomorrow</button>
        <button type="button" className="secondary-button" onClick={() => void park()}>Park for review</button>
        <button type="button" className="secondary-button" onClick={() => void archive()}>Archive</button>
      </div>
    </details>
    {proposalVisible ? <div id={proposalId} className="task-execution-controls__proposal"><div className="task-execution-controls__proposal-heading"><div><p className="eyebrow">Suggested next steps</p><h3>Keep only what makes starting easier.</h3><p>Each step is editable after you add it to this list.</p></div><span>{selectedSteps.length}/{proposal.steps.length} selected</span></div><div className="card-list task-execution-controls__proposal-list">{proposal.steps.map((step) => <label className="data-card task-execution-controls__proposal-card" key={step.title}><input type="checkbox" checked={selectedSteps.includes(step.title)} onChange={() => setSelectedSteps((items) => items.includes(step.title) ? items.filter((item) => item !== step.title) : [...items, step.title])} /><div className="data-card__content"><strong>{step.title}</strong><p>{step.estimateMinutes} min · {step.energyLevel}</p></div></label>)}</div><div className="task-execution-controls__proposal-actions"><button className="primary-button" type="button" disabled={!selectedSteps.length || mutations.createTask.isPending} onClick={() => void acceptSteps()}>Accept selected</button><button className="secondary-button" type="button" onClick={() => setProposalVisible(false)}>Discard</button></div></div> : null}
    {notice ? <p className="task-execution-controls__notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
  </section>;
}
