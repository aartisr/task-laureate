/**
 * Builder Pattern & Fluent API
 * 
 * Provides fluent, chainable configuration builders for:
 * - Repository setup
 * - Middleware configuration
 * - Plugin registration
 * - Service composition
 */

import { DIContainer, ServiceKeys } from './di';
import {
  PluginManager,
  Middleware,
  IPlugin,
  LoggingMiddleware,
  CachingMiddleware,
  ValidationMiddleware,
  ErrorRecoveryMiddleware,
  PerformanceMiddleware,
} from './plugins';
import { DatabaseConfig, loadDatabaseConfig, validateDatabaseConfig } from './config';
import { IRepository, RepositoryRegistry, RepositoryConfig } from './repository';
import { Logger, LogLevel } from './errors';

/**
 * Application Builder - fluent API for wiring everything together
 */
export class ApplicationBuilder {
  private container: DIContainer;
  private pluginManager: PluginManager;
  private dbConfig: Partial<DatabaseConfig> = {};
  private middlewares: Middleware[] = [];
  private logger: Logger;

  constructor() {
    this.container = new DIContainer();
    this.pluginManager = new PluginManager();
    this.logger = new Logger('warn');
    this.container.registerInstance(ServiceKeys.PluginManager, this.pluginManager);
  }

  /**
   * Configure database
   */
  withDatabase(config: Partial<DatabaseConfig>): this {
    this.dbConfig = config;
    this.container.registerInstance(ServiceKeys.DatabaseConfig, config);
    return this;
  }

  /**
   * Use in-memory database (default)
   */
  withInMemoryDatabase(): this {
    return this.withDatabase({ type: 'memory' });
  }

  /**
   * Use PostgreSQL database
   */
  withPostgresDatabase(databaseUrl: string): this {
    return this.withDatabase({
      type: 'postgres',
      databaseUrl,
    });
  }

  /**
   * Add logging
   */
  withLogging(level: LogLevel = 'warn'): this {
    this.logger = new Logger(level);
    this.container.registerInstance(ServiceKeys.Logger, this.logger);
    return this;
  }

  /**
   * Add caching middleware
   */
  withCaching(ttlMs: number = 5000): this {
    this.middlewares.push(new CachingMiddleware(ttlMs));
    return this;
  }

  /**
   * Add validation middleware
   */
  withValidation(): this {
    this.middlewares.push(new ValidationMiddleware());
    return this;
  }

  /**
   * Add error recovery middleware
   */
  withErrorRecovery(maxRetries: number = 3): this {
    this.middlewares.push(new ErrorRecoveryMiddleware(maxRetries));
    return this;
  }

  /**
   * Add performance monitoring
   */
  withPerformanceMonitoring(): this {
    this.middlewares.push(new PerformanceMiddleware());
    return this;
  }

  /**
   * Add custom middleware
   */
  withMiddleware(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a plugin
   */
  withPlugin(plugin: IPlugin): this {
    this.pluginManager.registerPlugin(plugin).catch((error) => {
      this.logger.error('Failed to register plugin', error as Error);
    });
    return this;
  }

  /**
   * Register custom service
   */
  registerService<T>(key: string | symbol, factory: () => T | Promise<T>): this {
    this.container.registerFactory(key, () => factory(), { scope: 'singleton' });
    return this;
  }

  /**
   * Build the application
   */
  async build(): Promise<Application> {
    // Validate configuration
    const finalConfig = loadDatabaseConfig(this.dbConfig);
    validateDatabaseConfig(finalConfig);

    // Create repository
    const repo = await RepositoryRegistry.create(finalConfig);
    if (finalConfig.type === 'postgres') {
      await repo.connect();
    }

    this.container.registerInstance(ServiceKeys.Repository, repo);

    // Register all middlewares
    for (const middleware of this.middlewares) {
      this.pluginManager.useMiddleware(middleware);
    }

    return new Application(this.container, this.pluginManager, repo, this.logger);
  }
}

/**
 * Application - main entry point after configuration
 */
export class Application {
  constructor(
    private container: DIContainer,
    private pluginManager: PluginManager,
    private repository: IRepository,
    private logger: Logger
  ) {}

  /**
   * Get the DI container
   */
  getContainer(): DIContainer {
    return this.container;
  }

  /**
   * Get the plugin manager
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * Get the repository
   */
  getRepository(): IRepository {
    return this.repository;
  }

  /**
   * Get a service from the container
   */
  async getService<T>(key: string | symbol): Promise<T> {
    return this.container.resolve<T>(key);
  }

  /**
   * Shutdown the application
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down application');
    await this.repository.disconnect();
    this.pluginManager.clear();
  }
}

/**
 * Repository Builder - fluent API for repository configuration
 */
export class RepositoryBuilder {
  private config: Partial<RepositoryConfig> = { type: 'memory' };

  /**
   * Use in-memory repository
   */
  inMemory(): this {
    this.config.type = 'memory';
    return this;
  }

  /**
   * Use PostgreSQL repository
   */
  postgres(databaseUrl: string): this {
    this.config = {
      type: 'postgres',
      databaseUrl,
    };
    return this;
  }

  /**
   * Set database URL
   */
  withDatabaseUrl(url: string): this {
    this.config.databaseUrl = url;
    return this;
  }

  /**
   * Enable debug logging
   */
  withDebug(enabled: boolean = true): this {
    this.config.debug = enabled;
    return this;
  }

  /**
   * Set connection timeout
   */
  withTimeout(ms: number): this {
    this.config.connectTimeoutMs = ms;
    return this;
  }

  /**
   * Set query timeout
   */
  withQueryTimeout(ms: number): this {
    this.config.queryTimeout = ms;
    return this;
  }

  /**
   * Set retry attempts
   */
  withRetries(attempts: number): this {
    this.config.retryAttempts = attempts;
    return this;
  }

  /**
   * Build the repository
   */
  async build(): Promise<IRepository> {
    const finalConfig = loadDatabaseConfig(this.config);
    validateDatabaseConfig(finalConfig);

    const repo = await RepositoryRegistry.create(finalConfig);

    if (finalConfig.type === 'postgres') {
      await repo.connect();
    }

    return repo;
  }
}

/**
 * Plugin Builder - fluent API for plugin development
 */
export class PluginBuilder {
  private plugin: IPlugin;
  private middlewares: Middleware[] = [];

  constructor(name: string, version: string = '1.0.0') {
    this.plugin = {
      name,
      version,
    };
  }

  /**
   * Set plugin version
   */
  withVersion(version: string): this {
    this.plugin.version = version;
    return this;
  }

  /**
   * Add load hook
   */
  onLoad(handler: () => Promise<void>): this {
    this.plugin.onLoad = handler;
    return this;
  }

  /**
   * Add unload hook
   */
  onUnload(handler: () => Promise<void>): this {
    this.plugin.onUnload = handler;
    return this;
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Build the plugin
   */
  build(): IPlugin {
    return this.plugin;
  }

  /**
   * Get middlewares
   */
  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }
}

/**
 * Convenience factory functions
 */
export const builders = {
  /**
   * Create a new application builder
   */
  app: () => new ApplicationBuilder(),

  /**
   * Create a new repository builder
   */
  repository: () => new RepositoryBuilder(),

  /**
   * Create a new plugin builder
   */
  plugin: (name: string, version?: string) => new PluginBuilder(name, version),
};
