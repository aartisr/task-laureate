export type FeatureFlag = 'antiBacklogExecution' | 'calendarIntegration' | 'aiDecomposition';
const defaults: Record<FeatureFlag, boolean> = { antiBacklogExecution: true, calendarIntegration: false, aiDecomposition: false };
export function isFeatureEnabled(flag: FeatureFlag): boolean { const value = import.meta.env[`VITE_FEATURE_${flag.toUpperCase()}`]; return value === undefined ? defaults[flag] : value === 'true'; }
