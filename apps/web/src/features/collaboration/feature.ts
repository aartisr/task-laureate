import type { FeatureModule } from '../../core/contracts/feature';

export const collaborationFeature: FeatureModule = {
  id: 'collaboration',
  navItems: [
    { label: 'Shared with me', to: '/shared-with-me', icon: '↗', description: 'Lists and Tasks others shared with you' },
    { label: 'Shared by me', to: '/shared-by-me', icon: '↗', description: 'Lists you share with others' },
  ],
};
