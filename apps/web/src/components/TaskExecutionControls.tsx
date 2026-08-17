import { useId } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { type EnergyLevel } from '../core/domain/antiBacklog';
import { aiDecompositionPreviewEnabled } from '../infrastructure/antiBacklog/aiDecomposition';
import { useTaskExecutionPlan } from '../hooks/useTaskExecutionPlan';
import { AiAssistBadge } from './AiAssistBadge';

export function TaskExecutionControls({ task }: { task: TodoItem }) {
  const proposalId = useId();
  const { estimate, setEstimate, energy, setEnergy, proposalVisible, setProposalVisible, selectedSteps, setSelectedSteps, notice, isSavingPlan, isDecomposing, isAcceptingSteps, aiConsent, setAiConsent, templateProposal, activeProposal, showProposal, updateStepTitle, savePlan, acceptSteps, tryAiBreakdown, snooze, park, archive } = useTaskExecutionPlan(task);
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
    {aiDecompositionPreviewEnabled() ? <div className="task-execution-controls__ai-preview">
      <div className="task-execution-controls__ai-copy">
        <AiAssistBadge>Optional AI preview</AiAssistBadge>
        <label><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> <span>I confirm this task has no credentials, contact details, account numbers, medical-record details, or other sensitive identifiers.</span></label>
        <p>Uses Gemini only after you opt in. Suggestions stay editable and are never added until you choose.</p>
      </div>
      <button className="secondary-button task-execution-controls__ai-trigger" type="button" disabled={isDecomposing || !aiConsent} onClick={() => void tryAiBreakdown()}>
        <AiAssistBadge working={isDecomposing}>{isDecomposing ? 'Creating preview…' : 'Try AI breakdown'}</AiAssistBadge>
      </button>
    </div> : null}
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
    {proposalVisible ? <div id={proposalId} className="task-execution-controls__proposal"><div className="task-execution-controls__proposal-heading"><div>{activeProposal.source === 'ai' ? <><AiAssistBadge className="task-execution-controls__proposal-provenance">AI-assisted · review required</AiAssistBadge><p className="task-execution-controls__ai-disclosure">Gemini proposed these steps. Review, edit, select, or discard them before anything changes.</p></> : <p className="eyebrow">Suggested next steps</p>}<h3>Keep only what makes starting easier.</h3><p>{activeProposal.summary} {activeProposal.source === 'ai' ? `First action: ${activeProposal.firstAction}` : 'Each step is editable before or after you add it to this list.'}</p>{activeProposal.assumptions?.length ? <p>Assumptions: {activeProposal.assumptions.join(' · ')}</p> : null}{activeProposal.warnings?.length ? <p>Notes: {activeProposal.warnings.join(' · ')}</p> : null}</div><span>{selectedSteps.length}/{activeProposal.steps.length} selected</span></div><div className="card-list task-execution-controls__proposal-list">{activeProposal.steps.map((step, index) => <div className="data-card task-execution-controls__proposal-card" key={`${index}:${step.title}`}><div className="data-card__content"><label className="sr-only" htmlFor={`${proposalId}-step-${index}`}>Step {index + 1}</label><textarea id={`${proposalId}-step-${index}`} className="task-execution-controls__step-title" value={step.title} rows={2} maxLength={500} onChange={(event) => updateStepTitle(index, event.target.value)} />{activeProposal.source === 'ai' ? <AiAssistBadge className="task-execution-controls__step-provenance">AI-assisted start</AiAssistBadge> : null}<p>{step.estimateMinutes} min · {step.energyLevel}</p></div><label className="task-execution-controls__proposal-select"><input aria-label={`Include step ${index + 1}`} type="checkbox" checked={selectedSteps.includes(step.title)} onChange={() => setSelectedSteps((items) => items.includes(step.title) ? items.filter((item) => item !== step.title) : [...items, step.title])} /><span>Include</span></label></div>)}</div><div className="task-execution-controls__proposal-actions"><button className="primary-button" type="button" disabled={!selectedSteps.length || isAcceptingSteps || activeProposal.steps.some((step) => !step.title.trim())} onClick={() => void acceptSteps()}>{isAcceptingSteps ? 'Adding steps…' : 'Add selected steps'}</button><button className="secondary-button" type="button" disabled={isAcceptingSteps} onClick={() => setProposalVisible(false)}>Discard</button></div></div> : null}
    {notice ? <p className="task-execution-controls__notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.message}</p> : null}
  </section>;
}
