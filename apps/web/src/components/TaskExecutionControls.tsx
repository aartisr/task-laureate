import { useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { createTemplateProposal, type EnergyLevel } from '../core/domain/antiBacklog';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import { appServices } from '../app/runtime/appServices';
import { useTodoMutations } from '../core/mutations/useTodoMutations';

export function TaskExecutionControls({ task }: { task: TodoItem }) {
  const [estimate, setEstimate] = useState(''); const [energy, setEnergy] = useState<EnergyLevel>('light');
  const [proposalVisible, setProposalVisible] = useState(false); const [selectedSteps, setSelectedSteps] = useState<string[]>([]); const [notice, setNotice] = useState<string | null>(null);
  const mutations = useTodoMutations();
  const proposal = createTemplateProposal(task.title);
  const savePlan = async () => {
    await createTaskPlanningService(appServices.repository).save(task.id, { estimateMinutes: Number(estimate) || null, energyLevel: energy, scheduledStartAt: null, parentTaskId: null });
    setNotice('Planning details saved.');
  };
  const acceptSteps = async () => {
    const accepted = proposal.steps.filter((step) => selectedSteps.includes(step.title));
    await createTaskPlanningService(appServices.repository).acceptSteps(task.id, accepted);
    for (const step of accepted) await mutations.createTask.mutateAsync({ listId: task.listId, title: step.title, notes: `Next step for: ${task.title}` });
    setProposalVisible(false); setNotice(`${accepted.length} editable steps added to this list.`);
  };
  const snooze = async () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    await mutations.updateTask.mutateAsync({ taskId: task.id, input: { dueDate: tomorrow.toISOString().slice(0, 10) } });
    setNotice('Snoozed until tomorrow.');
  };
  const park = async () => { await mutations.updateTask.mutateAsync({ taskId: task.id, input: { status: 'blocked' } }); setNotice('Parked for later review.'); };
  const archive = async () => { await mutations.deleteTask.mutateAsync(task.id); setNotice('Archived from active work.'); };
  return <section className="panel" aria-label="Execution planning"><div className="panel-heading"><div><p className="eyebrow">Make this feasible</p><h2>Plan and deconstruct</h2></div></div><div className="button-row"><label className="field"><span>Minutes</span><input value={estimate} type="number" min="1" max="1440" onChange={(event) => setEstimate(event.target.value)} /></label><label className="field"><span>Energy</span><select value={energy} onChange={(event) => setEnergy(event.target.value as EnergyLevel)}><option value="deep">Deep focus</option><option value="light">Light energy</option><option value="quick">Quick win</option></select></label><button className="secondary-button" type="button" onClick={() => void savePlan()}>Save plan</button><button className="primary-button" type="button" onClick={() => { setSelectedSteps(proposal.steps.map((step) => step.title)); setProposalVisible((value) => !value); }}>Deconstruct task</button></div><div className="button-row"><button type="button" className="secondary-button" onClick={() => void snooze()}>Snooze to tomorrow</button><button type="button" className="secondary-button" onClick={() => void park()}>Park for review</button><button type="button" className="secondary-button" onClick={() => void archive()}>Archive</button></div>{proposalVisible ? <div className="card-list">{proposal.steps.map((step) => <label className="data-card" key={step.title}><input type="checkbox" checked={selectedSteps.includes(step.title)} onChange={() => setSelectedSteps((items) => items.includes(step.title) ? items.filter((item) => item !== step.title) : [...items, step.title])} /><div className="data-card__content"><strong>{step.title}</strong><p>{step.estimateMinutes} min · {step.energyLevel}</p></div></label>)}<div className="button-row"><button className="primary-button" type="button" disabled={!selectedSteps.length || mutations.createTask.isPending} onClick={() => void acceptSteps()}>Accept selected</button><button className="secondary-button" type="button" onClick={() => setProposalVisible(false)}>Discard</button></div></div> : null}{notice ? <p role="status">{notice}</p> : null}</section>;
}
