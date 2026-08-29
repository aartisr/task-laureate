import type { FeatureModule } from '../../core/contracts/feature';

export const searchFeature: FeatureModule = {
  id: 'search',
  navItems: [
    {
      label: 'Search',
      to: '/search',
      icon: '🔍',
      description: 'Find lists and tasks.',
    },
  ],
};
