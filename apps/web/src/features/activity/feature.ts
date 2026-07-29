import type { FeatureModule } from '../../core/contracts/feature';

export const activityFeature: FeatureModule = {
  id: 'activity',
  navItems: [
    {
      label: 'Activity',
      to: '/activity',
      icon: '🕐',
      description: 'Review recent changes.',
    },
  ],
};
