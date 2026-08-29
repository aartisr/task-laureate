import type { FeatureModule } from '../../core/contracts/feature';

export const taskFeature: FeatureModule = {
  id: 'tasks',
  commands: [
    {
      id: 'tasks.new',
      label: 'New task',
      shortcut: 'N',
      run: () => undefined,
    },
  ],
};
