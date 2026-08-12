import { useId, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { createTemplateProposal, type EnergyLevel, type TaskPlanProposal } from '../core/domain/antiBacklog';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import { appServices } from '../app/runtime/appServices';
import { useTodoMutations } from '../core/mutations/useTodoMutations';
import { aiDecompositionPreviewEnabled, requestAiDecomposition } from '../infrastructure/antiBacklog/aiDecomposition';

export function TaskExecutionControls({ task }: { task: TodoItem }) {
  const [estimate, setEstimate] = useState(''); const [energy, setEnergy] = useState<EnergyLevel>('light');
  const [proposalVisible, setProposalVisible] = useState(false); const [proposal, setProposal] = useState<TaskPlanProposal | null>(null); const [selectedSteps, setSelectedSteps] = useState<string[]>([]); const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null); const [isSavingPlan, setIsSavingPlan] = useState(false); const [isDecomposing, setIsDecomposing] = useState(false); const [isAcceptingSteps, setIsAcceptingSteps] = useState(false); const [aiConsent, setAiConsent] = useState(false);
  const proposalId = useId();
  const mutations = useTodoMutations();
  const templateProposal = createTemplateProposal(task.title);
  const activeProposal = proposal ?? templateProposal;
  const showProposal = (next: TaskPlanProposal) => { setProposal(next); setSelectedSteps(next.steps.map((step) => step.title)); setProposalVisible(true); };
  const updateStepTitle = (index: number, title: string) => {
    const priorTitle = activeProposal.steps[index]?.title;
    if (!priorTitle) return;
    const nextTitle = title.slice(0, 500);
    setProposal({ ...activeProposal, steps: activeProposal.steps.map((step, stepIndex) => stepIndex === index ? { ...step, title: nextTitle } : step) });
    setSelectedSteps((items) => items.map((item) => item === priorTitle ? nextTitle : item));
  };
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
    const accepted = activeProposal.steps.filter((step) => selectedSteps.includes(step.title));
    setIsAcceptingSteps(true);
    try {
      await createTaskPlanningService(appServices.repository).acceptSteps(task.id, accepted, activeProposal.source);
      for (const step of accepted) await mutations.createTask.mutateAsync({ listId: task.listId, title: step.title, notes: `Next step for: ${task.title}` });
      setProposalVisible(false); setNotice({ message: `${accepted.length} editable steps added to this list.`, tone: 'success' });
    } catch { setNotice({ message: 'Could not add those steps. Your task has not been changed.', tone: 'error' }); }
    finally { setIsAcceptingSteps(false); }
  };
  const tryAiBreakdown = async () => {
    setIsDecomposing(true); setNotice(null);
    const result = await requestAiDecomposition(task, aiConsent);
    setIsDecomposing(false);
    if (result.kind === 'proposal') { showProposal(result.proposal); setNotice({ message: result.cache === 'hit' ? 'Your earlier AI preview is ready to review.' : 'AI preview ready. Review and edit every step before adding it.', tone: 'success' }); return; }
    const messages: Record<string, string> = { consent_required: 'Confirm the preview consent before sending non-sensitive task text to Gemini.', not_signed_in: 'Sign in to use the internal AI preview.', content_not_allowed: 'This preview accepts only non-sensitive task text. Try the template breakdown instead.', rate_limited: 'The preview has reached its limit for now. The template breakdown is ready instead.', provider_unavailable: 'AI preview is unavailable right now. The template breakdown is ready instead.', disabled: 'AI preview is not enabled for this environment.', invalid_output: 'The AI response was not safe to use. The template breakdown is ready instead.', not_eligible: 'AI preview is limited to the approved internal cohort.' };
    showProposal(templateProposal); setNotice({ message: messages[result.reason], tone: 'error' });
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
      <button className="primary-button task-execution-controls__deconstruct" type="button" aria-controls={proposalId} aria-expanded={proposalVisible} onClick={() => proposalVisible ? setProposalVisible(false) : showProposal(templateProposal)}>
        {proposalVisible ? 'Hide breakdown' : 'Deconstruct task'}
      </button>
    </div>
    {aiDecompositionPreviewEnabled() ? <div className="task-execution-controls__ai-preview"><label><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> <span>I confirm this task contains no sensitive, confidential, or personal information and may be processed by Gemini’s internal preview.</span></label><button className="secondary-button" type="button" disabled={isDecomposing || !aiConsent} onClick={() => void tryAiBreakdown()}>{isDecomposing ? 'Creating AI preview…' : 'Try AI breakdown (preview)'}</button></div> : null}
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
    {proposalVisible ? <div id={proposalId} className="task-execution-controls__proposal"><div className="task-execution-controls__proposal-heading"><div><p className="eyebrow">{activeProposal.source === 'ai' ? 'AI preview · review required' : 'Suggested next steps'}</p><h3>Keep only what makes starting easier.</h3><p>{activeProposal.summary} {activeProposal.source === 'ai' ? `First action: ${activeProposal.firstAction}` : 'Each step is editable before or after you add it to this list.'}</p>{activeProposal.assumptions?.length ? <p>Assumptions: {activeProposal.assumptions.join(' · ')}</p> : null}{activeProposal.warnings?.length ? <p>Notes: {activeProposal.warnings.join(' · ')}</p> : null}</div><span>{selectedSteps.length}/{activeProposal.steps.length} selected</span></div><div className="card-list task-execution-controls__proposal-list">{activeProposal.steps.map((step, index) => <div className="data-card task-execution-controls__proposal-card" key={`${index}:${step.title}`}><input aria-label={`Include step ${index + 1}`} type="checkbox" checked={selectedSteps.includes(step.title)} onChange={() => setSelectedSteps((items) => items.includes(step.title) ? items.filter((item) => item !== step.title) : [...items, step.title])} /><div className="data-card__content"><label className="sr-only" htmlFor={`${proposalId}-step-${index}`}>Step {index + 1}</label><input id={`${proposalId}-step-${index}`} className="task-execution-controls__step-title" value={step.title} maxLength={500} onChange={(event) => updateStepTitle(index, event.target.value)} /><p>{step.estimateMinutes} min · {step.energyLevel}</p></div></div>)}</div><div className="task-execution-controls__proposal-actions"><button className="primary-button" type="button" disabled={!selectedSteps.length || mutations.createTask.isPending || isAcceptingSteps || activeProposal.steps.some((step) => !step.title.trim())} onClick={() => void acceptSteps()}>{isAcceptingSteps ? 'Adding steps…' : 'Accept selected'}</button><button className="secondary-button" type="button" onClick={() => setProposalVisible(false)}>Discard</button></div></div> : null}
    {notice ? <p className="task-execution-controls__notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
  </section>;
}
