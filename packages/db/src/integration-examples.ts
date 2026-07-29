/**
 * Integration Example & Best Practices
 * 
 * Shows how to use all design patterns together for maximum pluggability.
 * 
 * This file demonstrates:
 * - Dependency Injection
 * - Plugin System
 * - Middleware Composition
 * - Builder Pattern
 * - Function Composition
 * - Decorator Pattern
 */

import { createRepository, IRepository } from './repository';
import { builders, Application } from './builders';
import { DIContainer, ServiceKeys } from './di';
import {
  PluginManager,
  IPlugin,
  LoggingMiddleware,
  CachingMiddleware,
  PerformanceMiddleware,
} from './plugins';
import { memoizeAsync, retryAsync, withTimeout } from './composition';

/**
 * Example 1: Basic setup with builder pattern
 */
export async function exampleBasicSetup() {
  // Most concise - fluent API
  const app = await builders
    .app()
    .withInMemoryDatabase()
    .withLogging('debug')
    .withCaching(10000)
    .withValidation()
    .build();

  const db = app.getRepository();
  const lists = await db.listLists();
  await app.shutdown();

  return lists;
}

/**
 * Example 2: Production setup with PostgreSQL
 */
export async function exampleProductionSetup() {
  const app = await builders
    .app()
    .withPostgresDatabase(process.env.DATABASE_URL || '')
    .withLogging('warn')
    .withCaching(30000)
    .withValidation()
    .withErrorRecovery(5)
    .withPerformanceMonitoring()
    .build();

  return app;
}

/**
 * Example 3: Custom plugin
 */
export class AuditPlugin implements IPlugin {
  name = 'audit';
  version = '1.0.0';
  private events: Array<{ action: string; timestamp: Date }> = [];

  async onLoad() {
    console.log('Audit plugin loaded');
  }

  async onUnload() {
    console.log('Audit plugin unloaded, captured', this.events.length, 'events');
  }

  recordEvent(action: string) {
    this.events.push({ action, timestamp: new Date() });
  }

  getEvents() {
    return this.events;
  }
}

/**
 * Example 4: Using DI Container
 */
export async function exampleDependencyInjection() {
  const container = new DIContainer();

  // Register services
  container.registerInstance(ServiceKeys.Logger, console.log);
  container.registerFactory(
    'database',
    async () => createRepository({ type: 'memory' }),
    { scope: 'singleton' }
  );

  // Use services
  const db = await container.resolve<IRepository>('database');
  return db;
}

/**
 * Example 5: Plugin system with middleware
 */
export async function examplePluginSystem() {
  const pluginManager = new PluginManager();

  // Add middleware
  pluginManager
    .useMiddleware(new LoggingMiddleware((msg) => console.log(`[APP] ${msg}`)))
    .useMiddleware(new CachingMiddleware(5000))
    .useMiddleware(new PerformanceMiddleware());

  // Register custom plugin
  const auditPlugin = new AuditPlugin();
  await pluginManager.registerPlugin(auditPlugin);

  // Execute operation through middleware chain
  const result = await pluginManager.executeOperation(
    'getUserLists',
    { userId: '123' },
    async (context) => {
      console.log('Executing operation:', context.operationName);
      return ['list1', 'list2'];
    }
  );

  return result;
}

/**
 * Example 6: Function composition
 */
export function exampleFunctionComposition() {
  // Create a pipeline of operations
  const loadUser = async (id: string) => ({ id, name: 'User' });
  const loadLists = async (user: { id: string; name: string }) => ({
    ...user,
    lists: [],
  });
  const enrichData = async (data: any) => ({ ...data, enriched: true });

  // Chain them together
  const pipeline = async (userId: string) => {
    let data = await loadUser(userId);
    data = await loadLists(data);
    data = await enrichData(data);
    return data;
  };

  return pipeline('user123');
}

/**
 * Example 7: Retry and timeout
 */
export async function exampleRetryAndTimeout() {
  const unstableOperation = async () => {
    if (Math.random() < 0.7) throw new Error('Random failure');
    return 'Success!';
  };

  try {
    // Retry up to 3 times
    const result = await retryAsync(unstableOperation, 3, 100);
    console.log(result);
  } catch (error) {
    console.error('Failed after retries:', error);
  }

  // Add timeout
  const timedOperation = withTimeout(
    async () => {
      // Simulate long operation
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return 'Done';
    },
    1000
  );

  try {
    await timedOperation();
  } catch (error) {
    console.error('Operation timed out:', error);
  }
}

/**
 * Example 8: Memoization
 */
export async function exampleMemoization() {
  let callCount = 0;

  const expensiveOperation = memoizeAsync(
    async (id: string) => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `Result for ${id}`;
    },
    5000 // 5 second TTL
  );

  // First call - executes
  console.log(await expensiveOperation('id1')); // callCount = 1

  // Second call - cached
  console.log(await expensiveOperation('id1')); // callCount still = 1

  // Different arg - executes
  console.log(await expensiveOperation('id2')); // callCount = 2
}

/**
 * Example 9: Complete integration - all patterns together
 */
export async function exampleCompleteIntegration() {
  // 1. Setup application with builder
  const app = await builders
    .app()
    .withInMemoryDatabase()
    .withLogging('info')
    .withCaching(10000)
    .withErrorRecovery(3)
    .withPlugin(new AuditPlugin())
    .build();

  // 2. Get services from DI container
  const db = app.getRepository();
  const pluginManager = app.getPluginManager();

  // 3. Create lists through plugin middleware
  const createListOp = async () => {
    return pluginManager.executeOperation(
      'createList',
      { title: 'My Project' },
      async (context) => {
        const list = await db.createList({ title: 'My Project' });
        context.metadata.set('listId', list.id);
        return list;
      }
    );
  };

  // 4. Use composition for data pipeline
  const createTasksForList = async (listId: string) => {
    const tasks = await Promise.all([
      db.createTask({
        listId,
        title: 'Task 1',
        priority: 'HIGH',
      }),
      db.createTask({
        listId,
        title: 'Task 2',
        priority: 'MEDIUM',
      }),
    ]);
    return tasks;
  };

  // 5. Register hooks for lifecycle events
  pluginManager.registerHook('beforeShutdown', async () => {
    console.log('Running cleanup hooks');
  });

  // 6. Get metrics from performance middleware
  const pluginList = pluginManager.getPlugins();
  console.log('Active plugins:', pluginList.length);

  // 7. Shutdown gracefully
  await pluginManager.executeHook('beforeShutdown');
  await app.shutdown();

  return { app, db };
}

/**
 * Design Patterns Used
 *
 * 1. **Builder Pattern**: ApplicationBuilder, RepositoryBuilder, PluginBuilder
 *    - Fluent, chainable API
 *    - Flexible configuration
 *    - Single responsibility
 *
 * 2. **Dependency Injection**: DIContainer, ServiceLocator
 *    - Centralized service management
 *    - Singleton and transient lifetimes
 *    - Decoupled dependencies
 *
 * 3. **Plugin System**: PluginManager, IPlugin
 *    - Extensibility without modifying core
 *    - Hooks and events
 *    - Lifecycle management
 *
 * 4. **Middleware Pattern**: MiddlewareChain, Middleware interface
 *    - Cross-cutting concerns (logging, caching, validation)
 *    - Composable functionality
 *    - Request/response interception
 *
 * 5. **Repository Pattern**: IRepository, adapters
 *    - Data access abstraction
 *    - Multiple implementations (memory, postgres)
 *    - Clean API
 *
 * 6. **Adapter Pattern**: InMemoryRepository, PostgresRepository
 *    - Switch implementations via configuration
 *    - Consistent interface
 *    - No UI changes needed
 *
 * 7. **Factory Pattern**: Repository factories, service factories
 *    - Object creation abstraction
 *    - Lazy initialization
 *    - Configuration-driven creation
 *
 * 8. **Observer Pattern**: EventBus, hooks
 *    - Publish-subscribe
 *    - Event-driven architecture
 *    - Loose coupling
 *
 * 9. **Decorator Pattern**: Decorators (@Memoize, @Retry, @Timeout, @Log)
 *    - Add functionality to methods
 *    - Cross-cutting concerns
 *    - Cleaner syntax
 *
 * 10. **Strategy Pattern**: Middleware, plugins, operation handlers
 *     - Different algorithms/behaviors
 *     - Runtime selection
 *     - Interchangeable implementations
 *
 * 11. **Composition Pattern**: compose, pipe, chainAsync, batchAsync
 *     - Function composition
 *     - Pipeline construction
 *     - Functional programming
 *
 * 12. **Singleton Pattern**: DIContainer with singleton lifetime
 *     - Single instance per application
 *     - Shared state
 *     - Global access via service locator
 */
