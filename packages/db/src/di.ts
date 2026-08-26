/**
 * Dependency Injection Container
 * 
 * Centralized service management with:
 * - Singleton and transient lifetimes
 * - Factory functions
 * - Lazy initialization
 * - Service resolution with type safety
 * 
 * Enables complete decoupling and extreme pluggability.
 */

type ServiceFactory<T> = (container: DIContainer) => T | Promise<T>;
type ServiceResolver<T> = T | ServiceFactory<T>;

export interface ServiceLifetime {
  scope: 'singleton' | 'transient';
}

interface ServiceRegistration<T> {
  resolver: ServiceResolver<T>;
  lifetime: ServiceLifetime;
  instance?: T;
  initializing?: Promise<T>;
}

/**
 * Lightweight DI Container for extreme pluggability
 */
export class DIContainer {
  private services = new Map<string | symbol, ServiceRegistration<any>>();
  private resolved = new WeakMap<ServiceRegistration<any>, any>();

  /**
   * Register a service with a value (singleton by default)
   */
  registerInstance<T>(key: string | symbol, instance: T): this {
    this.services.set(key, {
      resolver: instance,
      lifetime: { scope: 'singleton' },
      instance,
    });
    return this;
  }

  /**
   * Register a service with a factory function
   */
  registerFactory<T>(
    key: string | symbol,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = { scope: 'transient' }
  ): this {
    this.services.set(key, {
      resolver: factory,
      lifetime,
    });
    return this;
  }

  /**
   * Register a class constructor (with auto-instantiation)
   */
  registerClass<T>(
    key: string | symbol,
    ctor: new (container: DIContainer) => T,
    lifetime: ServiceLifetime = { scope: 'transient' }
  ): this {
    this.services.set(key, {
      resolver: (container: DIContainer) => new ctor(container),
      lifetime,
    });
    return this;
  }

  /**
   * Resolve a service by key
   */
  async resolve<T>(key: string | symbol): Promise<T> {
    const registration = this.services.get(key);
    if (!registration) {
      throw new Error(`Service not registered: ${String(key)}`);
    }

    // Return singleton if already resolved
    if (registration.lifetime.scope === 'singleton' && registration.instance) {
      return registration.instance as T;
    }

    // Prevent double initialization of singletons
    if (registration.lifetime.scope === 'singleton' && registration.initializing) {
      return registration.initializing as Promise<T>;
    }

    // Create instance
    const instancePromise = Promise.resolve(
      typeof registration.resolver === 'function'
        ? (registration.resolver as ServiceFactory<T>)(this)
        : registration.resolver
    );

    if (registration.lifetime.scope === 'singleton') {
      registration.initializing = instancePromise;
      const instance = await instancePromise;
      registration.instance = instance;
      registration.initializing = undefined;
      return instance;
    }

    return instancePromise;
  }

  /**
   * Resolve with default fallback
   */
  async resolveOrDefault<T>(key: string | symbol, defaultValue: T): Promise<T> {
    try {
      return await this.resolve<T>(key);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Check if a service is registered
   */
  has(key: string | symbol): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Create a child container for scoped operations
   */
  createChild(): DIContainer {
    const child = new DIContainer();
    // Copy registrations to child (they can override)
    for (const [key, registration] of this.services) {
      child.services.set(key, registration);
    }
    return child;
  }
}

/**
 * Global service locator (optional, use DI container preferentially)
 */
export class ServiceLocator {
  private static container: DIContainer = new DIContainer();

  static getContainer(): DIContainer {
    return this.container;
  }

  static setContainer(container: DIContainer): void {
    this.container = container;
  }

  static register<T>(
    key: string | symbol,
    factory: ServiceFactory<T>,
    lifetime?: ServiceLifetime
  ): void {
    this.container.registerFactory(key, factory, lifetime);
  }

  static async resolve<T>(key: string | symbol): Promise<T> {
    return this.container.resolve<T>(key);
  }
}

/**
 * Service keys for common services
 */
export const ServiceKeys = {
  // Database
  Repository: Symbol('Repository'),
  DatabaseConfig: Symbol('DatabaseConfig'),

  // Logging
  Logger: Symbol('Logger'),

  // Caching
  Cache: Symbol('Cache'),

  // Validation
  Validator: Symbol('Validator'),

  // Event Bus
  EventBus: Symbol('EventBus'),

  // Plugin System
  PluginManager: Symbol('PluginManager'),
} as const;
