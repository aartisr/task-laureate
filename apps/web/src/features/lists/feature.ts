import type { FeatureModule } from '../../core/contracts/feature';

export const listFeature: FeatureModule = {
  id: 'lists',
  routes: [
    {
      id: 'lists.detail',
      path: '/lists/$listId',
      label: 'List detail',
    },
  ],
};
