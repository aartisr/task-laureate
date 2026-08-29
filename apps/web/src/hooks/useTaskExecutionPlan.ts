import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TodoItem } from '../core/contracts/domain';
import { createTemplateProposal, type EnergyLevel, type TaskPlanProposal } from '../core/domain/antiBacklog';
import { supportsTaskEvents } from '../core/contracts/antiBacklog';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import { appServices } from '../app/runtime/appServices';
import { useTodoMutations } from '../core/mutations/useTodoMutations';
import { requestAiDecomposition } from '../infrastructure/antiBacklog/aiDecomposition';
import { queryKeys } from '../core/contracts/queryKeys';

export function useTaskExecutionPlan(task: TodoItem) {
  const [estimate, setEstimate] = useState('');
  const [energy, setEnergy] = useState<EnergyLevel>('light');
  const [proposalVisible, setProposalVisible] = useState(false);
  const [proposal, setProposal] = useState<TaskPlanProposal | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isAcceptingSteps, setIsAcceptingSteps] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const queryClient = useQueryClient();
  const mutations = useTodoMutations();
  const templateProposal = createTemplateProposal(task.title);
  const activeProposal = proposal ?? templateProposal;

  const showProposal = (next: TaskPlanProposal) => {
    setProposal(next);
    setSelectedSteps(next.steps.map((step) => step.title));
    setProposalVisible(true);
  };

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
        queryClient.invalidateQueries({ queryKey: ['execution'] }),
      ]);
      setProposalVisible(false);
      setNotice({ message: `${accepted.length} editable steps added. You can refine or complete them from this list.`, tone: 'success' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      const message = /accept_task_plan|schema cache|PGRST202/i.test(detail)
        ? 'This workspace needs the latest planning update before steps can be added. Ask an administrator to apply Supabase migration 029, then try again.'
        : /permission|not allowed|unavailable/i.test(detail)
          ? 'You can review this plan, but you need editor access to add its steps to this list.'
          : 'We could not add the plan. Nothing was partially created—please try again.';
      console.error('[Task-Laureate planning] Atomic plan acceptance failed.', { taskId: task.id, origin: activeProposal.source, message: detail });
      setNotice({ message, tone: 'error' });
    } finally {
      setIsAcceptingSteps(false);
    }
  };

  const tryAiBreakdown = async () => {
    setIsDecomposing(true);
    setNotice(null);
    const result = await requestAiDecomposition(task, aiConsent);
    setIsDecomposing(false);
    if (result.kind === 'proposal') {
      showProposal(result.proposal);
      setNotice({ message: result.cache === 'hit' ? 'Your earlier AI preview is ready to review.' : 'AI preview ready. Review and edit every step before adding it.', tone: 'success' });
      return;
    }
    const messages: Record<string, string> = { consent_required: 'Confirm the preview consent before sending non-sensitive task text to Gemini.', not_signed_in: 'Sign in to use the internal AI preview.', content_not_allowed: 'This preview accepts only non-sensitive task text. Try the template breakdown instead.', rate_limited: 'The preview has reached its limit for now. The template breakdown is ready instead.', provider_unavailable: 'AI preview is unavailable right now. The template breakdown is ready instead.', disabled: 'AI preview is not enabled for this environment.', invalid_output: 'The AI response was not safe to use. The template breakdown is ready instead.', not_eligible: 'AI preview is limited to the approved internal cohort.' };
    showProposal(templateProposal);
    setNotice({ message: messages[result.reason], tone: 'error' });
  };

  const record = async (type: string, payload: Record<string, unknown> = {}) => {
    if (!supportsTaskEvents(appServices.repository)) return;
    await appServices.repository.recordTaskEvent({ taskId: task.id, type, occurredAt: new Date().toISOString(), idempotencyKey: `execution:${type}:${task.id}:${crypto.randomUUID()}`, payload });
    await queryClient.invalidateQueries({ queryKey: ['task-events'] });
  };
  const snooze = async () => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); await mutations.updateTask.mutateAsync({ taskId: task.id, input: { dueDate: tomorrow.toISOString().slice(0, 10) } }); await record('snoozed', { until: tomorrow.toISOString().slice(0, 10) }); setNotice({ message: 'Snoozed until tomorrow.', tone: 'success' }); };
  const park = async () => { await mutations.updateTask.mutateAsync({ taskId: task.id, input: { status: 'blocked' } }); await record('parked'); setNotice({ message: 'Parked for later review.', tone: 'success' }); };
  const archive = async () => { await mutations.deleteTask.mutateAsync(task.id); await record('archived'); setNotice({ message: 'Archived from active work.', tone: 'success' }); };

  return { estimate, setEstimate, energy, setEnergy, proposalVisible, setProposalVisible, selectedSteps, setSelectedSteps, notice, isSavingPlan, isDecomposing, isAcceptingSteps, aiConsent, setAiConsent, templateProposal, activeProposal, showProposal, updateStepTitle, savePlan, acceptSteps, tryAiBreakdown, snooze, park, archive };
}
