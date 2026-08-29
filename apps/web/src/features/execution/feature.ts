import type { FeatureModule } from '../../core/contracts/feature';
import { isFeatureEnabled } from '../../config/featureFlags';

export const executionFeature: FeatureModule = {
  id: 'execution',
  navItems: isFeatureEnabled('antiBacklogExecution') ? [{ label: 'Now', to: '/now', icon: '⚡', description: 'Choose the next feasible action' }] : [],
};
