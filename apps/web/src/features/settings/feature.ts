import type { FeatureModule } from '../../core/contracts/feature';

export const settingsFeature: FeatureModule = {
  id: 'settings',
  navItems: [
    {
      label: 'Settings',
      to: '/settings',
      icon: '⚙️',
      description: 'Configure platform behavior.',
    },
  ],
};
