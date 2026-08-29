import type { TodoItem } from '../contracts/domain';

/** Deliberately small vocabulary: it is easier to choose than a priority scale. */
export type EnergyLevel = 'deep' | 'light' | 'quick';

export interface TaskPlanningMetadata {
  estimateMinutes: number | null;
  energyLevel: EnergyLevel | null;
  scheduledStartAt: string | null;
  parentTaskId: string | null;
  needsClarity: boolean;
}

export interface ParsedCapture {
  title: string;
  tags: string[];
  estimateMinutes: number | null;
  scheduledStartAt: string | null;
  energyLevel: EnergyLevel | null;
  priority: 'low' | 'medium' | 'high' | null;
  targetListSlugOrName: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawInput: string;
  isMultiLine?: boolean;
  individualItems?: ParsedCapture[];
}

export interface RecommendationContext {
  availableMinutes: number;
  energyLevel: EnergyLevel;
  now?: Date;
}

export interface TaskRecommendation {
  task: TodoItem;
  score: number;
  reasons: string[];
}

export interface DecompositionStep {
  title: string;
  estimateMinutes: number;
  energyLevel: EnergyLevel;
}

export type DecompositionSource = 'template' | 'ai';

export interface ProposalProvenance {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: number;
}

export interface TaskPlanProposal {
  taskTitle: string;
  summary: string;
  firstAction: string;
  steps: DecompositionStep[];
  source: DecompositionSource;
  assumptions?: string[];
  warnings?: string[];
  provenance?: ProposalProvenance;
}

const TAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
const DURATION_PATTERN = /(?:^|\s)(\d{1,3})\s*(?:m|min|mins|minutes|h|hr|hrs|hours)\b/i;
const TOMORROW_PATTERN = /\btomorrow\b/i;
const TODAY_PATTERN = /\btoday\b/i;
const LIST_ROUTING_PATTERN = /(?:^|\s)\/([\p{L}\p{N}_-]+)/gu;
const ENERGY_PATTERN = /(?:^|\s)~(deep|light|quick|focus|easy)\b/i;
const PRIORITY_PATTERN = /(?:^|\s)!(urgent|high|med|medium|low)\b/i;

export function parseSingleLineCapture(rawInput: string, now = new Date()): ParsedCapture {
  const tags = Array.from(rawInput.matchAll(TAG_PATTERN), (match) => match[1].toLocaleLowerCase());
  
  const listMatches = Array.from(rawInput.matchAll(LIST_ROUTING_PATTERN), (match) => match[1]);
  const targetListSlugOrName = listMatches.length > 0 ? listMatches[listMatches.length - 1] : null;

  const durationMatch = rawInput.match(DURATION_PATTERN);
  let estimateMinutes: number | null = null;
  if (durationMatch) {
    const rawVal = Number(durationMatch[1]);
    const isHours = /h|hr|hrs|hours/i.test(durationMatch[0]);
    estimateMinutes = isHours ? rawVal * 60 : rawVal;
  }

  const energyMatch = rawInput.match(ENERGY_PATTERN);
  let energyLevel: EnergyLevel | null = null;
  if (energyMatch) {
    const rawEnergy = energyMatch[1].toLowerCase();
    if (rawEnergy === 'deep' || rawEnergy === 'focus') energyLevel = 'deep';
    else if (rawEnergy === 'light' || rawEnergy === 'easy') energyLevel = 'light';
    else if (rawEnergy === 'quick') energyLevel = 'quick';
  }

  const priorityMatch = rawInput.match(PRIORITY_PATTERN);
  let priority: 'low' | 'medium' | 'high' | null = null;
  if (priorityMatch) {
    const rawPri = priorityMatch[1].toLowerCase();
    if (rawPri === 'urgent' || rawPri === 'high') priority = 'high';
    else if (rawPri === 'med' || rawPri === 'medium') priority = 'medium';
    else if (rawPri === 'low') priority = 'low';
  }

  let scheduledStartAt: string | null = null;
  if (TOMORROW_PATTERN.test(rawInput)) {
    scheduledStartAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9).toISOString();
  } else if (TODAY_PATTERN.test(rawInput)) {
    scheduledStartAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).toISOString();
  }

  const title = rawInput
    .replace(TAG_PATTERN, ' ')
    .replace(LIST_ROUTING_PATTERN, ' ')
    .replace(ENERGY_PATTERN, ' ')
    .replace(PRIORITY_PATTERN, ' ')
    .replace(DURATION_PATTERN, ' ')
    .replace(TOMORROW_PATTERN, ' ')
    .replace(TODAY_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    rawInput,
    title,
    tags,
    estimateMinutes: estimateMinutes && estimateMinutes > 0 ? estimateMinutes : null,
    scheduledStartAt,
    energyLevel,
    priority,
    targetListSlugOrName,
    confidence: title ? (scheduledStartAt || estimateMinutes || tags.length || energyLevel || priority || targetListSlugOrName ? 'high' : 'medium') : 'low',
  };
}

export function parseCapture(rawInput: string, now = new Date()): ParsedCapture {
  const lines = rawInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const individualItems = lines.map((line) => parseSingleLineCapture(line, now));
    const combined = parseSingleLineCapture(lines[0], now);
    return {
      ...combined,
      rawInput,
      isMultiLine: true,
      individualItems,
    };
  }
  return parseSingleLineCapture(rawInput, now);
}

export function needsClarity(metadata: Pick<TaskPlanningMetadata, 'estimateMinutes' | 'energyLevel'>): boolean {
  return metadata.estimateMinutes === null || metadata.energyLevel === null;
}

/** A deterministic, explainable policy; AI never controls this decision. */
export function recommendTasks(
  tasks: TodoItem[],
  metadataByTaskId: Readonly<Record<string, TaskPlanningMetadata | undefined>>,
  context: RecommendationContext,
): TaskRecommendation[] {
  const today = (context.now ?? new Date()).toISOString().slice(0, 10);
  return tasks
    .filter((task) => task.status !== 'done' && task.status !== 'deleted')
    .map((task) => {
      const metadata = metadataByTaskId[task.id];
      const reasons: string[] = [];
      let score = 0;
      if (metadata?.energyLevel === context.energyLevel) { score += 40; reasons.push('Matches your selected energy.'); }
      if (metadata?.estimateMinutes && metadata.estimateMinutes <= context.availableMinutes) { score += 30; reasons.push(`Fits your ${context.availableMinutes}-minute window.`); }
      if (task.dueDate && task.dueDate <= today) { score += 20; reasons.push('Due today or overdue.'); }
      if (task.status === 'doing') { score += 10; reasons.push('Already in progress.'); }
      if (metadata?.needsClarity) score -= 25;
      return { task, score, reasons: reasons.length ? reasons : ['A good candidate to clarify next.'] };
    })
    .sort((left, right) => right.score - left.score || left.task.order - right.task.order);
}

/** Reliable template fallback used before, or instead of, an AI provider. */
export function createTemplateProposal(taskTitle: string): TaskPlanProposal {
  const cleanTitle = taskTitle.trim();
  return {
    taskTitle: cleanTitle,
    summary: `Break “${cleanTitle}” into a small, reviewable sequence.`,
    firstAction: `Define the smallest next action for “${cleanTitle}”.`,
    source: 'template',
    steps: [
      { title: 'Clarify the desired outcome and constraints', estimateMinutes: 10, energyLevel: 'light' },
      { title: 'Gather the materials or information needed', estimateMinutes: 15, energyLevel: 'light' },
      { title: 'Complete the core piece of work', estimateMinutes: 30, energyLevel: 'deep' },
      { title: 'Review the result and choose the next action', estimateMinutes: 10, energyLevel: 'quick' },
    ],
  };
}
