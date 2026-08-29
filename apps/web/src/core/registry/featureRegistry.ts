import type { FeatureContext, FeatureModule, NavItem } from '../contracts/feature';

export interface FeatureRegistry {
  registerFeature: (feature: FeatureModule) => void;
  getFeatures: () => FeatureModule[];
  getNavItems: () => NavItem[];
}

export function createFeatureRegistry(initialFeatures: FeatureModule[] = []): FeatureRegistry {
  const features = new Map<string, FeatureModule>();
  const navItems: NavItem[] = [];

  const registerFeature = (feature: FeatureModule) => {
    if (features.has(feature.id)) {
      throw new Error(`Duplicate feature registration: ${feature.id}`);
    }

    features.set(feature.id, feature);
    if (feature.navItems) {
      navItems.push(...feature.navItems);
    }
  };

  for (const feature of initialFeatures) {
    registerFeature(feature);
  }

  return {
    registerFeature,
    getFeatures: () => [...features.values()],
    getNavItems: () => [...navItems],
  };
}

export function initializeFeatures(registry: FeatureRegistry, context: FeatureContext) {
  for (const feature of registry.getFeatures()) {
    feature.init?.(context);
  }
}
