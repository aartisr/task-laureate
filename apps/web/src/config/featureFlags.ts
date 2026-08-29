export type FeatureFlag = 'antiBacklogExecution' | 'calendarIntegration' | 'aiDecomposition';
const defaults: Record<FeatureFlag, boolean> = { antiBacklogExecution: true, calendarIntegration: false, aiDecomposition: false };
const environmentNames: Record<FeatureFlag, string> = {
  antiBacklogExecution: 'VITE_FEATURE_ANTI_BACKLOG_EXECUTION',
  calendarIntegration: 'VITE_FEATURE_CALENDAR_INTEGRATION',
  aiDecomposition: 'VITE_FEATURE_AI_DECOMPOSITION',
};

/** One explicit mapping prevents camel-case flags silently becoming unreachable. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const value = import.meta.env[environmentNames[flag]];
  return value === undefined ? defaults[flag] : value === 'true';
}
